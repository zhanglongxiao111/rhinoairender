# Rhino 8 Windows「AI 渲染面板」需求文档（方案一：Dock Panel + WebView2 Web UI）

版本：v0.2  
日期：2025-12-17  
目标读者：编程 AI Agent / 插件开发者（C# RhinoCommon + Web UI）

---

## 1. 背景与目标

### 1.1 背景
用户在 Rhino 8（Windows）建模时，希望在 **Rhino 内部**通过一个**现代化、可停靠的面板 UI**完成以下闭环：

- 捕获 Rhino 视口截图（干净画面、无边框/标题）
- 可选择固定相机（Rhino 的 **Named Views / 命名视图**）来捕获指定视角
- 将截图 + 提示词发送到图像生成/图像编辑 API（后端可替换）
- 返回图片在面板内预览，并保存到磁盘形成历史

> 关键诉求是 **UI + Rhino 截图/相机管线**。API 只需要可插拔，后续可替换为 Nano Banana Pro（Gemini 图像模型）或其他。

### 1.2 项目目标（本期必须达成）
1) Rhino 8 Windows 内提供一个 **Dock Panel（可停靠面板）**，无需脚本操作即可使用。  
2) 面板内为现代 Web UI（React/Vue 均可），**UI 全中文**。  
3) 支持两种截图来源：
   - **活动视口**（默认：透视视口为主要使用场景；截图采用当前视口正在使用的显示模式/渲染模式）
   - **命名视图（Named Views）**：作为固定相机选择，选中后切换到该视角再截图
4) 生成结果默认保存到 **当前 3dm 文件同目录**下自动创建的文件夹；也支持用户设置一个固定输出目录（一次设置，后续不弹窗）。  
5) 提供 Provider 抽象：先交付 MockProvider（用于联调）+ GeminiProvider 骨架（后续你自行改成 Nano Banana Pro 等模型）。

### 1.3 非目标（本期不做）
- 不做“多轮迭代 / 对话式连续修图”工作流（例如点历史图再作为参考继续生成）。
- 不做“窗口捕获（带边框、标题、光标）”。本期只需要**干净的视口图**。
- 不做 RealtimeDisplayMode 的实时渲染显示模式（可列入后续版本）。

---

## 2. 平台与运行方式（你确认的关键点）

- **插件后端运行在 Rhino 进程内**（C# RhinoCommon 插件），直接在本机调用外部 API。
- **不需要单独部署 API 网关/服务器**（除非未来想做统一账号/配额/审计，这不在本期范围）。

---

## 3. 参考仓库与文档（给 AI Agent）

> 说明：你可以直接“抄壳子/抄结构”。本项目推荐 WebView2/Eto WebView 作为 UI 宿主；同时 RhinoCommon 自身提供 Dock Panel、视口截图、Named Views 访问能力。

将以下链接（URL）复制给 Agent（在代码块中提供，便于直接使用）：

```text
WebView2 / Web UI 插件工作坊参考（Rhino/Revit）:
https://github.com/vwnd/aectech-2025-nyc-web-aec

Rhino 8 注册 Dock Panel（Panels.RegisterPanel）:
https://mcneel.github.io/rhinocommon-api-docs/api/RhinoCommon/html/M_Rhino_UI_Panels_RegisterPanel_2.htm

视口截图（RhinoView.CaptureToBitmap）:
https://developer.rhino3d.com/api/RhinoCommon/html/M_Rhino_Display_RhinoView_CaptureToBitmap_7.htm

Rhino 命令 ViewCapture（语义参考：视口内容截图）:
https://docs.mcneel.com/rhino/8/help/en-us/commands/viewcapture.htm

NamedViewTable / RhinoDoc.NamedViews（命名视图）:
https://developer.rhino3d.com/api/RhinoCommon/html/T_Rhino_DocObjects_Tables_NamedViewTable.htm
https://mcneel.github.io/rhinocommon-api-docs/api/RhinoCommon/html/P_Rhino_RhinoDoc_NamedViews.htm

Eto WebView 打开 DevTools（调试 Web UI 非常有用）:
https://discourse.mcneel.com/t/accessing-developer-tools-panel-in-webview/203143
```

