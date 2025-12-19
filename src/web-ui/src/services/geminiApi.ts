/**
 * Gemini API 前端服务模块
 * 直接通过 WebView2 的 fetch() 调用 Gemini API，绕过 Rhino.exe 网络限制
 */

// API 端点
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Vertex AI Express 端点
const VERTEX_AI_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google/models';

// 模型名称
const MODEL_PRO = 'gemini-3-pro-image-preview';    // 专业模式
const MODEL_FLASH = 'gemini-2.5-flash-image';      // 快速模式

export interface GeminiGenerateOptions {
    mode: 'pro' | 'flash';
    resolution?: string;
    aspectRatio?: string;
    contrastAdjust?: number;  // 仅快速模式，0 到 -100
}

export interface GeminiGenerateResult {
    images: string[];  // base64 图片数组
    model: string;
    requestId: string;
}

/**
 * API 端点配置
 */
export interface ApiEndpointConfig {
    useGeminiApi: boolean;      // 使用 Gemini Developer API
    useVertexAI: boolean;       // 使用 Vertex AI Express
    apiKey?: string;            // Gemini Developer API Key
    vertexApiKey?: string;      // Vertex AI Express API Key
}

/**
 * 调整图像对比度（用于快速模式预处理）
 */
async function adjustContrast(imageBase64: string, contrastPercent: number): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;

            // 绘制原图
            ctx.drawImage(img, 0, 0);

            // 获取像素数据
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // 对比度系数：-100% 时为 0（完全灰色），0% 时为 1（不变）
            const factor = 1 + (contrastPercent / 100);

            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.max(0, Math.min(255, (data[i] - 128) * factor + 128));     // R
                data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * factor + 128)); // G
                data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * factor + 128)); // B
            }

            ctx.putImageData(imageData, 0, 0);

            // 返回处理后的 base64（去掉 data:image/png;base64, 前缀）
            const result = canvas.toDataURL('image/png');
            resolve(result.split(',')[1]);
        };

        img.src = `data:image/png;base64,${imageBase64}`;
    });
}

/**
 * 构建 API 请求体
 * @param isVertexAI 是否为 Vertex AI 端点（需要 role 字段）
 */
function buildRequestBody(
    prompt: string,
    imageBase64: string,
    options: GeminiGenerateOptions,
    isVertexAI: boolean = false
): object {
    const parts: object[] = [];

    // 添加提示词
    parts.push({ text: `请根据以下提示词对参考图进行风格化处理或渲染：${prompt}` });

    // 添加参考图像
    parts.push({
        inline_data: {
            mime_type: 'image/png',
            data: imageBase64
        }
    });

    // 构建生成配置
    let generationConfig: object;

    if (options.mode === 'pro') {
        const imageConfig: Record<string, string> = {};
        if (options.resolution) {
            imageConfig.imageSize = options.resolution;
        }
        if (options.aspectRatio) {
            imageConfig.aspectRatio = options.aspectRatio;
        }

        generationConfig = {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 1.0,
            ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {})
        };
    } else {
        generationConfig = {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 0.8
        };
    }

    // Vertex AI 需要 role 字段，Gemini API 不需要
    const contentObject = isVertexAI
        ? { role: 'user', parts }
        : { parts };

    return {
        contents: [contentObject],
        generationConfig
    };
}

/**
 * 从 Gemini API 响应中解析图像
 */
function parseImageFromResponse(responseJson: any): string | null {
    try {
        const candidates = responseJson.candidates;
        if (!candidates || candidates.length === 0) {
            console.log('[Gemini API] 响应中没有 candidates');
            return null;
        }

        const parts = candidates[0]?.content?.parts;
        if (!parts) {
            console.log('[Gemini API] 响应中没有 parts');
            return null;
        }

        for (const part of parts) {
            // 检查 inlineData (camelCase)
            const inlineData = part.inlineData || part.inline_data;
            if (inlineData) {
                const mimeType = inlineData.mimeType || inlineData.mime_type;
                const data = inlineData.data;

                if (data && mimeType?.startsWith('image/')) {
                    console.log(`[Gemini API] 找到图像，类型: ${mimeType}`);
                    return data;
                }
            }

            // 记录文本响应
            if (part.text) {
                console.log(`[Gemini API] 文本响应: ${part.text.substring(0, 100)}...`);
            }
        }

        console.log('[Gemini API] 响应中未找到图像数据');
        return null;
    } catch (error) {
        console.error('[Gemini API] 解析响应失败:', error);
        return null;
    }
}

/**
 * 生成单张图片
 * @param endpointName 端点名称，用于日志
 * @param endpointUrl 完整的端点 URL（含 API Key）
 * @param isVertexAI 是否为 Vertex AI 端点
 */
