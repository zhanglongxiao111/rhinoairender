# AI Render Panel - 前端 UI 重设计需求文档

> **文档版本**: v1.0  
> **更新日期**: 2025-12-17  
> **项目**: SA&DAGA Architects - AI Render Panel for Rhino 8

---

## 1. 项目概述

### 1.1 产品定位

这是一个嵌入 Rhino 8 的 AI 渲染辅助工具，为建筑师提供基于 Gemini AI 的图像风格化/渲染功能。用户可以截取 Rhino 视口或命名视图，输入提示词后生成风格化效果图。

### 1.2 技术栈

- **前端框架**: React 18 + TypeScript + Vite
- **样式**: 纯 CSS（非 Tailwind）
- **宿主环境**: WebView2（嵌入在 Rhino 8 插件窗口中）
- **通信机制**: WebView2 Bridge（`window.chrome.webview.postMessage`）

### 1.3 尺寸约束

- **窗口类型**: 独立弹出窗口（非 Rhino 内嵌 Panel）
- **建议宽度**: 400-500px
- **高度**: 自适应内容，建议 600-900px
- **目标部署**: 副屏独立显示

---

## 2. 品牌标识要求

### 2.1 LOGO

- **主 LOGO**: `SA&DAGA Architects`（左上角，显著位置）
- **副标题**: `AI RENDER`（作为产品名称）
- **风格**: 建筑事务所高端感，极简、专业

### 2.2 设计风格

采用 **瑞士国际主义设计风格（Swiss International Style）**：

- 网格系统（Grid System）
- 无衬线字体（推荐 Helvetica Neue、Inter、Outfit）
- 高对比度
- 大量留白
- 几何图形
- 极简配色

---

## 3. 核心功能模块

### 3.1 提示词输入区

- **多行文本输入框**：用于输入 AI 生成提示词
- **占位符提示**：引导用户输入效果描述
- **字符无限制**：支持长文本

### 3.2 生成参数控制

#### 3.2.1 生成模式（二选一）

| 模式               | 说明                                   |
| ---------------- | ------------------------------------ |
| **专业模式 (Pro)**   | 使用 gemini-3-pro-image-preview，支持高分辨率 |
| **快速模式 (Flash)** | 使用 gemini-2.5-flash-image，速度快但质量略低   |

#### 3.2.2 分辨率选项（仅专业模式）

- `1K` / `2K` / `4K`

#### 3.2.3 比例选项

- `Auto`（自动匹配视口）
- `1:1` / `16:9` / `9:16` / `4:3` / `3:4` / `3:2` / `2:3` / `4:5` / `5:4` / `21:9`

#### 3.2.4 生成数量

- 1-4 张

#### 3.2.5 截图长边尺寸

- `视口尺寸`（使用 Rhino 视口实际尺寸）
- `1024px` / `1920px` / `2560px` / `3840px`

#### 3.2.6 视图来源

- **当前视口**：使用 Rhino 当前活动视口
- **命名视图**：从下拉列表选择已保存的命名视图

#### 3.2.7 对比度调整（仅快速模式）

- 滑块控制，范围 0% 到 -100%，默认 -92%

### 3.3 预览区 / 结果展示区

#### 3.3.1 左侧预览（截图/原图）

- 显示 Rhino 截取的原始视口图像
- 支持点击放大（Lightbox）

#### 3.3.2 右侧结果（生成图）

- 显示 AI 生成的效果图列表
- 支持拖拽排序
- 支持点击放大（Lightbox）
- 支持 AB 对比（滑块叠加原图和生成图）

### 3.4 历史记录侧边栏（右侧）

- **列表显示**：缩略图 + 提示词摘要 + 日期
- **收藏功能**：⭐ 标记常用效果，筛选只看收藏
- **操作按钮**：
  - 📋 复制提示词
  - 🔄 使用此设置（填充提示词并重跑）
  - 📁 打开文件夹

### 3.5 设置弹窗

- **API Key**：密码输入框
- **代理地址**：文本输入框
- **API 端点选择**：
  - ☑️ Gemini Developer API（主要）
  - ☑️ Vertex AI Express（备用）
- **输出目录**：
  - 跟随文件（自动保存到 3dm 同目录）
  - 固定目录（指定路径）

### 3.6 操作按钮

- **截图预览**：从 Rhino 截取当前视口
- **开始生成**：调用 AI 生成
- **取消**：中断生成过程

### 3.7 状态反馈

- **状态文本**：就绪 / 截图中 / 生成中 / 完成 / 错误
- **进度条**：生成过程的进度指示
- **错误提示**：临时弹出的错误消息

---

## 4. 通信协议（Web ↔ C#）

### 4.1 Web → C# 发送消息

```typescript
// 消息结构
{ type: string, data?: object }
```

