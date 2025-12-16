using System.Drawing;
using System.Drawing.Imaging;
using Newtonsoft.Json;
using Rhino;
using AIRenderPanel.Bridge;

namespace AIRenderPanel.Services
{
    /// <summary>
    /// 历史记录服务
    /// </summary>
    public class HistoryService
    {
        private readonly SettingsService _settingsService;
        private const string AI_RENDERS_FOLDER = "_AI_Renders";
        private const int THUMBNAIL_SIZE = 128;

        public HistoryService()
        {
            _settingsService = new SettingsService();
        }

        /// <summary>
        /// 获取输出目录
        /// </summary>
        public string GetOutputDirectory()
        {
            var settings = _settingsService.LoadSettings();

            // 如果设置了固定输出目录
            if (settings.OutputMode == "fixed" && !string.IsNullOrEmpty(settings.OutputFolder))
            {
                if (!Directory.Exists(settings.OutputFolder))
                {
                    Directory.CreateDirectory(settings.OutputFolder);
                }
                return settings.OutputFolder;
            }

            // 默认：当前 3dm 文件同目录
            var doc = RhinoDoc.ActiveDoc;
            if (doc != null && !string.IsNullOrEmpty(doc.Path))
            {
                var docDir = Path.GetDirectoryName(doc.Path);
                if (!string.IsNullOrEmpty(docDir))
                {
                    var outputDir = Path.Combine(docDir, AI_RENDERS_FOLDER);
                    if (!Directory.Exists(outputDir))
                    {
                        Directory.CreateDirectory(outputDir);
                    }
                    return outputDir;
                }
            }

            // 回退：AppData 目录
            var appDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "AIRenderPanel",
                AI_RENDERS_FOLDER
            );
            if (!Directory.Exists(appDataDir))
            {
                Directory.CreateDirectory(appDataDir);
            }
            return appDataDir;
        }

        /// <summary>
        /// 保存生成的图片
        /// </summary>
        public List<string> SaveGeneratedImages(
            List<byte[]> images,
            string prompt,
            string source,
            string? namedView,
            int width,
            int height,
            string provider)
        {
            var outputDir = GetOutputDirectory();
            var timestamp = DateTime.Now;
            var sessionId = Guid.NewGuid().ToString("N")[..8];
            var savedPaths = new List<string>();

            // 创建会话目录
            var sessionDir = Path.Combine(
                outputDir,
                $"{timestamp:yyyy-MM-dd_HH-mm-ss}_{sessionId}"
            );
            Directory.CreateDirectory(sessionDir);

            // 保存每张图片
            for (int i = 0; i < images.Count; i++)
            {
                var fileName = images.Count == 1 
                    ? "output.png" 
                    : $"output_{i + 1}.png";
                var filePath = Path.Combine(sessionDir, fileName);
                File.WriteAllBytes(filePath, images[i]);
                savedPaths.Add(filePath);
            }

            // 保存元数据
            var metadata = new HistoryMetadata
            {
                Id = sessionId,
                Timestamp = timestamp,
                Prompt = prompt,
                Source = source,
                NamedView = namedView,
                Width = width,
                Height = height,
                Provider = provider,
                OutputPaths = savedPaths
            };
            var metadataPath = Path.Combine(sessionDir, "metadata.json");
            File.WriteAllText(metadataPath, JsonConvert.SerializeObject(metadata, Formatting.Indented));

            return savedPaths;
        }

        /// <summary>
        /// 获取历史记录列表
        /// </summary>
        public List<HistoryItem> GetHistoryItems()
        {
            var items = new List<HistoryItem>();
            var outputDir = GetOutputDirectory();

            if (!Directory.Exists(outputDir))
                return items;

            // 获取所有会话目录
            var sessionDirs = Directory.GetDirectories(outputDir)
                .OrderByDescending(d => Directory.GetCreationTime(d))
                .Take(50); // 最多显示 50 条

            foreach (var sessionDir in sessionDirs)
            {
                var metadataPath = Path.Combine(sessionDir, "metadata.json");
                if (!File.Exists(metadataPath))
                    continue;

                try
                {
                    var json = File.ReadAllText(metadataPath);
                    var metadata = JsonConvert.DeserializeObject<HistoryMetadata>(json);
                    if (metadata == null)
                        continue;

                    // 生成缩略图
                    var thumbnails = new List<string>();
                    foreach (var path in metadata.OutputPaths)
                    {
                        if (File.Exists(path))
                        {
                            var thumbnail = GenerateThumbnail(path);
                            if (!string.IsNullOrEmpty(thumbnail))
                            {
                                thumbnails.Add(thumbnail);
                            }
                        }
                    }

                    items.Add(new HistoryItem
                    {
                        Id = metadata.Id,
                        Timestamp = metadata.Timestamp,
                        Prompt = metadata.Prompt,
                        Source = metadata.Source,
                        NamedView = metadata.NamedView,
                        Width = metadata.Width,
                        Height = metadata.Height,
                        Thumbnails = thumbnails,
                        Paths = metadata.OutputPaths,
                        Provider = metadata.Provider
                    });
                }
                catch
                {
                    // 忽略解析错误的记录
                }
            }

            return items;
        }

        /// <summary>
        /// 生成缩略图（base64）
        /// </summary>
        private string? GenerateThumbnail(string imagePath)
        {
            try
            {
                using var original = Image.FromFile(imagePath);
                using var thumbnail = original.GetThumbnailImage(
                    THUMBNAIL_SIZE, 
                    THUMBNAIL_SIZE, 
                    () => false, 
                    IntPtr.Zero
                );
                using var ms = new MemoryStream();
                thumbnail.Save(ms, ImageFormat.Jpeg);
                return Convert.ToBase64String(ms.ToArray());
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 历史元数据（保存到文件）
        /// </summary>
        private class HistoryMetadata
        {
            public string Id { get; set; } = string.Empty;
            public DateTime Timestamp { get; set; }
            public string Prompt { get; set; } = string.Empty;
            public string Source { get; set; } = string.Empty;
            public string? NamedView { get; set; }
            public int Width { get; set; }
            public int Height { get; set; }
            public string Provider { get; set; } = string.Empty;
            public List<string> OutputPaths { get; set; } = new();
        }
    }
}
