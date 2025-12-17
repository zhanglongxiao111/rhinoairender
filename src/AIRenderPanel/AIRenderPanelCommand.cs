using Rhino;
using Rhino.Commands;
using Rhino.UI;

namespace AIRenderPanel
{
    /// <summary>
    /// 打开 AI 渲染窗口的命令
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
        /// 执行命令：打开或激活 AI 渲染窗口
        /// </summary>
        protected override Result RunCommand(RhinoDoc doc, RunMode mode)
        {
            // 使用独立窗口模式
            AIRenderWindow.ShowWindow();
            return Result.Success;
        }
    }

    /// <summary>
    /// 切换 AI 渲染窗口显示状态的命令
    /// </summary>
    [CommandStyle(Style.ScriptRunner)]
    public class AIRenderToggleCommand : Command
    {
        public override string EnglishName => "AIRenderToggle";

        protected override Result RunCommand(RhinoDoc doc, RunMode mode)
        {
            AIRenderWindow.ToggleWindow();
            return Result.Success;
        }
    }

    /// <summary>
    /// 打开 AI 渲染 Dock Panel 的命令（备用）
    /// </summary>
    [CommandStyle(Style.ScriptRunner)]
    public class AIRenderDockCommand : Command
    {
        public override string EnglishName => "AIRenderDock";

        protected override Result RunCommand(RhinoDoc doc, RunMode mode)
        {
            // 使用传统 Dock Panel 模式
            Panels.ClosePanel(typeof(AIRenderPanelHost));
            Panels.OpenPanel(typeof(AIRenderPanelHost));
            return Result.Success;
        }
    }
}