| type                | data                                                                                                  | 说明       |
| ------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| `listNamedViews`    | -                                                                                                     | 请求命名视图列表 |
| `capturePreview`    | `{ source, namedView?, width, height, transparent, longEdge?, aspectRatio? }`                         | 请求截图预览   |
| `generate`          | `{ prompt, source, namedView?, width, height, count, mode, resolution, aspectRatio, contrastAdjust }` | 开始生成     |
| `cancel`            | -                                                                                                     | 取消生成     |
| `getSettings`       | -                                                                                                     | 获取设置     |
| `setSettings`       | `SettingsData`                                                                                        | 保存设置     |
| `openFolder`        | `{ path }`                                                                                            | 打开文件夹    |
| `getHistory`        | -                                                                                                     | 获取历史记录   |
| `loadHistoryImages` | `{ paths, screenshotPath }`                                                                           | 加载历史原图   |
| `toggleFavorite`    | `{ historyId }`                                                                                       | 切换收藏状态   |

### 4.2 C# → Web 推送消息

| type               | data                                    | 说明     |
| ------------------ | --------------------------------------- | ------ |
| `namedViews`       | `{ items: string[] }`                   | 命名视图列表 |
| `previewImage`     | `{ base64, width, height }`             | 预览图    |
| `generateProgress` | `{ stage, message, percent }`           | 生成进度   |
| `generateResult`   | `{ images: string[], paths, meta }`     | 生成结果   |
| `error`            | `{ message, details }`                  | 错误消息   |
| `settings`         | `SettingsData`                          | 设置数据   |
| `historyUpdate`    | `{ items: HistoryItem[], favoriteIds }` | 历史记录   |
| `historyImages`    | `{ images: string[], screenshot }`      | 历史原图   |
| `favoriteStatus`   | `{ historyId, isFavorite }`             | 收藏状态变更 |

### 4.3 数据类型定义

```typescript
interface SettingsData {
    outputMode: 'auto' | 'fixed';
    outputFolder?: string;
    apiKey?: string;
    provider: string;
    devMode: boolean;
    proxyUrl?: string;
    useGeminiApi?: boolean;
    useVertexAI?: boolean;
}

interface HistoryItem {
    id: string;
    timestamp: string;
    prompt: string;
    source: string;
    namedView?: string;
    width: number;
    height: number;
    thumbnails: string[];  // base64
    paths: string[];
    provider: string;
    screenshotPath?: string;
    isFavorite?: boolean;
}
```

---

## 5. 当前 UI 布局（需要重新设计）

### 5.1 现有结构（三栏布局）

```
┌────────────────────────────────────────────────────────────────┐
│  Header (Logo + 状态 + 设置按钮)                                │
├────────────────┬─────────────────────────┬─────────────────────┤
│                │                         │                     │
│   控制面板      │     预览/结果区域       │    历史记录         │
│   (左侧)       │     (中间)               │    (右侧)          │
│   - 提示词     │     - 原图预览          │    - 列表          │
│   - 模式选择   │     - 生成图展示        │    - 收藏          │
│   - 参数设置   │     - AB对比           │    - 操作按钮      │
│   - 生成按钮   │                         │                     │
│                │                         │                     │
├────────────────┴─────────────────────────┴─────────────────────┤
│  Footer (状态信息 / 进度条)                                      │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 现有问题

1. **风格过于简陋**：缺乏专业建筑事务所的高端质感
2. **排版平庸**：未体现瑞士国际主义设计风格
3. **品牌缺失**：无明显的 SA&DAGA 标识
4. **主题单一**：只有深色主题，无法切换

---

## 6. 设计要求

### 6.1 视觉风格

- **瑞士国际主义**：严格的网格系统、高对比度、几何感
- **专业级质感**：体现建筑师审美，不像通用工具
- **极简留白**：功能密集但不拥挤

### 6.2 主题系统

- **深色主题**（Dark Mode）：默认，适合长时间使用
- **浅色主题**（Light Mode）：可切换，白色背景
- 主题切换按钮放置于 Header 右上角

### 6.5 交互细节

- **Hover 效果**：细微的颜色变化或阴影
- **过渡动画**：150-250ms cubic-bezier
- **加载状态**：优雅的骨架屏或脉冲动画
- **反馈及时**：所有操作都有视觉反馈

---

---

## 8. 附录：现有文件结构

```
src/web-ui/src/
├── App.tsx          # 主应用组件（约 850 行）
├── index.css        # 全局样式（约 1260 行）
├── main.tsx         # 入口文件
├── hooks/
│   └── useBridge.ts # WebView2 通信 Hook
└── types/
    └── bridge.ts    # TypeScript 类型定义
```



---

**期待看到令人惊艳的设计稿！**
