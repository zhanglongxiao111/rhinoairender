// ============================================
// C# 与 Web UI 之间的消息类型定义
// ============================================

// 基础消息类型
export interface BridgeMessage<T = unknown> {
    type: string;
    data?: T;
}

// ============================================
// Web → C# 请求类型
// ============================================

export interface CapturePreviewRequest {
    source: 'active' | 'named';
    namedView?: string;
    width: number;
    height: number;
    transparent: boolean;
}

export interface GenerateRequest {
    prompt: string;
    negativePrompt?: string;
    source: 'active' | 'named';
    namedView?: string;
    width: number;
    height: number;
    count: number;
}

export interface SettingsData {
    outputMode: 'auto' | 'fixed';
    outputFolder?: string;
    apiKey?: string;
    vertexApiKey?: string;  // Vertex AI 单独的 API Key
    provider: string;
    devMode: boolean;
    proxyUrl?: string;  // 代理地址，例如 http://127.0.0.1:7890
    useGeminiApi?: boolean;  // 使用 Gemini Developer API
    useVertexAI?: boolean;   // 使用 Vertex AI Express（备用）
}

export interface OpenFolderRequest {
    path: string;
}

// ============================================
// C# → Web 响应类型
// ============================================

export interface NamedViewsResponse {
    items: string[];
}

export interface PreviewImageResponse {
    base64: string;
    width: number;
    height: number;
}

export interface GenerateProgressResponse {
    stage: 'capture' | 'generate' | 'save' | 'cancelled';
    message: string;
    percent?: number;
}

export interface GenerateResultResponse {
    images: string[]; // base64 列表
    paths: string[];
    meta?: GenerateMetadata;
}

export interface GenerateMetadata {
    provider: string;
    model?: string;
    requestId?: string;
    timestamp: string;
}

export interface ErrorResponse {
    message: string;
    details?: string;
}

export interface HistoryItem {
    id: string;
    timestamp: string;
    prompt: string;
    source: string;
    namedView?: string;
    width: number;
    height: number;
    thumbnails: string[]; // base64 缩略图
    paths: string[];
    provider: string;
    screenshotPath?: string; // 原始截图路径
    isFavorite?: boolean; // 是否收藏
}

export interface HistoryUpdateResponse {
    items: HistoryItem[];
    favoriteIds?: string[];
}

// ============================================
// 应用状态类型
// ============================================

export type AppStatus = 'idle' | 'capturing' | 'generating' | 'error';

export interface AppState {
    status: AppStatus;
    statusMessage: string;
    namedViews: string[];
    previewImage: string | null;
    generatedImages: string[];
    history: HistoryItem[];
    settings: SettingsData;
    error: string | null;
}

// 尺寸预设
export const SIZE_PRESETS = [
    { label: '768 × 768', width: 768, height: 768 },
    { label: '1024 × 1024', width: 1024, height: 1024 },
    { label: '1536 × 1536', width: 1536, height: 1536 },
    { label: '1024 × 768 (横向)', width: 1024, height: 768 },
    { label: '768 × 1024 (纵向)', width: 768, height: 1024 },
] as const;

// 风格预设
export const STYLE_PRESETS = [
    { label: '写实', promptSuffix: 'photorealistic, high quality, detailed' },
    { label: '插画', promptSuffix: 'illustration style, artistic, colorful' },
    { label: '建筑效果图', promptSuffix: 'architectural visualization, professional rendering, realistic lighting' },
    { label: '概念艺术', promptSuffix: 'concept art, cinematic, dramatic lighting' },
] as const;
