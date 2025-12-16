我看了你贴的代码/现象：插件 **OnLoad 注册成功**、命令能打开一个 “AI 渲染” 的**容器**，但 Rhino 显示 **“容器是空的”**，而且 `AIRenderPanelHost` 的构造函数日志完全没出现。

下面按你提的 5 个问题，把 Rhino 8 的机制讲清楚 + 给出最可能的原因和可操作的修复方案。

---

## 1) Rhino 8 的 Panel 系统有什么特殊要求？

核心要求其实还是老几条：**panel 类型必须是 public，且要有 public 构造函数：无参 / `uint` / `RhinoDoc` 之一**（Rhino 会用这些构造函数来反射创建实例）。([McNeel Forum](https://discourse.mcneel.com/t/rhinoceros-8-wpf-load-issue/173177 "Rhinoceros 8 WPF load issue - Rhino Developer - McNeel Forum"))

另外，官方也明确建议：**在 PlugIn 的 `OnLoad` 里 `Panels.RegisterPanel(...)`**，并且 Rhino 会在“第一次真正显示 panel 时”才去 new 你的控件。([www.rhino3d.com](https://developer.rhino3d.com/api/rhinocommon/rhino.ui.panels/registerpanel?utm_source=chatgpt.com "Panels.RegisterPanel method - Rhinoceros 3D"))

> 你现在的 `AIRenderPanelHost` 是 `public : UserControl`，也有无参和 `uint` 构造函数，理论上是满足条件的。

---

## 2) 容器 Container 和面板 Panel 的关系是什么？

Rhino 8 的 UI 改了：**容器（Container）是“承载 tab 的壳”**，一个容器里可以放 **Panels 和 Toolbars**，都以 tab 的形式出现。([www.rhino3d.com](https://developer.rhino3d.com/guides/general/rhino-ui-system/ "Rhino - The Rhino UI System"))

关键点在这两条（跟你现象直接相关）：

- **容器的定义/可见性/位置/大小会在 Rhino 关闭时保存，并在下次启动时恢复**。([www.rhino3d.com](https://developer.rhino3d.com/guides/general/rhino-ui-system/ "Rhino - The Rhino UI System"))

- 容器里保存的是“对某个 Panel 的引用”，并不保证此刻 panel 一定能被实例化出来。([www.rhino3d.com](https://developer.rhino3d.com/guides/general/rhino-ui-system/ "Rhino - The Rhino UI System"))

所以你看到的“AI 渲染 容器是空的”，本质上就是：**容器 tab 还在，但 Rhino 没能创建出该 tab 对应的 panel 控件实例**。

---

## 3) 为什么 RegisterPanel 成功但 Panel 没有被实例化？

结合 Rhino 8 的“容器会跨会话恢复”的机制，最常见的原因是下面两个（你这个 case 很像第 1 个）：

### 原因 A（最常见）：容器先恢复了，但插件当时没加载/没注册 panel

Rhino 8 启动时会恢复容器和 tab 引用；而 PlugIn 默认是**按需加载**，不一定会在启动时就 OnLoad（文档也强调了“插件通常按需加载，可通过 LoadTime 改变加载时机”）。([www.rhino3d.com](https://developer.rhino3d.com/api/rhinocommon/rhino.plugins.plugin "developer.rhino3d.com"))

结果就是：

- Rhino 恢复了 “AI 渲染” 这个 tab 引用

- 但此刻你的插件还没 OnLoad，自然也没 `RegisterPanel`

- 该 tab 就变成“空壳”，显示 **container is empty**

更坑的一点是：**即使你后来运行命令加载了插件，那个“已经存在的空 tab 引用”也未必会自动触发重新实例化**，所以你会感觉“构造函数从未被调用”。

### 原因 B：实例化时抛异常（Rhino 吞了），导致 tab 变空

例如依赖程序集加载失败、WebView2 初始化异常等，都会导致 Rhino 创建失败而只留下空容器。你虽然在构造函数里 `WriteLine`，但如果异常发生在 **base(UserControl) 构造** 或类型加载阶段，你那行日志确实不会出现。

---

## 4) 是否需要 .rui 或其他配置？

**不需要 `.rui` 才能显示 Panel。**  
RUI 在 Rhino 8 主要是“工具栏/宏库”的载体；Panel 属于“modeless UI”，靠 `RegisterPanel` 即可被 Rhino 识别并放入容器。([www.rhino3d.com](https://developer.rhino3d.com/guides/general/rhino-ui-system/ "Rhino - The Rhino UI System")) ([www.rhino3d.com](https://developer.rhino3d.com/api/rhinocommon/rhino.ui.panels/registerpanel?utm_source=chatgpt.com "Panels.RegisterPanel method - Rhinoceros 3D"))

---

## 5) WinForms UserControl 在 Rhino 8 仍然支持作为 Panel 吗？

**在 Windows 上可以。**  
但如果你有跨平台需求：WinForms 在 macOS 不可用，官方建议用 Eto。([McNeel Forum](https://discourse.mcneel.com/t/panels-openpanel-acts-differently-on-mac/208739?utm_source=chatgpt.com "Panels.OpenPanel acts differently on mac - Rhino Developer - McNeel Forum"))

---

# 给你一套“直接能验证/修复”的做法

## 方案 1：强制插件在启动时加载（优先推荐）

目的：让 `OnLoad -> RegisterPanel` 发生在 UI 恢复阶段之前/期间，避免出现“容器先恢复、panel 未注册”的空壳状态。

在你的 `PlugIn` 里 override `LoadTime`，改为启动加载（名字以 RhinoCommon 实际枚举为准）：

```csharp
public override Rhino.PlugIns.PlugInLoadTime LoadTime
  => Rhino.PlugIns.PlugInLoadTime.AtStartup;
```

这个建议来自 PlugIn 文档对 LoadTime 的描述：插件通常按需加载，但可以改加载时机。([www.rhino3d.com](https://developer.rhino3d.com/api/rhinocommon/rhino.plugins.plugin "developer.rhino3d.com"))  
你当前代码是在 `OnLoad` 注册 panel 的，这个方向是对的。

---

## 方案 2：把“空壳 tab”从容器里清掉（非常关键）

因为 Rhino 8 会把容器/布局持久化，**你可能一直在和一个“已保存的空引用”对抗**。([www.rhino3d.com](https://developer.rhino3d.com/guides/general/rhino-ui-system/ "Rhino - The Rhino UI System"))

操作建议（任选一种）：

- Rhino 命令行运行：`Containers`，在 UI 里把 “AI 渲染” 这个 tab 引用移除/删除对应容器，然后重启 Rhino。([www.rhino3d.com](https://developer.rhino3d.com/guides/general/rhino-ui-system/ "Rhino - The Rhino UI System"))

- 或用 `WindowLayout` 恢复一个干净布局（本质也是清容器引用）。([www.rhino3d.com](https://developer.rhino3d.com/guides/general/rhino-ui-system/ "Rhino - The Rhino UI System"))

---

## 方案 3：在命令里“先关再开”，强制重新创建

你的命令目前只是 `OpenPanel(typeof(AIRenderPanelHost))`。  
建议改成：

```csharp
Panels.ClosePanel(typeof(AIRenderPanelHost)); // 先干掉旧 tab/引用
Panels.OpenPanel(typeof(AIRenderPanelHost));  // 再打开，触发实例化
```

`ClosePanel(Type panelType)` 在 Panels API 里是明确存在的。([www.rhino3d.com](https://developer.rhino3d.com/api/rhinocommon/rhino.ui.panels?utm_source=chatgpt.com "Panels class - Rhinoceros 3D"))

---

## 方案 4：快速判断是不是“实例化异常被吞”

把 `AIRenderPanelHost` 临时改成完全不引用 WebView2 的纯 WinForms（新建一个 `TestPanelHost : UserControl`，项目里也暂时移除 WebView2 引用），只放一个 Label；然后用它注册/打开。  
如果这个能正常显示，那问题就集中在 WebView2 依赖/初始化（原因 B）；如果还是空，那基本就是原因 A + 布局持久化没清干净。

---

如果你愿意把仓库里 **生成出来的 .rhp/.dll 输出目录结构**（尤其是有没有把 RhinoCommon.dll / WebView2 的 dll 一起放旁边）也贴一下，我可以进一步把“依赖加载失败导致空 panel”这条线直接排干净。