async function generateSingleImage(
    prompt: string,
    imageBase64: string,
    options: GeminiGenerateOptions,
    endpointName: string,
    endpointUrl: string,
    isVertexAI: boolean,
    signal?: AbortSignal
): Promise<string> {
    const requestBody = buildRequestBody(prompt, imageBase64, options, isVertexAI);

    console.log(`[${endpointName}] 发送请求...`);
    console.log(`[${endpointName}] URL: ${endpointUrl.replace(/key=.*/, 'key=***')}`);
    console.log(`[${endpointName}] 使用 role 字段: ${isVertexAI}`);

    const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal
    });

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}`;
        try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorMessage;
        } catch {
            errorMessage = errorText.substring(0, 200);
        }
        throw new Error(`${endpointName} 错误: ${errorMessage}`);
    }

    const responseJson = await response.json();
    const imageData = parseImageFromResponse(responseJson);

    if (!imageData) {
        throw new Error(`${endpointName} 未返回图像`);
    }

    return imageData;
}

/**
 * 主入口：生成图像
 * @param prompt 提示词
 * @param imageBase64 参考图像的 base64（不含 data:image/png;base64, 前缀）
 * @param count 生成数量
 * @param options 生成选项
 * @param apiConfig API 端点配置
 * @param onProgress 进度回调
 */
export async function generateImages(
    prompt: string,
    imageBase64: string,
    count: number,
    options: GeminiGenerateOptions,
    apiConfig: ApiEndpointConfig,
    onProgress?: (completed: number, total: number) => void,
    signal?: AbortSignal
): Promise<GeminiGenerateResult> {
    const model = options.mode === 'pro' ? MODEL_PRO : MODEL_FLASH;

    // 构建可用的端点列表（包含名称、URL 和是否为 Vertex AI）
    const endpoints: { name: string; url: string; isVertexAI: boolean }[] = [];

    if (apiConfig.useGeminiApi && apiConfig.apiKey) {
        // Gemini Developer API 端点
        const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiConfig.apiKey}`;
        endpoints.push({ name: 'Gemini API', url, isVertexAI: false });
    }
    if (apiConfig.useVertexAI && apiConfig.vertexApiKey) {
        // Vertex AI Express 端点（注意 URL 格式不同！）
        const url = `${VERTEX_AI_BASE}/${model}:generateContent?key=${apiConfig.vertexApiKey}`;
        endpoints.push({ name: 'Vertex AI', url, isVertexAI: true });
    }

    // 如果没有配置有效端点，检查是否有任何可用的 API Key
    if (endpoints.length === 0) {
        // 如果有 apiKey 但未勾选任何端点，默认使用 Gemini API
        if (apiConfig.apiKey) {
            const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiConfig.apiKey}`;
            endpoints.push({ name: 'Gemini API', url, isVertexAI: false });
            console.log('[API] 未选择端点，默认使用 Gemini API');
        } else if (apiConfig.vertexApiKey) {
            const url = `${VERTEX_AI_BASE}/${model}:generateContent?key=${apiConfig.vertexApiKey}`;
            endpoints.push({ name: 'Vertex AI', url, isVertexAI: true });
            console.log('[API] 未选择端点，默认使用 Vertex AI');
        } else {
            throw new Error('API Key 未配置。请在设置中配置 Gemini API Key 或 Vertex AI API Key。');
        }
    }

    console.log(`[API] 配置的端点: ${endpoints.map(e => e.name).join(', ')}`);
    console.log(`[API] 使用模型: ${model}`);

    // 快速模式下进行对比度预处理
    let processedImage = imageBase64;
    if (options.mode === 'flash' && options.contrastAdjust && options.contrastAdjust < 0) {
        console.log(`[API] 快速模式：应用对比度调整 ${options.contrastAdjust}%`);
        processedImage = await adjustContrast(imageBase64, options.contrastAdjust);
    }

    const modeText = options.mode === 'pro' ? '专业模式' : '快速模式';
    console.log(`[API] ${modeText}：开始并发生成 ${count} 张图片`);

    // 尝试使用端点生成图片，支持 Fallback
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
        try {
            console.log(`[API] 尝试使用 ${endpoint.name}...`);

            // 并发生成所有图片
            const tasks = Array.from({ length: count }, (_, i) =>
                generateSingleImage(prompt, processedImage, options, endpoint.name, endpoint.url, endpoint.isVertexAI, signal)
                    .then(result => {
                        onProgress?.(i + 1, count);
                        return result;
                    })
            );

            const results = await Promise.all(tasks);

            console.log(`[${endpoint.name}] 全部 ${count} 张图片生成完成`);

            return {
                images: results,
                model: model,
                requestId: crypto.randomUUID().substring(0, 8)
            };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`[${endpoint.name}] 失败: ${lastError.message}`);

            // 如果是取消操作，直接抛出
            if (lastError.name === 'AbortError') {
                throw lastError;
            }

            // 继续尝试下一个端点
            if (endpoints.indexOf(endpoint) < endpoints.length - 1) {
                console.log(`[API] 切换到下一个端点...`);
            }
        }
    }

    // 所有端点都失败
    throw lastError ?? new Error('所有 API 端点都失败了');
}

/**
 * 验证 API Key 是否有效
 */
export async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        const url = `${GEMINI_API_BASE}?key=${apiKey}`;
        const response = await fetch(url);
        return response.ok;
    } catch {
        return false;
    }
}
