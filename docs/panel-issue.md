# Rhino 8 插件面板问题：Panel 显示 "容器是空的"

## 问题描述

我正在开发一个 Rhino 8 插件，使用 WinForms UserControl 承载 WebView2 控件作为 Panel。插件可以正常加载，但打开面板时显示 **"'AI 渲染' 容器是空的"**，面板内容无法显示。

## 环境

- **Rhino 版本**: Rhino 8 (最新版)
- **开发语言**: C# (.NET 7.0-windows)
- **目标框架**: net7.0-windows
- **UI 控件**: WinForms UserControl + WebView2

## 现象

1. 插件加载成功，命令行显示 "AI 渲染面板插件已加载"
2. 执行 `AIRenderPanel` 命令后，弹出一个容器窗口
3. 容器窗口显示 **"'AI 渲染' 容器是空的"**
4. **关键问题**：Panel 的构造函数从未被调用（没有看到构造函数中的日志输出）

## 代码结构

### 1. 插件入口 (AIRenderPanelPlugin.cs)

```csharp
using Rhino;
using Rhino.PlugIns;
using Rhino.UI;

[assembly: Guid("A1B2C3D4-E5F6-7890-ABCD-EF1234567890")]

namespace AIRenderPanel
{
    public class AIRenderPanelPlugin : PlugIn
    {
        protected override LoadReturnCode OnLoad(ref string errorMessage)
        {
            // 注册面板
            Panels.RegisterPanel(
                this,
                typeof(AIRenderPanelHost),
                "AI 渲染",
                System.Drawing.SystemIcons.Application,
                PanelType.System  // 也试过 PanelType.PerDoc
            );

            RhinoApp.WriteLine("AI 渲染面板插件已加载");
            return LoadReturnCode.Success;
        }
    }
}
```

### 2. 面板控件 (AIRenderPanelHost.cs)

```csharp
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

namespace AIRenderPanel
{
    [System.Runtime.InteropServices.Guid("B1C2D3E4-F5A6-7890-BCDE-F12345678901")]
    public class AIRenderPanelHost : UserControl
    {
        private WebView2? _webView;

        public static Guid PanelId => typeof(AIRenderPanelHost).GUID;

        // 无参构造函数
        public AIRenderPanelHost() : this(0)
        {
        }

        // 带文档序列号的构造函数
        public AIRenderPanelHost(uint documentSerialNumber)
        {
            RhinoApp.WriteLine($"[AI渲染] 正在创建面板控件... (Doc: {documentSerialNumber})");
            
            // 创建 WebView2 控件
            _webView = new WebView2();
            _webView.Dock = DockStyle.Fill;
            Controls.Add(_webView);
        }
    }
}
```

### 3. 命令 (AIRenderPanelCommand.cs)

```csharp
using Rhino.Commands;
using Rhino.UI;

namespace AIRenderPanel
{
    public class AIRenderPanelCommand : Command
    {
        public override string EnglishName => "AIRenderPanel";

        protected override Result RunCommand(RhinoDoc doc, RunMode mode)
        {
            Panels.OpenPanel(typeof(AIRenderPanelHost));
            return Result.Success;
        }
    }
}
```

### 4. 项目文件 (AIRenderPanel.csproj)

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net7.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="RhinoCommon" Version="8.0.23304.9001" />
    <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.2420.47" />
  </ItemGroup>
</Project>
```

## 已尝试的解决方案

1. ✅ 移除 `IPanel` 接口实现（官方示例不用）
2. ✅ 移除 `partial` 关键字
3. ✅ 尝试 `PanelType.System` 和 `PanelType.PerDoc`
4. ✅ 添加带 `uint documentSerialNumber` 参数的构造函数
5. ✅ 清理注册表后重新安装
6. ✅ 添加简单的 Label 控件测试

## 问题核心

**Panel 的构造函数从未被调用**。Rhino 8 注册了面板，创建了容器，但没有实例化 `AIRenderPanelHost` 类。

## 需要解答的问题

1. Rhino 8 的 Panel 系统是否有特殊要求？
2. 容器 (Container) 和面板 (Panel) 的关系是什么？
3. 为什么 `Panels.RegisterPanel` 成功但 Panel 没有被实例化？
4. 是否需要 `.rui` 文件或其他配置？
5. WinForms UserControl 在 Rhino 8 中是否仍然支持作为 Panel？

## 参考

- [McNeel rhino-developer-samples](https://github.com/mcneel/rhino-developer-samples/tree/8/rhinocommon/cs/SampleCsWinForms)
- [Rhino.UI.Panels API](https://developer.rhino3d.com/api/rhinocommon/rhino.ui.panels)

## 项目仓库

https://github.com/zhanglongxiao111/rhinoairender
