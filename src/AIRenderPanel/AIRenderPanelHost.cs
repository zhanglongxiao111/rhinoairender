using System.Reflection;
using Newtonsoft.Json;
using Rhino;
using Rhino.UI;
using AIRenderPanel.Bridge;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace AIRenderPanel
{
    /// <summary>
    /// AI 渲染面板宿主 - 使用 WinForms UserControl 承载 WebView2
    /// </summary>
    [System.Runtime.InteropServices.Guid("B1C2D3E4-F5A6-7890-BCDE-F12345678901")]
    public class AIRenderPanelHost : System.Windows.Forms.UserControl, IPanel
    {
        private WebView2? _webView;
        private MessageHandler? _messageHandler;
        private bool _isInitialized = false;
        private readonly Queue<BridgeMessage> _pendingMessages = new();

        // 开发模式下的前端地址
        private const string DEV_SERVER_URL = "http://localhost:5173";

        public static Guid PanelId => typeof(AIRenderPanelHost).GUID;

        public AIRenderPanelHost()
        {
            // 创建 WebView2 控件
            _webView = new WebView2();
            _webView.Dock = System.Windows.Forms.DockStyle.Fill;
            _webView.CoreWebView2InitializationCompleted += OnWebView2Initialized;
            
            // 添加到 UserControl
            Controls.Add(_webView);

            // 初始化消息处理器
            _messageHandler = new MessageHandler(SendMessageToWeb);

            // 初始化 WebView2
            InitializeWebView2Async();
        }

        private async void InitializeWebView2Async()
        {
            try
            {
                // 设置用户数据目录
                var userDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "AIRenderPanel",
                    "WebView2"
                );

                // 确保目录存在
                if (!Directory.Exists(userDataFolder))
                {
                    Directory.CreateDirectory(userDataFolder);
                }

                var options = new CoreWebView2EnvironmentOptions();
                var environment = await CoreWebView2Environment.CreateAsync(
                    null, 
                    userDataFolder, 
                    options
                );

                await _webView!.EnsureCoreWebView2Async(environment);
            }
            catch (Exception ex)
            {
                RhinoApp.WriteLine($"[AI渲染] WebView2 初始化失败: {ex.Message}");
            }
        }

        private void OnWebView2Initialized(object? sender, CoreWebView2InitializationCompletedEventArgs e)
        {
            if (!e.IsSuccess)
            {
                RhinoApp.WriteLine($"[AI渲染] WebView2 初始化错误: {e.InitializationException?.Message}");
                return;
            }

            if (_webView?.CoreWebView2 == null) return;

            // 设置 WebView2
            _webView.CoreWebView2.Settings.IsScriptEnabled = true;
            _webView.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = true;
            _webView.CoreWebView2.Settings.IsWebMessageEnabled = true;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = true;

            // 监听 Web 消息
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            // 导航完成后发送初始数据
            _webView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;

            // 加载 UI
            LoadUI();

            _isInitialized = true;
            RhinoApp.WriteLine("[AI渲染] WebView2 初始化完成");
        }

        private void LoadUI()
        {
            if (_webView?.CoreWebView2 == null) return;

            // 检查是否为开发模式
            var isDev = IsDevMode();

            if (isDev)
            {
                // 开发模式：连接 Vite dev server
                RhinoApp.WriteLine($"[AI渲染] 开发模式：加载 {DEV_SERVER_URL}");
                _webView.CoreWebView2.Navigate(DEV_SERVER_URL);
            }
            else
            {
                // 生产模式：加载嵌入资源或本地文件
                var localPath = GetLocalUIPath();
                if (!string.IsNullOrEmpty(localPath))
                {
                    RhinoApp.WriteLine($"[AI渲染] 加载本地文件: {localPath}");
                    _webView.CoreWebView2.Navigate(localPath);
                }
                else
                {
                    // 回退：显示简单的错误页面
                    var errorHtml = GetFallbackHtml();
                    _webView.CoreWebView2.NavigateToString(errorHtml);
                }
            }
        }

        private bool IsDevMode()
        {
            // 检查开发服务器是否可用
            try
            {
                using var client = new System.Net.Http.HttpClient();
                client.Timeout = TimeSpan.FromSeconds(1);
                var response = client.GetAsync(DEV_SERVER_URL).Result;
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        private string? GetLocalUIPath()
        {
            // 首先尝试从嵌入资源提取
            var extractedPath = ExtractEmbeddedWebUI();
            if (!string.IsNullOrEmpty(extractedPath))
            {
                RhinoApp.WriteLine($"[AI渲染] 使用嵌入资源: {extractedPath}");
                return extractedPath;
            }

            // 查找 Web UI 目录（开发时的备用路径）
            var assemblyDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            if (string.IsNullOrEmpty(assemblyDir)) return null;

            var possiblePaths = new[]
            {
                Path.Combine(assemblyDir, "WebUI", "index.html"),
                Path.Combine(assemblyDir, "..", "web-ui", "dist", "index.html"),
                Path.Combine(assemblyDir, "web-ui", "dist", "index.html"),
            };

            foreach (var path in possiblePaths)
            {
                var fullPath = Path.GetFullPath(path);
                if (File.Exists(fullPath))
                {
                    return "file:///" + fullPath.Replace("\\", "/");
                }
            }

            return null;
        }

        /// <summary>
        /// 从嵌入资源提取 Web UI 文件
        /// </summary>
        private string? ExtractEmbeddedWebUI()
        {
            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                var resourceNames = assembly.GetManifestResourceNames();
                
                // 查找 WebUI 相关资源
                var webUIResources = resourceNames.Where(n => n.Contains("WebUI")).ToList();
                
                if (webUIResources.Count == 0)
                {
                    RhinoApp.WriteLine("[AI渲染] 未找到嵌入的 Web UI 资源");
                    foreach (var name in resourceNames)
                    {
                        RhinoApp.WriteLine($"[AI渲染] 可用资源: {name}");
                    }
                    return null;
                }

                // 提取到临时目录
                var extractDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "AIRenderPanel",
                    "WebUI"
                );

                // 确保目录存在
                if (!Directory.Exists(extractDir))
                {
                    Directory.CreateDirectory(extractDir);
                }

                // 提取所有资源
                foreach (var resourceName in webUIResources)
                {
                    using var stream = assembly.GetManifestResourceStream(resourceName);
                    if (stream == null) continue;

                    // 从资源名称解析文件路径
                    // 格式: AIRenderPanel.WebUI.index.html -> index.html
                    // 格式: AIRenderPanel.WebUI.assets.index-xxx.js -> assets/index-xxx.js
                    var relativePath = resourceName.Replace("AIRenderPanel.WebUI.", "");
                    
                    // 处理 assets 子目录
                    if (relativePath.StartsWith("assets."))
                    {
                        var assetsDir = Path.Combine(extractDir, "assets");
                        if (!Directory.Exists(assetsDir))
                        {
                            Directory.CreateDirectory(assetsDir);
                        }
                        relativePath = Path.Combine("assets", relativePath.Substring("assets.".Length));
                    }

                    var filePath = Path.Combine(extractDir, relativePath);

                    // 只在文件不存在或资源更新时提取
                    using var reader = new BinaryReader(stream);
                    var bytes = reader.ReadBytes((int)stream.Length);
                    File.WriteAllBytes(filePath, bytes);
                }

                var indexPath = Path.Combine(extractDir, "index.html");
                if (File.Exists(indexPath))
                {
                    return "file:///" + indexPath.Replace("\\", "/");
                }

                RhinoApp.WriteLine($"[AI渲染] index.html 未找到于 {extractDir}");
                return null;
            }
            catch (Exception ex)
            {
                RhinoApp.WriteLine($"[AI渲染] 提取 Web UI 失败: {ex.Message}");
                return null;
            }
        }

        private string GetFallbackHtml()
        {
            return @"
<!DOCTYPE html>
<html lang='zh-CN'>
<head>
    <meta charset='UTF-8'>
    <style>
        body {
            font-family: 'Microsoft YaHei', sans-serif;
            background: #1a1a2e;
            color: #eee;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        h1 { color: #e94560; }
        p { color: #888; margin: 10px 0; }
        code { background: #333; padding: 4px 8px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>AI 渲染面板</h1>
    <p>Web UI 未加载</p>
    <p>请确保已构建前端：</p>
    <code>cd src/web-ui && npm install && npm run build</code>
    <p style='margin-top: 20px;'>或启动开发服务器：</p>
    <code>cd src/web-ui && npm run dev</code>
</body>
</html>";
        }

        private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (!e.IsSuccess)
            {
                RhinoApp.WriteLine($"[AI渲染] 页面加载失败");
                return;
            }

            RhinoApp.WriteLine("[AI渲染] 页面加载完成");

            // 发送待处理消息
            while (_pendingMessages.Count > 0)
            {
                var message = _pendingMessages.Dequeue();
                SendMessageToWebInternal(message);
            }

            // 发送初始数据
            _ = _messageHandler?.HandleMessageAsync(JsonConvert.SerializeObject(new BridgeMessage { Type = "listNamedViews" }));
            _ = _messageHandler?.HandleMessageAsync(JsonConvert.SerializeObject(new BridgeMessage { Type = "getSettings" }));
            _ = _messageHandler?.HandleMessageAsync(JsonConvert.SerializeObject(new BridgeMessage { Type = "getHistory" }));
        }

        private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            var messageJson = e.WebMessageAsJson;
            if (string.IsNullOrEmpty(messageJson)) return;

            // 去除 JSON 字符串外层的引号（如果有）
            if (messageJson.StartsWith("\"") && messageJson.EndsWith("\""))
            {
                messageJson = JsonConvert.DeserializeObject<string>(messageJson) ?? messageJson;
            }

            if (_messageHandler != null)
            {
                await _messageHandler.HandleMessageAsync(messageJson);
            }
        }

        /// <summary>
        /// 发送消息到 Web UI
        /// </summary>
        private void SendMessageToWeb(string type, object? data)
        {
            var message = new BridgeMessage { Type = type, Data = data };

            if (!_isInitialized)
            {
                _pendingMessages.Enqueue(message);
                return;
            }

            SendMessageToWebInternal(message);
        }

        private void SendMessageToWebInternal(BridgeMessage message)
        {
            if (_webView?.CoreWebView2 == null) return;

            var json = JsonConvert.SerializeObject(message);
            
            // 在 UI 线程上执行
            if (InvokeRequired)
            {
                Invoke(() => _webView.CoreWebView2.PostWebMessageAsJson(json));
            }
            else
            {
                _webView.CoreWebView2.PostWebMessageAsJson(json);
            }
        }

        /// <summary>
        /// 打开开发者工具
        /// </summary>
        public void OpenDevTools()
        {
            _webView?.CoreWebView2?.OpenDevToolsWindow();
        }

        #region IPanel 接口实现

        public void PanelShown(uint documentSerialNumber, ShowPanelReason reason)
        {
            RhinoApp.WriteLine("[AI渲染] 面板已显示");
        }

        public void PanelHidden(uint documentSerialNumber, ShowPanelReason reason)
        {
            RhinoApp.WriteLine("[AI渲染] 面板已隐藏");
        }

        public void PanelClosing(uint documentSerialNumber, bool onCloseDocument)
        {
            RhinoApp.WriteLine("[AI渲染] 面板正在关闭");
        }

        #endregion
    }
}
