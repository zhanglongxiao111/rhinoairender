using System.Drawing;
using System.Drawing.Imaging;
using System.Net.Http.Headers;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Rhino;

namespace AIRenderPanel.Providers
{
    /// <summary>
    /// Gemini 图像生成 Provider
    /// 支持两种模式：
    /// - 专业模式 (gemini-3-pro-image-preview): 高质量，支持 4K
    /// - 快速模式 (gemini-2.5-flash-image): 快速响应，带对比度预处理
    /// </summary>
    public class GeminiProvider : IImageProvider
    {
        private readonly Func<string?> _getApiKey;
        private readonly HttpClient _httpClient;

        public string Name => _useProMode ? "专业模式" : "快速模式";
        public bool RequiresApiKey => true;

        // API 端点
        private const string API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
        
        // 模型名称
        private const string MODEL_PRO = "gemini-3-pro-image-preview";    // 专业模式
        private const string MODEL_FLASH = "gemini-2.5-flash-image";      // 快速模式

        // 生成参数
        private string? _resolution;
        private string? _aspectRatio;
        private bool _useProMode = true;       // 默认专业模式
        private int _contrastAdjust = -92;     // 对比度调整（仅快速模式），默认 -92%

        public GeminiProvider(Func<string?> getApiKey)
        {
            _getApiKey = getApiKey;
            _httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromMinutes(5)
            };
        }

        /// <summary>
        /// 设置生成模式
        /// </summary>
        /// <param name="useProMode">true=专业模式, false=快速模式</param>
        public void SetMode(bool useProMode)
        {
            _useProMode = useProMode;
            RhinoApp.WriteLine($"[AI渲染] 切换到{(useProMode ? "专业" : "快速")}模式");
        }

        /// <summary>
        /// 设置生成参数
        /// </summary>
        public void SetGenerationParams(string? resolution, string? aspectRatio)
        {
            _resolution = resolution;
            _aspectRatio = aspectRatio;
        }

        /// <summary>
        /// 设置对比度调整（仅快速模式有效）
        /// </summary>
        /// <param name="contrastPercent">对比度百分比，范围 0 到 -100</param>
        public void SetContrastAdjust(int contrastPercent)
        {
            // 确保在 0 到 -100 范围内
            _contrastAdjust = Math.Clamp(contrastPercent, -100, 0);
        }

        private string CurrentModel => _useProMode ? MODEL_PRO : MODEL_FLASH;

        public async Task<GenerateResult> GenerateAsync(
            string prompt,
            byte[] referenceImage,
            int count,
            int width,
            int height,
            CancellationToken cancellationToken)
        {
            // 优先从环境变量获取 API Key，其次从设置获取
            var apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? _getApiKey();
            
            if (string.IsNullOrEmpty(apiKey))
            {
                throw new InvalidOperationException(
                    "API Key 未配置。请设置环境变量 GEMINI_API_KEY 或在设置中输入 API Key。");
            }

            // 快速模式下进行对比度预处理
            byte[] processedImage = referenceImage;
            if (!_useProMode && _contrastAdjust < 0)
            {
                RhinoApp.WriteLine($"[AI渲染] 快速模式：应用对比度调整 {_contrastAdjust}%");
                processedImage = AdjustContrast(referenceImage, _contrastAdjust);
            }

            var images = new List<byte[]>();
            string? requestId = null;

            var modeText = _useProMode ? "专业模式" : "快速模式";
            RhinoApp.WriteLine($"[AI渲染] {modeText}：开始生成 {count} 张图片");
            RhinoApp.WriteLine($"[AI渲染] 模型: {CurrentModel}");
            RhinoApp.WriteLine($"[AI渲染] 分辨率: {_resolution ?? "默认"}, 比例: {_aspectRatio ?? "Auto"}");

            for (int i = 0; i < count; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();

                try
                {
                    RhinoApp.WriteLine($"[AI渲染] 正在生成第 {i + 1}/{count} 张图片...");
                    
                    var result = await GenerateSingleImageAsync(
                        prompt, 
                        processedImage, 
                        apiKey, 
                        cancellationToken
                    );
                    
                    images.Add(result.ImageBytes);
                    requestId ??= result.RequestId;

                    RhinoApp.WriteLine($"[AI渲染] 第 {i + 1}/{count} 张图片生成成功");

                    // 如果还有更多图片要生成，等待 0.5 秒（避免速率限制）
                    if (i < count - 1)
                    {
                        await Task.Delay(500, cancellationToken);
                    }
                }
                catch (Exception ex)
                {
                    RhinoApp.WriteLine($"[AI渲染] 生成失败 ({i + 1}/{count}): {ex.Message}");
                    throw;
                }
            }

            return new GenerateResult
            {
                Images = images,
                Model = CurrentModel,
                RequestId = requestId
            };
        }

