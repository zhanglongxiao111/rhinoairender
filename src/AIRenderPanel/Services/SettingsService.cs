using Newtonsoft.Json;
using AIRenderPanel.Bridge;

namespace AIRenderPanel.Services
{
    /// <summary>
    /// 设置服务
    /// </summary>
    public class SettingsService
    {
        private readonly string _settingsPath;

        public SettingsService()
        {
            var appDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "AIRenderPanel"
            );
            if (!Directory.Exists(appDataDir))
            {
                Directory.CreateDirectory(appDataDir);
            }
            _settingsPath = Path.Combine(appDataDir, "settings.json");
        }

        /// <summary>
        /// 加载设置
        /// </summary>
        public SettingsData LoadSettings()
        {
            try
            {
                if (File.Exists(_settingsPath))
                {
                    var json = File.ReadAllText(_settingsPath);
                    var settings = JsonConvert.DeserializeObject<SettingsData>(json);
                    if (settings != null)
                    {
                        return settings;
                    }
                }
            }
            catch
            {
                // 读取失败则返回默认设置
            }

            return new SettingsData();
        }

        /// <summary>
        /// 保存设置
        /// </summary>
        public void SaveSettings(SettingsData settings)
        {
            try
            {
                var json = JsonConvert.SerializeObject(settings, Formatting.Indented);
                File.WriteAllText(_settingsPath, json);
            }
            catch (Exception ex)
            {
                Rhino.RhinoApp.WriteLine($"[AI渲染] 保存设置失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 获取日志目录
        /// </summary>
        public string GetLogDirectory()
        {
            var logDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "AIRenderPanel",
                "logs"
            );
            if (!Directory.Exists(logDir))
            {
                Directory.CreateDirectory(logDir);
            }
            return logDir;
        }
    }
}
