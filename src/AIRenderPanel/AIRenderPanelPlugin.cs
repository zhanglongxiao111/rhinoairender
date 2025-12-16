using Rhino;
using Rhino.PlugIns;
using Rhino.UI;
using System.Runtime.InteropServices;

// 插件 GUID
[assembly: Guid("A1B2C3D4-E5F6-7890-ABCD-EF1234567890")]
// 插件信息
[assembly: PlugInDescription(DescriptionType.Organization, "AI Render Panel")]
[assembly: PlugInDescription(DescriptionType.Email, "")]
[assembly: PlugInDescription(DescriptionType.Phone, "")]
[assembly: PlugInDescription(DescriptionType.Address, "")]
[assembly: PlugInDescription(DescriptionType.Country, "")]
[assembly: PlugInDescription(DescriptionType.WebSite, "")]

namespace AIRenderPanel
{
    /// <summary>
    /// AI 渲染面板插件入口
    /// </summary>
    public class AIRenderPanelPlugin : PlugIn
    {
        public static AIRenderPanelPlugin? Instance { get; private set; }

        public AIRenderPanelPlugin()
        {
            Instance = this;
        }

        /// <summary>
        /// 插件加载时注册 Dock Panel
        /// </summary>
        protected override LoadReturnCode OnLoad(ref string errorMessage)
        {
            try
            {
                // 注册面板
                Panels.RegisterPanel(
                    this,
                    typeof(AIRenderPanelHost),
                    "AI 渲染",
                    System.Drawing.SystemIcons.Application,
                    PanelType.PerDoc
                );

                RhinoApp.WriteLine("AI 渲染面板插件已加载");
                return LoadReturnCode.Success;
            }
            catch (Exception ex)
            {
                errorMessage = $"插件加载失败: {ex.Message}";
                RhinoApp.WriteLine(errorMessage);
                return LoadReturnCode.ErrorShowDialog;
            }
        }
    }
}
