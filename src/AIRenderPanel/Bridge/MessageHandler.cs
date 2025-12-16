using System.Diagnostics;
using Newtonsoft.Json;
using Rhino;
using AIRenderPanel.Bridge;
using AIRenderPanel.Services;
using AIRenderPanel.Providers;

namespace AIRenderPanel.Bridge
{
    /// <summary>
    /// 处理 Web UI 发来的消息
    /// </summary>
    public class MessageHandler
    {
        private readonly Action<string, object?> _sendMessage;
        private readonly ViewportCaptureService _captureService;
        private readonly NamedViewService _namedViewService;
        private readonly HistoryService _historyService;
        private readonly SettingsService _settingsService;
        private readonly ProviderManager _providerManager;
        
        private CancellationTokenSource? _currentCts;

        public MessageHandler(Action<string, object?> sendMessage)
        {
            _sendMessage = sendMessage;
            _captureService = new ViewportCaptureService();
            _namedViewService = new NamedViewService();
            _historyService = new HistoryService();
            _settingsService = new SettingsService();
            _providerManager = new ProviderManager(_settingsService);
        }

        /// <summary>
        /// 处理来自 Web UI 的消息
        /// </summary>
        public async Task HandleMessageAsync(string messageJson)
        {
            try
            {
                var message = JsonConvert.DeserializeObject<BridgeMessage>(messageJson);
                if (message == null) return;

                RhinoApp.WriteLine($"[AI渲染] 收到消息: {message.Type}");

                switch (message.Type)
                {
                    case "listNamedViews":
                        HandleListNamedViews();
                        break;

                    case "capturePreview":
                        HandleCapturePreview(message.Data);
                        break;

                    case "generate":
                        await HandleGenerateAsync(message.Data);
                        break;

                    case "cancel":
                        HandleCancel();
                        break;

                    case "getSettings":
                        HandleGetSettings();
                        break;

                    case "setSettings":
                        HandleSetSettings(message.Data);
                        break;

                    case "openFolder":
                        HandleOpenFolder(message.Data);
                        break;

                    case "getHistory":
                        HandleGetHistory();
                        break;

                    default:
                        RhinoApp.WriteLine($"[AI渲染] 未知消息类型: {message.Type}");
                        break;
                }
            }
            catch (Exception ex)
            {
                RhinoApp.WriteLine($"[AI渲染] 消息处理错误: {ex.Message}");
                SendError("消息处理失败", ex.Message);
            }
        }

        private void HandleListNamedViews()
        {
            var names = _namedViewService.GetNamedViewNames();
            _sendMessage("namedViews", new NamedViewsResponse { Items = names });
        }

        private void HandleCapturePreview(object? data)
        {
            if (data == null) return;

            var request = JsonConvert.DeserializeObject<CapturePreviewRequest>(data.ToString()!);
            if (request == null) return;

            try
            {
                byte[] imageBytes;
                if (request.Source == "named" && !string.IsNullOrEmpty(request.NamedView))
                {
                    imageBytes = _captureService.CaptureNamedView(
                        request.NamedView, 
                        request.Width, 
                        request.Height, 
                        request.Transparent
                    );
                }
                else
                {
                    imageBytes = _captureService.CaptureActiveViewport(
                        request.Width, 
                        request.Height, 
                        request.Transparent
                    );
                }

                var base64 = Convert.ToBase64String(imageBytes);
                _sendMessage("previewImage", new PreviewImageResponse
                {
                    Base64 = base64,
                    Width = request.Width,
                    Height = request.Height
                });
            }
            catch (Exception ex)
            {
                SendError("截图失败", ex.Message);
            }
        }

