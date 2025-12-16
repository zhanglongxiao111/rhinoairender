using Rhino;
using Rhino.Commands;
using Rhino.UI;

namespace AIRenderPanel
{
    /// <summary>
    /// 打开 AI 渲染面板的命令
    /// </summary>
    [CommandStyle(Style.ScriptRunner)]
    public class AIRenderPanelCommand : Command
    {
        public static AIRenderPanelCommand? Instance { get; private set; }

        public AIRenderPanelCommand()
        {
            Instance = this;
        }

        /// <summary>
        /// 命令名称
        /// </summary>
        public override string EnglishName => "AIRenderPanel";

        /// <summary>
        /// 执行命令：打开或激活 AI 渲染面板
        /// </summary>
        protected override Result RunCommand(RhinoDoc doc, RunMode mode)
        {
            // 先关闭再打开，强制触发重新实例化（解决空容器问题）
            Panels.ClosePanel(typeof(AIRenderPanelHost));
            Panels.OpenPanel(typeof(AIRenderPanelHost));
            return Result.Success;
        }
    }
}
