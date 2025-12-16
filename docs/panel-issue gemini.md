这是一个非常典型且隐蔽的 Rhino 8 .NET Core (Net 7) 插件开发问题。

从你的描述来看，核心症状是**"Panel 构造函数从未执行"**，但插件却显示加载成功。这通常不是代码逻辑错误，而是 **Runtime（运行时）的类型解析或依赖加载失败**。

在 .NET 7 + Rhino 8 环境下，如果类加载器（ClassLoader）在试图解析 `AIRenderPanelHost` 类型时，发现无法加载其字段（Fields）或属性中引用的某些依赖项（例如 `WebView2`），它会在进入构造函数**之前**就抛出 `TypeLoadException` 或 `FileNotFoundException`。Rhino 捕获了这个异常，导致无法实例化面板，从而显示“容器是空的”。

请按照以下步骤逐步排查和解决：

### 第一步：验证“依赖崩溃”假说 (最可能的原因)

即使你尝试过“添加 Label 测试”，但如果在同一个类中保留了 `private WebView2? _webView;` 的定义，类型解析依然会失败。

1. 彻底隔离测试：
   
   请修改 AIRenderPanelHost.cs，注释掉所有与 WebView2 相关的引用（包括 using 语句和字段定义）。
   
   C#
   
   ```
   using System.Windows.Forms;
   // using Microsoft.Web.WebView2.WinForms; // 注释掉
   
   namespace AIRenderPanel
   {
      [System.Runtime.InteropServices.Guid("B1C2D3E4-F5A6-7890-BCDE-F12345678901")]
      public class AIRenderPanelHost : UserControl
      {
          // private WebView2? _webView; // 必须注释掉这个字段定义！
   
          public static Guid PanelId => typeof(AIRenderPanelHost).GUID;
   
          public AIRenderPanelHost(uint documentSerialNumber)
          {
              RhinoApp.WriteLine($"[调试] 构造函数被调用 Doc: {documentSerialNumber}");
   
              InitializeComponent(); // 如果有 Designer
   
              Label testLabel = new Label() { Text = "Test Successful", Dock = DockStyle.Fill, AutoSize = true };
              Controls.Add(testLabel);
          }
   
          // 补全无参构造，防止 System 面板实例化失败
          public AIRenderPanelHost() : this(0) { }
      }
   }
   ```

2. 编译并运行：
   
   如果这次面板出现了并显示了 Label，那么问题100% 确认是 WebView2 的 DLL 文件没有被 Rhino 正确加载。

### 第二步：解决 WebView2 在 Rhino 8 中的加载问题

Rhino 8 使用 .NET Core 加载机制。当你引用 `Microsoft.Web.WebView2` NuGet 包时，它包含托管 DLL (`Microsoft.Web.WebView2.WinForms.dll`) 和非托管运行时 (`WebView2Loader.dll`)。

在构建时，.NET 7 可能会将这些文件放在 `bin\Debug\net7.0-windows\runtimes\` 文件夹下，或者没有将它们复制到与你的 `.rhp` 文件完全相同的目录中。

**解决方案：**

1. 修改 .csproj 文件：
   
   强制将依赖项复制到输出目录。添加 <CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies>。
   
   XML
   
   ```
   <PropertyGroup>
    <TargetFramework>net7.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies> 
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
   </PropertyGroup>
   ```

2. 检查构建输出：
   
   编译后，打开 bin\Debug\net7.0-windows\ (或 win-x64) 文件夹。
   
   确保以下文件与你的插件 .rhp (或 .dll) 在同一级目录下：
   
   - `Microsoft.Web.WebView2.WinForms.dll`
   
   - `Microsoft.Web.WebView2.Core.dll`
   
   - `WebView2Loader.dll` (这个最容易丢失，或者被藏在 `runtimes/win-x64/native/` 文件夹里)

> **特别注意**：Rhino 的插件加载器可能不会自动递归搜索 `runtimes` 文件夹。你需要确保 `WebView2Loader.dll` 位于插件根目录下，或者在代码中手动指定加载路径。

### 第三步：代码层面的修正 (GUID 与 构造函数)

虽然你提供的代码看起来不错，但为了保险起见，建议统一 GUID 的获取方式，并显式指定 Panel 类型。

**修改 `AIRenderPanelPlugin.cs`：**

C#

```
protected override LoadReturnCode OnLoad(ref string errorMessage)
{
    // 使用 UserControl 上的 GUID 属性，确保完全一致
    var panelType = typeof(AIRenderPanelHost);

    // 强制获取 PanelId，用于调试 GUID 是否读取正确
    var panelId = panelType.GUID; 
    RhinoApp.WriteLine($"注册面板 GUID: {panelId}");

    Panels.RegisterPanel(
        this,
        panelType,
        "AI 渲染",
        System.Drawing.SystemIcons.Application,
        PanelType.PerDoc // 推荐在 Rhino 8 中使用 PerDoc，配合 uint 构造函数
    );

    return LoadReturnCode.Success;
}
```

### 第四步：WebView2 初始化陷阱 (补充)

如果面板构造函数开始运行了，但随后崩溃或空白，这是因为 `WebView2` 是**异步初始化**的，不能直接在构造函数里完成所有工作。

修改 `AIRenderPanelHost.cs`：

C#

```
public AIRenderPanelHost(uint documentSerialNumber)
{
    InitializeComponent();
    // 不要直接在这里 await，构造函数不支持 async
    InitializeWebView();
}

private async void InitializeWebView()
{
    try 
    {
        _webView = new WebView2();
        _webView.Dock = DockStyle.Fill;
        this.Controls.Add(_webView);

        // 关键：显式初始化环境，确保能找到 Loader
        // 如果 WebView2Loader.dll 在插件目录下，通常不需要参数，
        // 但如果失败，可能需要指定 BrowserExecutableFolder
        await _webView.EnsureCoreWebView2Async(null);

        _webView.Source = new Uri("https://www.google.com");
    }
    catch (Exception ex)
    {
        MessageBox.Show($"WebView2 初始化失败: {ex.Message}");
    }
}
```

### 总结

你的代码逻辑没有大问题，问题出在 **.NET 7 机制下，Rhino 无法解析 `Microsoft.Web.WebView2` 相关的程序集**，导致在实例化 `AIRenderPanelHost` 之前就发生了静默崩溃。

**请按此顺序操作：**

1. **隔离测试**（注释掉 WebView2 字段）以确认这是依赖问题。

2. 在 `.csproj` 中添加 `<CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies>`。

3. 确保构建输出目录中包含 `WebView2Loader.dll` 等所有 DLL。

4. 如果你安装插件是通过“拖拽”方式，尝试使用 Rhino 的 `PluginManager` -> `Install` 并指向完整的 `bin` 目录，防止临时文件夹丢失依赖。
