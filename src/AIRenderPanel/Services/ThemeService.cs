using Rhino;

namespace AIRenderPanel.Services
{
    /// <summary>
    /// 主题检测服务 - 读取 Rhino 主题并判断深浅色
    /// </summary>
    public class ThemeService
    {
        /// <summary>
        /// 检测当前 Rhino 是否使用深色主题
        /// </summary>
        /// <returns>true 表示深色主题，false 表示浅色主题</returns>
        public bool IsDarkTheme()
        {
            try
            {
                // 读取 Rhino 视口背景颜色
                var bgColor = Rhino.ApplicationSettings.AppearanceSettings.ViewportBackgroundColor;
                
                // 计算亮度（RGB 平均值）
                int brightness = (bgColor.R + bgColor.G + bgColor.B) / 3;
                
                // 如果亮度小于 128，则判定为深色主题
                return brightness < 128;
            }
            catch (System.Exception ex)
            {
                RhinoApp.WriteLine($"[AI渲染] 检测主题失败: {ex.Message}");
                // 默认返回浅色主题
                return false;
            }
        }
    }
}