        private async Task HandleGenerateAsync(object? data)
        {
            if (data == null) return;

            var request = JsonConvert.DeserializeObject<GenerateRequest>(data.ToString()!);
            if (request == null) return;

            _currentCts?.Cancel();
            _currentCts = new CancellationTokenSource();
            var token = _currentCts.Token;

            try
            {
                // 发送进度：截图中
                _sendMessage("generateProgress", new GenerateProgressResponse
                {
                    Stage = "capture",
                    Message = "正在截图...",
                    Percent = 10
                });

                // 截图
                byte[] imageBytes;
                if (request.Source == "named" && !string.IsNullOrEmpty(request.NamedView))
                {
                    imageBytes = _captureService.CaptureNamedView(
                        request.NamedView, 
                        request.Width, 
                        request.Height, 
                        false
                    );
                }
                else
                {
                    imageBytes = _captureService.CaptureActiveViewport(
                        request.Width, 
                        request.Height, 
                        false
                    );
                }

                token.ThrowIfCancellationRequested();

                // 发送进度：生成中
                _sendMessage("generateProgress", new GenerateProgressResponse
                {
                    Stage = "generate",
                    Message = "正在生成...",
                    Percent = 30
                });

                // 调用 Provider
                var provider = _providerManager.GetCurrentProvider();
                
                // 如果是 GeminiProvider，设置分辨率和比例参数
                if (provider is GeminiProvider geminiProvider)
                {
                    geminiProvider.SetGenerationParams(request.Resolution, request.AspectRatio);
                    RhinoApp.WriteLine($"[AI渲染] 使用 Gemini Provider, 分辨率: {request.Resolution}, 比例: {request.AspectRatio ?? "Auto"}");
                }
                
                var result = await provider.GenerateAsync(
                    request.Prompt,
                    imageBytes,
                    request.Count,
                    request.Width,
                    request.Height,
                    token
                );

                token.ThrowIfCancellationRequested();

                // 发送进度：保存中
                _sendMessage("generateProgress", new GenerateProgressResponse
                {
                    Stage = "save",
                    Message = "正在保存...",
                    Percent = 80
                });

                // 保存图片
                var savedPaths = _historyService.SaveGeneratedImages(
                    result.Images,
                    request.Prompt,
                    request.Source,
                    request.NamedView,
                    request.Width,
                    request.Height,
                    provider.Name
                );

                // 发送结果
                var imagesBase64 = result.Images.Select(img => Convert.ToBase64String(img)).ToList();
                _sendMessage("generateResult", new GenerateResultResponse
                {
                    Images = imagesBase64,
                    Paths = savedPaths,
                    Meta = new GenerateMetadata
                    {
                        Provider = provider.Name,
                        Model = result.Model,
                        RequestId = result.RequestId,
                        Timestamp = DateTime.Now
                    }
                });

                // 更新历史
                HandleGetHistory();
            }
            catch (OperationCanceledException)
            {
                RhinoApp.WriteLine("[AI渲染] 生成已取消");
                _sendMessage("generateProgress", new GenerateProgressResponse
                {
                    Stage = "cancelled",
                    Message = "已取消",
                    Percent = 0
                });
            }
            catch (Exception ex)
            {
                SendError("生成失败", ex.Message);
            }
            finally
            {
                _currentCts = null;
            }
        }

        private void HandleCancel()
        {
            _currentCts?.Cancel();
        }

        private void HandleGetSettings()
        {
            var settings = _settingsService.LoadSettings();
            _sendMessage("settings", settings);
        }

        private void HandleSetSettings(object? data)
        {
            if (data == null) return;

            var settings = JsonConvert.DeserializeObject<SettingsData>(data.ToString()!);
            if (settings == null) return;

            _settingsService.SaveSettings(settings);
            _sendMessage("settings", settings);
        }

        private void HandleOpenFolder(object? data)
        {
            if (data == null) return;

            var request = JsonConvert.DeserializeObject<OpenFolderRequest>(data.ToString()!);
            if (request == null || string.IsNullOrEmpty(request.Path)) return;

            try
            {
                if (Directory.Exists(request.Path))
                {
                    Process.Start("explorer.exe", request.Path);
                }
                else if (File.Exists(request.Path))
                {
                    Process.Start("explorer.exe", $"/select,\"{request.Path}\"");
                }
            }
            catch (Exception ex)
            {
                SendError("打开文件夹失败", ex.Message);
            }
        }

        private void HandleGetHistory()
        {
            var items = _historyService.GetHistoryItems();
            _sendMessage("historyUpdate", new HistoryUpdateResponse { Items = items });
        }

        private void SendError(string message, string? details = null)
        {
            _sendMessage("error", new ErrorResponse
            {
                Message = message,
                Details = details
            });
        }
    }
}
