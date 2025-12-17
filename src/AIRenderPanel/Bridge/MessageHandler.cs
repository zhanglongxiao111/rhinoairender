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
        private readonly FavoritesService _favoritesService;
        
        private CancellationTokenSource? _currentCts;

        public MessageHandler(Action<string, object?> sendMessage)
        {
            _sendMessage = sendMessage;
            _captureService = new ViewportCaptureService();
            _namedViewService = new NamedViewService();
            _historyService = new HistoryService();
            _settingsService = new SettingsService();
            _providerManager = new ProviderManager(_settingsService);
            _favoritesService = new FavoritesService();
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

                    case "loadHistoryImages":
                        HandleLoadHistoryImages(message.Data);
                        break;

                    case "toggleFavorite":
                        HandleToggleFavorite(message.Data);
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
                int width, height;

                // 根据 longEdge 决定如何获取截图尺寸
                if (request.LongEdge > 0)
                {
                    // 使用长边 + 比例计算尺寸
                    var (w, h) = _captureService.CalculateSize(request.AspectRatio, request.LongEdge);
                    width = w;
                    height = h;
                    
                    if (request.Source == "named" && !string.IsNullOrEmpty(request.NamedView))
                    {
                        imageBytes = _captureService.CaptureNamedViewWithAspect(
                            request.NamedView,
                            request.AspectRatio,
                            request.LongEdge,
                            request.Transparent
                        );
                    }
                    else
                    {
                        imageBytes = _captureService.CaptureActiveViewportWithAspect(
                            request.AspectRatio,
                            request.LongEdge,
                            request.Transparent
                        );
                    }
                }
                else
                {
                    // 使用传入的固定宽高
                    width = request.Width;
                    height = request.Height;
                    
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
                }

                var base64 = Convert.ToBase64String(imageBytes);
                _sendMessage("previewImage", new PreviewImageResponse
                {
                    Base64 = base64,
                    Width = width,
                    Height = height
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
                
                // 根据 captureMode 决定如何获取截图尺寸
                if (request.LongEdge > 0)
                {
                    // 使用长边 + 比例计算尺寸
                    if (request.Source == "named" && !string.IsNullOrEmpty(request.NamedView))
                    {
                        imageBytes = _captureService.CaptureNamedViewWithAspect(
                            request.NamedView,
                            request.AspectRatio,
                            request.LongEdge,
                            false
                        );
                    }
                    else
                    {
                        imageBytes = _captureService.CaptureActiveViewportWithAspect(
                            request.AspectRatio,
                            request.LongEdge,
                            false
                        );
                    }
                }
                else
                {
                    // 使用传入的固定宽高
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
                
                // 如果是 GeminiProvider，设置模式和参数
                if (provider is GeminiProvider geminiProvider)
                {
                    // 设置生成模式：pro = 专业模式，flash = 快速模式
                    bool useProMode = request.Mode?.ToLower() != "flash";
                    geminiProvider.SetMode(useProMode);
                    
                    // 设置生成参数（分辨率、比例）
                    geminiProvider.SetGenerationParams(request.Resolution, request.AspectRatio);
                    
                    // 快速模式下设置对比度调整
                    if (!useProMode)
                    {
                        geminiProvider.SetContrastAdjust(request.ContrastAdjust);
                    }
                    
                    // 设置 API 端点选项
                    var settings = _settingsService.LoadSettings();
                    geminiProvider.SetApiEndpoints(settings.UseGeminiApi, settings.UseVertexAI);
                    
                    RhinoApp.WriteLine($"[AI渲染] 使用 Gemini Provider, 模式: {(useProMode ? "专业" : "快速")}, 分辨率: {request.Resolution}, 比例: {request.AspectRatio ?? "Auto"}");
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

                // 保存图片和原始截图
                var (savedPaths, _) = _historyService.SaveGeneratedImages(
                    result.Images,
                    imageBytes, // 原始截图
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
            var favoriteIds = _favoritesService.GetFavoriteIds();
            
            // 标记收藏状态
            foreach (var item in items)
            {
                item.IsFavorite = favoriteIds.Contains(item.Id);
            }
            
            _sendMessage("historyUpdate", new HistoryUpdateResponse 
            { 
                Items = items,
                FavoriteIds = favoriteIds.ToList()
            });
        }

        private void HandleLoadHistoryImages(object? data)
        {
            if (data == null) return;

            try
            {
                var request = JsonConvert.DeserializeObject<LoadHistoryImagesRequest>(data.ToString()!);
                if (request == null || request.Paths == null) return;

                var images = new List<string>();
                foreach (var path in request.Paths)
                {
                    if (File.Exists(path))
                    {
                        var bytes = File.ReadAllBytes(path);
                        var base64 = Convert.ToBase64String(bytes);
                        images.Add($"data:image/png;base64,{base64}");
                    }
                }

                // 加载截图
                string? screenshot = null;
                if (!string.IsNullOrEmpty(request.ScreenshotPath) && File.Exists(request.ScreenshotPath))
                {
                    var screenshotBytes = File.ReadAllBytes(request.ScreenshotPath);
                    var screenshotBase64 = Convert.ToBase64String(screenshotBytes);
                    screenshot = $"data:image/png;base64,{screenshotBase64}";
                }

                _sendMessage("historyImages", new HistoryImagesResponse 
                { 
                    Images = images,
                    Screenshot = screenshot
                });
            }
            catch (Exception ex)
            {
                SendError("加载历史图片失败", ex.Message);
            }
        }

        private void SendError(string message, string? details = null)
        {
            _sendMessage("error", new ErrorResponse
            {
                Message = message,
                Details = details
            });
        }

        private void HandleToggleFavorite(object? data)
        {
            if (data == null) return;

            try
            {
                var request = JsonConvert.DeserializeObject<ToggleFavoriteRequest>(data.ToString()!);
                if (request == null || string.IsNullOrEmpty(request.HistoryId)) return;

                var isFavorite = _favoritesService.ToggleFavorite(request.HistoryId);
                
                _sendMessage("favoriteStatus", new FavoriteStatusResponse
                {
                    HistoryId = request.HistoryId,
                    IsFavorite = isFavorite
                });

                RhinoApp.WriteLine($"[AI渲染] 收藏状态切换: {request.HistoryId} -> {(isFavorite ? "已收藏" : "取消收藏")}");
            }
            catch (Exception ex)
            {
                SendError("切换收藏失败", ex.Message);
            }
        }
    }
}