---

## 4. 用户故事（必须）

1) **活动视口生成**  
   我在 Rhino 中打开面板，输入提示词，选择“活动视口”，点击“截图预览”，确认截图无误后点击“生成”，在面板里看到生成结果并保存到磁盘。

2) **固定相机（命名视图）生成**  
   我在面板里选择一个“命名视图（相机）”，点击“截图预览/生成”，生成结果来自该固定视角。

3) **历史管理**  
   我能在面板里看到历史缩略图列表，点击查看大图与参数，并能打开保存位置。

---

## 5. 功能需求（详细）

### 5.1 Rhino 面板与命令
- 插件命令：`AIRenderPanel`（名称可调整）  
  - 执行后打开/激活 Dock Panel
- Dock Panel：
  - 可停靠、可浮动
  - 面板内承载 Web UI（WebView2 / Eto WebView）

### 5.2 UI（全中文，现代）
Web UI（React/Vue 均可）至少包含：

- 顶部区
  - 标题：例如“AI 渲染”
  - 状态指示：空闲 / 截图中 / 生成中 / 错误
- 输入区
  - 提示词（Prompt，多行文本）
  - （可选）负面提示词（Negative Prompt，先做 UI，不一定传 Provider）
- 截图来源区（单选）
  1) 活动视口（默认）
  2) 命名视图（下拉选择）
- 截图设置区
  - 输出尺寸预设（至少：768、1024、1536；可扩展）
  - “使用当前视口显示模式”开关：**默认开启且不可关闭**（即跟随透视视口当前模式）
  - 透明背景：默认关闭（可选）
- 生成设置区
  - 输出数量：1–4
  - 风格预设：仅作为前端模板（例如“写实/插画/建筑效果图”），可拼接进 Prompt（本期可选）
- 按钮区
  - `截图预览`
  - `生成`
  - `取消`
  - `设置`（打开设置页/弹窗）
- 历史区（右侧或下方）
  - 缩略图列表
  - 点击条目：大图预览 + 显示参数（时间、来源、尺寸、prompt、输出路径）
  - 操作：`打开文件夹`

> UI 不需要英文；不需要账号系统。

### 5.3 截图（必须：干净视口图）
- 仅实现“视口内容截图”，不包含边框/标题/光标。
- 默认以 **活动视口** 为输入（用户通常在透视视口工作）。
- 截图必须支持固定输出尺寸（传给模型更稳定）。
- 若用户选择“命名视图”：
  1) 将活动视口切换到该命名视图（固定相机）
  2) 再进行截图

**重要行为约束：**
- “渲染模式/显示模式跟随当前透视视口”：  
  即用户当前透视视口是什么模式（Rendered/Arctic/…），截图就按该模式捕获；无需在插件里另做模式选择器。

### 5.4 固定相机（命名视图）
- 面板应能列出当前文档的 Named Views（名称列表）。
- 选择后用于截图/生成。
- 若文档没有 Named Views：UI 提示“当前文件没有命名视图，请在 Rhino 中创建 Named View”。

### 5.5 Provider 抽象与 API 调用
实现 `IImageProvider` 抽象层：

- 输入：prompt、可选参考图（截图的 byte[] 或 base64）、输出数量、尺寸、其他参数（预留）
- 输出：生成图片 byte[] 列表 + 元数据（provider/model/requestId 等）

必须提供：
1) `MockProvider`  
   - 不发网络请求，返回占位图（或简单把截图回显）  
   - 用于 UI/截图联调、验证历史保存流程
