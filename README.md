# Rhino 8 AI 渲染面板插件

一个 Rhino 8 插件，提供内嵌的 AI 渲染面板，支持视口截图和 AI 图像生成。

## 功能特性

- 🎨 **现代化中文 UI** - 可停靠的 Dock Panel，基于 React + WebView2
- 📷 **视口截图** - 支持活动视口和命名视图截图
- 🤖 **AI 生成** - 可插拔的 Provider 架构（Mock / Gemini）
- 📂 **历史管理** - 自动保存生成记录，支持回看

## 项目结构

```
src/
├── AIRenderPanel/          # C# 插件
│   ├── Bridge/             # 前后端通信
│   ├── Providers/          # AI Provider
│   └── Services/           # 业务服务
└── web-ui/                 # React 前端
```

## 开发环境

- Rhino 8 (Windows)
- .NET 7.0 SDK
- Node.js 18+
- Visual Studio 2022 或 Rider

## 快速开始

### 1. 安装前端依赖

```bash
cd src/web-ui
npm install
```

### 2. 启动前端开发服务器

```bash
npm run dev
```

### 3. 构建 C# 插件

```bash
cd src/AIRenderPanel
dotnet build
```

### 4. 加载插件到 Rhino

1. 打开 Rhino 8
2. 运行命令 `PlugInManager`
3. 点击"安装"并选择生成的 `.rhp` 文件
4. 重启 Rhino

### 5. 使用插件

在 Rhino 命令行输入：

```
AIRenderPanel
```

## 配置

设置文件位于：`%AppData%/AIRenderPanel/settings.json`

- `provider`: 使用的 AI Provider（`mock` 或 `gemini`）
- `apiKey`: Gemini API Key
- `outputMode`: 输出目录模式（`auto` 跟随 3dm 文件，`fixed` 固定目录）
- `outputFolder`: 固定输出目录路径

## 输出目录

默认情况下，生成的图片保存在：

```
<3dm文件目录>/_AI_Renders/<时间戳>_<会话ID>/
```

## 开发调试

1. 启动 Vite 开发服务器（`npm run dev`）
2. 在 Rhino 中加载插件
3. WebView2 会自动连接到 `http://localhost:5173`
4. 在设置中启用"开发者模式"可打开 DevTools

## 构建生产版本

### 一键构建（推荐）

```powershell
# 构建 Debug 版本
./build.ps1

# 构建 Release 版本
./build.ps1 -Release

# 清理构建产物
./build.ps1 -Clean

# 仅构建后端（跳过前端）
./build.ps1 -SkipFrontend
```

构建完成后，所有文件会输出到 `dist/` 目录。

### 手动构建

```bash
# 前端
cd src/web-ui
npm install
npm run build

# C# 插件
cd src/AIRenderPanel
dotnet build -c Release
```

## 技术栈

- **后端**: C# / .NET 7 / RhinoCommon
- **面板**: WebView2 (via Eto.Forms)
- **前端**: React 18 / TypeScript / Vite

## License

MIT