        /// <summary>
        /// 调整图像对比度（用于快速模式预处理）
        /// </summary>
        /// <param name="imageBytes">原始图像字节</param>
        /// <param name="contrastPercent">对比度调整百分比（负值降低对比度）</param>
        private byte[] AdjustContrast(byte[] imageBytes, int contrastPercent)
        {
            try
            {
                using var ms = new MemoryStream(imageBytes);
                using var original = new Bitmap(ms);
                
                // 对比度系数：-100% 时为 0（完全灰色），0% 时为 1（不变）
                // contrastPercent 范围是 0 到 -100
                float contrastFactor = 1.0f + (contrastPercent / 100.0f);
                contrastFactor = Math.Max(0, Math.Min(1, contrastFactor)); // 限制在 0-1 之间
                
                // 创建输出图像
                var result = new Bitmap(original.Width, original.Height);
                
                for (int y = 0; y < original.Height; y++)
                {
                    for (int x = 0; x < original.Width; x++)
                    {
                        var pixel = original.GetPixel(x, y);
                        
                        // 对比度调整公式：newValue = (oldValue - 128) * factor + 128
                        int r = Clamp((int)((pixel.R - 128) * contrastFactor + 128));
                        int g = Clamp((int)((pixel.G - 128) * contrastFactor + 128));
                        int b = Clamp((int)((pixel.B - 128) * contrastFactor + 128));
                        
                        result.SetPixel(x, y, Color.FromArgb(pixel.A, r, g, b));
                    }
                }
                
                using var outputMs = new MemoryStream();
                result.Save(outputMs, ImageFormat.Png);
                return outputMs.ToArray();
            }
            catch (Exception ex)
            {
                RhinoApp.WriteLine($"[AI渲染] 对比度调整失败: {ex.Message}，使用原图");
                return imageBytes;
            }
        }

        private static int Clamp(int value) => Math.Max(0, Math.Min(255, value));

