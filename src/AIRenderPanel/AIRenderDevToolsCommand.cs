using Rhino;
using Rhino.Commands;
using Rhino.UI;

namespace AIRenderPanel
{
    /// <summary>
    /// 打开 WebView2 开发者工具的命令
    /// </summary>
    public class AIRenderDevToolsCommand : Command
    {
        public override string EnglishName => "AIRenderDevTools";

        protected override Result RunCommand(RhinoDoc doc, RunMode mode)
        {
            // 获取面板实例并打开开发者工具
            var panel = Panels.GetPanel<AIRenderPanelHost>(doc);
            if (panel != null)
            {
                panel.OpenDevTools();
                RhinoApp.WriteLine("[AI渲染] 已打开开发者工具");
            }
            else
            {
                RhinoApp.WriteLine("[AI渲染] 面板未打开，请先执行 AIRenderPanel 命令");
            }
            return Result.Success;
        }
    }
}