2) `GeminiProvider`（骨架）  
   - 提供基本 HTTP 请求结构、鉴权方式、错误处理与返回解析框架  
   - 具体模型名/参数可后续替换（例如改成 Nano Banana Pro）

**安全要求：**
- API Key 不允许出现在前端 Web UI 中（防止泄露）。
- Key 存储在本机配置（如 `%AppData%` 配置文件或 Windows Credential Manager），由插件读取。

### 5.6 输出目录与历史保存（你指定的规则）
- 默认输出位置：**当前 3dm 文件同目录**，自动创建子文件夹，例如：
  - `<3dm目录>/_AI_Renders/`
- 子文件夹命名可固定：`_AI_Renders`（或可配置）。
- 若 3dm 尚未保存（没有路径）：
  - 方案 A（推荐）：提示用户先保存文件；未保存则输出到用户设置的固定目录或 `%AppData%` 临时目录
- 设置项：允许用户指定一个“固定输出目录”，保存后不再弹窗选择。

**历史内容至少保存：**
- 时间戳
- prompt
- 来源：ActiveView / NamedView + 名称
- 截图尺寸
- 输出文件路径列表
- Provider 元数据（可选）

### 5.7 取消与稳定性
- `生成` 必须异步，不阻塞 Rhino UI。
- `取消` 应能中断网络请求与后续处理（CancellationToken）。
- 任何错误不得导致 Rhino 崩溃；UI 必须给出明确错误提示（如网络错误、Key 缺失、API 返回错误）。

### 5.8 开发调试
- 提供“开发者模式”开关：
  - 打开 WebView DevTools（便于调试前端）
  - 输出日志到文件（建议：`%AppData%/Company/PluginName/logs/`）

---

## 6. 前后端通信协议（建议，Agent 可调整）

建议使用 JSON 消息，Web UI 与 C# 双向通信：

### 6.1 Web → C#
- `listNamedViews`
- `capturePreview`：{ source: "active" | "named", namedView?: string, width, height }
- `generate`：{ prompt, source, namedView?, width, height, count }
- `cancel`
- `getSettings` / `setSettings`

### 6.2 C# → Web
- `namedViews`：{ items: string[] }
- `previewImage`：{ pngBase64, width, height }
- `generateProgress`：{ stage, message, percent? }
- `generateResult`：{ imagesBase64[], savedPaths[], meta }
- `error`：{ message, details? }
- `settings`：{ outputMode, outputFolder, ... }

---

## 7. 验收标准（Acceptance Criteria）

1) Rhino 8 Windows 内可用命令打开停靠面板；UI 全中文。  
2) 点击“截图预览”能捕获**干净视口图**，尺寸与设定一致。  
3) 命名视图列表正确显示；选中某命名视图后截图来自该固定相机视角。  
4) 使用 MockProvider 时：能生成 1–4 张图，展示在 UI 并保存到磁盘；历史可回看并能打开输出文件夹。  
5) 默认输出到 `<3dm目录>/_AI_Renders/`，且不会每次弹窗选择目录；可在设置里改为固定目录。  
6) 网络错误/Key 缺失时：UI 明确提示，日志可定位；Rhino 不崩溃。  
7) 可打开 DevTools 或等效调试入口。

---

## 8. 里程碑建议（给 AI Agent）

- M1：Dock Panel + Web UI 空壳（中文 UI）+ 双向消息通道
- M2：活动视口截图预览（固定尺寸）+ 命名视图列表
- M3：生成流程接 MockProvider + 历史保存（默认输出目录）
- M4：设置页（固定输出目录、API Key 配置）+ 错误/取消
- M5：GeminiProvider 骨架（可跑通一次真实请求即可）

---

## 9. 后续可选增强（不在本期）
- 多轮迭代：历史图作为参考图继续生成
- 风格模板库（中文预设 prompt 片段）
- 结果“一键贴回 Rhino”（贴背景、图片框、材质贴图等）
- RealtimeDisplayMode 实时视口渲染

---