        private async Task<(byte[] ImageBytes, string RequestId)> GenerateSingleImageAsync(
            string prompt,
            byte[] referenceImage,
            string apiKey,
            CancellationToken cancellationToken)
        {
            // 构建 Gemini API 请求体
            var parts = new List<object>();

            // 添加提示词
            parts.Add(new { text = $"请根据以下提示词对参考图进行风格化处理或渲染：{prompt}" });

            // 添加参考图像
            parts.Add(new
            {
                inline_data = new
                {
                    mime_type = "image/png",
                    data = Convert.ToBase64String(referenceImage)
                }
            });

            // 构建请求体
            object generationConfig;
            
            if (_useProMode)
            {
                // 专业模式：支持 imageConfig（分辨率、比例）
                var imageConfig = new Dictionary<string, object>();
                if (!string.IsNullOrEmpty(_resolution))
                {
                    imageConfig["imageSize"] = _resolution;
                }
                if (!string.IsNullOrEmpty(_aspectRatio))
                {
                    imageConfig["aspectRatio"] = _aspectRatio;
                }
                
                generationConfig = new
                {
                    responseModalities = new[] { "TEXT", "IMAGE" },
                    temperature = 1.0,
                    imageConfig = imageConfig.Count > 0 ? imageConfig : null
                };
            }
            else
            {
                // 快速模式：简化配置
                generationConfig = new
                {
                    responseModalities = new[] { "TEXT", "IMAGE" },
                    temperature = 0.8
                };
            }

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = parts.ToArray()
                    }
                },
                generationConfig
            };

            var jsonContent = JsonConvert.SerializeObject(requestBody);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var requestUrl = $"{API_BASE}/{CurrentModel}:generateContent?key={apiKey}";
            
            RhinoApp.WriteLine($"[AI渲染] 发送请求到 {CurrentModel}...");

            var response = await _httpClient.PostAsync(requestUrl, content, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                RhinoApp.WriteLine($"[AI渲染] API 错误响应: {responseBody}");
                throw new HttpRequestException($"API 请求失败: {response.StatusCode} - {ExtractErrorMessage(responseBody)}");
            }

            // 解析响应，提取生成的图像
            var generatedImage = ParseImageFromResponse(responseBody);
            
            if (generatedImage == null || generatedImage.Length == 0)
            {
                RhinoApp.WriteLine("[AI渲染] 警告：API 未返回图像，将返回原图");
                return (referenceImage, Guid.NewGuid().ToString("N")[..8]);
            }

            var requestId = Guid.NewGuid().ToString("N")[..8];
            RhinoApp.WriteLine($"[AI渲染] 成功获取生成图像，大小: {generatedImage.Length} 字节");
            
            return (generatedImage, requestId);
        }

        /// <summary>
        /// 从 Gemini API 响应中解析图像
        /// </summary>
        private byte[]? ParseImageFromResponse(string responseJson)
        {
            try
            {
                var json = JObject.Parse(responseJson);
                
                var candidates = json["candidates"] as JArray;
                if (candidates == null || candidates.Count == 0)
                {
                    RhinoApp.WriteLine("[AI渲染] 响应中没有 candidates");
                    return null;
                }

                var content = candidates[0]?["content"];
                var parts = content?["parts"] as JArray;
                
                if (parts == null)
                {
                    RhinoApp.WriteLine("[AI渲染] 响应中没有 parts");
                    return null;
                }

                foreach (var part in parts)
                {
                    // 检查 inlineData
                    var inlineData = part["inlineData"];
                    if (inlineData != null)
                    {
                        var mimeType = inlineData["mimeType"]?.ToString();
                        var data = inlineData["data"]?.ToString();
                        
                        if (!string.IsNullOrEmpty(data) && mimeType?.StartsWith("image/") == true)
                        {
                            RhinoApp.WriteLine($"[AI渲染] 找到内联图像，类型: {mimeType}");
                            return Convert.FromBase64String(data);
                        }
                    }

                    // 检查 inline_data
                    var inline_data = part["inline_data"];
                    if (inline_data != null)
                    {
                        var mimeType = inline_data["mime_type"]?.ToString();
                        var data = inline_data["data"]?.ToString();
                        
                        if (!string.IsNullOrEmpty(data) && mimeType?.StartsWith("image/") == true)
                        {
                            RhinoApp.WriteLine($"[AI渲染] 找到 inline_data 图像，类型: {mimeType}");
                            return Convert.FromBase64String(data);
                        }
                    }

                    var text = part["text"]?.ToString();
                    if (!string.IsNullOrEmpty(text))
                    {
                        RhinoApp.WriteLine($"[AI渲染] API 文本响应: {text.Substring(0, Math.Min(100, text.Length))}...");
                    }
                }

                RhinoApp.WriteLine("[AI渲染] 响应中未找到图像数据");
                return null;
            }
            catch (Exception ex)
            {
                RhinoApp.WriteLine($"[AI渲染] 解析响应失败: {ex.Message}");
                return null;
            }
        }

        private string ExtractErrorMessage(string responseJson)
        {
            try
            {
                var json = JObject.Parse(responseJson);
                var error = json["error"];
                if (error != null)
                {
                    var message = error["message"]?.ToString();
                    var status = error["status"]?.ToString();
                    return $"{status}: {message}";
                }
                return responseJson.Length > 200 ? responseJson.Substring(0, 200) + "..." : responseJson;
            }
            catch
            {
                return responseJson.Length > 200 ? responseJson.Substring(0, 200) + "..." : responseJson;
            }
        }
    }
}
