# Rhino 8 AI Render Panel

[English](#english) | [中文](#中文)

---

## English

A Rhino 8 plugin that provides an embedded AI rendering panel with viewport capture and AI image generation.

### ✨ Features

- 🎨 **Modern UI** - Dockable panel built with React + WebView2
- 📷 **Viewport Capture** - Active viewport and named views support
- 🤖 **Dual Mode AI Generation**
  - **Pro Mode** (gemini-3-pro) - High quality, up to 4K resolution
  - **Flash Mode** (gemini-2.5-flash) - Fast generation with contrast preprocessing
- 🖼️ **Reference Images** - Upload up to 3 reference images for style guidance
- ✏️ **Annotation Editor** - Draw, add text, and erase on screenshots before generation
- 📐 **Resolution & Aspect Ratio** - 1K/2K/4K with multiple aspect ratio presets
- ⭐ **Favorites** - Star and filter your best generations
- 🌓 **Theme Sync** - Automatically follows Rhino's light/dark theme
- 📂 **History Management** - Auto-save with browsing and re-generation

### 📋 Requirements

- Rhino 8 (Windows)
- .NET 7.0 SDK
- Node.js 18+

### 🚀 Quick Start

```bash
# Build everything
./build.ps1

# Output: dist/AIRenderPanel.rhp
```

Then in Rhino:
1. Run `PlugInManager`
2. Install `dist/AIRenderPanel.rhp`
3. Restart Rhino
4. Run command `AIRenderPanel`

### ⚙️ Configuration

Settings file: `%AppData%/AIRenderPanel/settings.json`

| Key | Description |
|-----|-------------|
| `apiKey` | Gemini API Key |
| `outputMode` | `auto` (follow .3dm) or `fixed` |
| `outputFolder` | Custom output directory |

### 🛠️ Development

```bash
# Frontend dev server
cd src/web-ui && npm run dev

# Backend build
cd src/AIRenderPanel && dotnet build
```

---

## 中文

Rhino 8 AI 渲染面板插件，提供视口截图和 AI 图像生成功能。

### ✨ 功能特性

- 🎨 **现代化界面** - 可停靠面板，基于 React + WebView2
- 📷 **视口截图** - 支持活动视口和命名视图
- 🤖 **双模式生成**
  - **专业模式** (gemini-3-pro) - 高质量，支持 4K
  - **快速模式** (gemini-2.5-flash) - 快速生成，带对比度预处理
- 🖼️ **参考图** - 最多上传 3 张参考图用于风格引导
- ✏️ **标注编辑器** - 在截图上绘制、添加文字、擦除
- 📐 **分辨率和宽高比** - 1K/2K/4K，多种宽高比预设
- ⭐ **收藏功能** - 收藏并筛选最佳生成结果
- 🌓 **主题同步** - 自动跟随 Rhino 的浅色/深色主题
- 📂 **历史管理** - 自动保存，支持浏览和重新生成

### 📋 环境要求

- Rhino 8 (Windows)
- .NET 7.0 SDK
- Node.js 18+

### 🚀 快速开始

```bash
# 一键构建
./build.ps1

# 输出: dist/AIRenderPanel.rhp
```

在 Rhino 中:
1. 运行 `PlugInManager`
2. 安装 `dist/AIRenderPanel.rhp`
3. 重启 Rhino
4. 运行命令 `AIRenderPanel`

### ⚙️ 配置

设置文件: `%AppData%/AIRenderPanel/settings.json`

| 键 | 说明 |
|-----|-------------|
| `apiKey` | Gemini API Key |
| `outputMode` | `auto` (跟随 .3dm) 或 `fixed` |
| `outputFolder` | 自定义输出目录 |

### 🛠️ 开发调试

```bash
# 前端开发服务器
cd src/web-ui && npm run dev

# 后端构建
cd src/AIRenderPanel && dotnet build
```

---

## 📁 Project Structure

```
src/
├── AIRenderPanel/          # C# Plugin
│   ├── Bridge/             # Frontend-Backend communication
│   ├── Providers/          # AI Providers
│   └── Services/           # Business services
└── web-ui/                 # React Frontend
    └── src/
        ├── components/     # UI Components
        ├── hooks/          # React Hooks
        └── services/       # API Services
```

## 📄 License

MIT
