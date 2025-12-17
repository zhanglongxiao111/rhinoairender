using Newtonsoft.Json;

namespace AIRenderPanel.Bridge
{
    /// <summary>
    /// C# 与 Web UI 之间的消息格式
    /// </summary>
    public class BridgeMessage
    {
        [JsonProperty("type")]
        public string Type { get; set; } = string.Empty;

        [JsonProperty("data")]
        public object? Data { get; set; }
    }

    #region Web → C# 消息数据

    /// <summary>
    /// 截图预览请求
    /// </summary>
    public class CapturePreviewRequest
    {
        [JsonProperty("source")]
        public string Source { get; set; } = "active"; // "active" | "named"

        [JsonProperty("namedView")]
        public string? NamedView { get; set; }

        [JsonProperty("width")]
        public int Width { get; set; } = 1024;

        [JsonProperty("height")]
        public int Height { get; set; } = 1024;

        [JsonProperty("transparent")]
        public bool Transparent { get; set; } = false;

        [JsonProperty("longEdge")]
        public int LongEdge { get; set; } = 0;

        [JsonProperty("aspectRatio")]
        public string? AspectRatio { get; set; }
    }

    /// <summary>
    /// 生成请求
    /// </summary>
    public class GenerateRequest
    {
        [JsonProperty("prompt")]
        public string Prompt { get; set; } = string.Empty;

        [JsonProperty("negativePrompt")]
        public string? NegativePrompt { get; set; }

        [JsonProperty("source")]
        public string Source { get; set; } = "active";

        [JsonProperty("namedView")]
        public string? NamedView { get; set; }

        [JsonProperty("width")]
        public int Width { get; set; } = 1024;

        [JsonProperty("height")]
        public int Height { get; set; } = 1024;

        [JsonProperty("count")]
        public int Count { get; set; } = 1;

        /// <summary>
        /// 分辨率：1K, 2K, 4K（大写）
        /// </summary>
        [JsonProperty("resolution")]
        public string? Resolution { get; set; } = "1K";

        /// <summary>
        /// 比例：1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 4:5, 5:4, 21:9
        /// 空或不传表示 Auto
        /// </summary>
        [JsonProperty("aspectRatio")]
        public string? AspectRatio { get; set; }

        /// <summary>
        /// 生成模式：pro（专业模式）| flash（快速模式）
        /// </summary>
        [JsonProperty("mode")]
        public string Mode { get; set; } = "pro";

        /// <summary>
        /// 对比度调整（仅快速模式有效）
        /// 范围 0 到 -100，默认 -92
        /// </summary>
        [JsonProperty("contrastAdjust")]
        public int ContrastAdjust { get; set; } = -92;

        /// <summary>
        /// 截图长边尺寸（像素）
        /// 与 AspectRatio 配合使用，短边自动计算
        /// 如果为 0 或不传，则使用 Width/Height
        /// </summary>
        [JsonProperty("longEdge")]
        public int LongEdge { get; set; } = 0;

        /// <summary>
        /// 截图尺寸来源：viewport（使用视口尺寸）| custom（使用自定义尺寸）
        /// </summary>
        [JsonProperty("captureMode")]
        public string CaptureMode { get; set; } = "custom";
    }

    /// <summary>
    /// 设置请求
    /// </summary>
    public class SettingsData
    {
        [JsonProperty("outputMode")]
        public string OutputMode { get; set; } = "auto"; // "auto" | "fixed"

        [JsonProperty("outputFolder")]
        public string? OutputFolder { get; set; }

        [JsonProperty("apiKey")]
        public string? ApiKey { get; set; }

        [JsonProperty("provider")]
        public string Provider { get; set; } = "mock";

        [JsonProperty("devMode")]
        public bool DevMode { get; set; } = false;

        /// <summary>
        /// 代理地址，例如 http://127.0.0.1:7890
        /// 留空则使用系统代理
        /// </summary>
        [JsonProperty("proxyUrl")]
        public string? ProxyUrl { get; set; }
    }

    /// <summary>
    /// 打开文件夹请求
    /// </summary>
    public class OpenFolderRequest
    {
        [JsonProperty("path")]
        public string Path { get; set; } = string.Empty;
    }

    #endregion

    #region C# → Web 消息数据

    /// <summary>
    /// 命名视图列表
    /// </summary>
    public class NamedViewsResponse
    {
        [JsonProperty("items")]
        public List<string> Items { get; set; } = new();
    }

    /// <summary>
    /// 预览图片响应
    /// </summary>
    public class PreviewImageResponse
    {
        [JsonProperty("base64")]
        public string Base64 { get; set; } = string.Empty;

        [JsonProperty("width")]
        public int Width { get; set; }

        [JsonProperty("height")]
        public int Height { get; set; }
    }

    /// <summary>
    /// 生成进度
    /// </summary>
    public class GenerateProgressResponse
    {
        [JsonProperty("stage")]
        public string Stage { get; set; } = string.Empty;

        [JsonProperty("message")]
        public string Message { get; set; } = string.Empty;

        [JsonProperty("percent")]
        public int? Percent { get; set; }
    }

    /// <summary>
    /// 生成结果
    /// </summary>
    public class GenerateResultResponse
    {
        [JsonProperty("images")]
        public List<string> Images { get; set; } = new(); // base64 列表

        [JsonProperty("paths")]
        public List<string> Paths { get; set; } = new(); // 保存路径列表

        [JsonProperty("meta")]
        public GenerateMetadata? Meta { get; set; }
    }

    /// <summary>
    /// 生成元数据
    /// </summary>
    public class GenerateMetadata
    {
        [JsonProperty("provider")]
        public string Provider { get; set; } = string.Empty;

        [JsonProperty("model")]
        public string? Model { get; set; }

        [JsonProperty("requestId")]
        public string? RequestId { get; set; }

        [JsonProperty("timestamp")]
        public DateTime Timestamp { get; set; } = DateTime.Now;
    }

    /// <summary>
    /// 错误响应
    /// </summary>
    public class ErrorResponse
    {
        [JsonProperty("message")]
        public string Message { get; set; } = string.Empty;

        [JsonProperty("details")]
        public string? Details { get; set; }
    }

    /// <summary>
    /// 历史记录项
    /// </summary>
    public class HistoryItem
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;

        [JsonProperty("timestamp")]
        public DateTime Timestamp { get; set; }

        [JsonProperty("prompt")]
        public string Prompt { get; set; } = string.Empty;

        [JsonProperty("source")]
        public string Source { get; set; } = string.Empty;

        [JsonProperty("namedView")]
        public string? NamedView { get; set; }

        [JsonProperty("width")]
        public int Width { get; set; }

        [JsonProperty("height")]
        public int Height { get; set; }

        [JsonProperty("thumbnails")]
        public List<string> Thumbnails { get; set; } = new(); // base64 缩略图

        [JsonProperty("paths")]
        public List<string> Paths { get; set; } = new();

        [JsonProperty("provider")]
        public string Provider { get; set; } = string.Empty;
    }

    /// <summary>
    /// 历史更新响应
    /// </summary>
    public class HistoryUpdateResponse
    {
        [JsonProperty("items")]
        public List<HistoryItem> Items { get; set; } = new();
    }

    /// <summary>
    /// 加载历史图片请求
    /// </summary>
    public class LoadHistoryImagesRequest
    {
        [JsonProperty("paths")]
        public List<string> Paths { get; set; } = new();
    }

    /// <summary>
    /// 历史图片响应
    /// </summary>
    public class HistoryImagesResponse
    {
        [JsonProperty("images")]
        public List<string> Images { get; set; } = new();
    }

    #endregion
}
