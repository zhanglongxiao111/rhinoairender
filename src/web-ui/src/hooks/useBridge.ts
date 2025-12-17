import { useEffect, useCallback, useRef } from 'react';
import type {
    BridgeMessage,
    CapturePreviewRequest,
    GenerateRequest,
    SettingsData,
    OpenFolderRequest,
    NamedViewsResponse,
    PreviewImageResponse,
    GenerateProgressResponse,
    GenerateResultResponse,
    ErrorResponse,
    HistoryUpdateResponse,
} from '../types/bridge';

export interface BridgeCallbacks {
    onNamedViews?: (data: NamedViewsResponse) => void;
    onPreviewImage?: (data: PreviewImageResponse) => void;
    onGenerateProgress?: (data: GenerateProgressResponse) => void;
    onGenerateResult?: (data: GenerateResultResponse) => void;
    onError?: (data: ErrorResponse) => void;
    onSettings?: (data: SettingsData) => void;
    onHistoryUpdate?: (data: HistoryUpdateResponse) => void;
    onHistoryImages?: (data: { images: string[] }) => void;
}

/**
 * WebView2 桥接 Hook
 * 处理 C# 与 Web UI 之间的双向通信
 */
export function useBridge(callbacks: BridgeCallbacks) {
    const callbacksRef = useRef(callbacks);
    callbacksRef.current = callbacks;

    // 发送消息到 C#
    const postMessage = useCallback((type: string, data?: unknown) => {
        const message: BridgeMessage = { type, data };
        const json = JSON.stringify(message);

        if (window.chrome?.webview) {
            window.chrome.webview.postMessage(json);
            console.log('[Bridge] 发送消息:', type, data);
        } else {
            console.warn('[Bridge] WebView2 不可用，消息未发送:', type);
        }
    }, []);

    // 监听 C# 消息
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            try {
                let message: BridgeMessage;

                // 处理不同格式的消息
                if (typeof event.data === 'string') {
                    message = JSON.parse(event.data);
                } else {
                    message = event.data;
                }

                console.log('[Bridge] 收到消息:', message.type, message.data);

                switch (message.type) {
                    case 'namedViews':
                        callbacksRef.current.onNamedViews?.(message.data as NamedViewsResponse);
                        break;
                    case 'previewImage':
                        callbacksRef.current.onPreviewImage?.(message.data as PreviewImageResponse);
                        break;
                    case 'generateProgress':
                        callbacksRef.current.onGenerateProgress?.(message.data as GenerateProgressResponse);
                        break;
                    case 'generateResult':
                        callbacksRef.current.onGenerateResult?.(message.data as GenerateResultResponse);
                        break;
                    case 'error':
                        callbacksRef.current.onError?.(message.data as ErrorResponse);
                        break;
                    case 'settings':
                        callbacksRef.current.onSettings?.(message.data as SettingsData);
                        break;
                    case 'historyUpdate':
                        callbacksRef.current.onHistoryUpdate?.(message.data as HistoryUpdateResponse);
                        break;
                    case 'historyImages':
                        callbacksRef.current.onHistoryImages?.(message.data as { images: string[] });
                        break;
                    default:
                        console.warn('[Bridge] 未知消息类型:', message.type);
                }
            } catch (error) {
                console.error('[Bridge] 解析消息错误:', error);
            }
        };

        if (window.chrome?.webview) {
            window.chrome.webview.addEventListener('message', handleMessage);
            return () => {
                window.chrome.webview.removeEventListener('message', handleMessage);
            };
        }
    }, []);

    // API 方法
    const listNamedViews = useCallback(() => {
        postMessage('listNamedViews');
    }, [postMessage]);

    const capturePreview = useCallback((request: CapturePreviewRequest) => {
        postMessage('capturePreview', request);
    }, [postMessage]);

    const generate = useCallback((request: GenerateRequest) => {
        postMessage('generate', request);
    }, [postMessage]);

    const cancel = useCallback(() => {
        postMessage('cancel');
    }, [postMessage]);

    const getSettings = useCallback(() => {
        postMessage('getSettings');
    }, [postMessage]);

    const setSettings = useCallback((settings: SettingsData) => {
        postMessage('setSettings', settings);
    }, [postMessage]);

    const openFolder = useCallback((request: OpenFolderRequest) => {
        postMessage('openFolder', request);
    }, [postMessage]);

    const getHistory = useCallback(() => {
        postMessage('getHistory');
    }, [postMessage]);

    const loadHistoryImages = useCallback((paths: string[]) => {
        postMessage('loadHistoryImages', { paths });
    }, [postMessage]);

    return {
        postMessage,
        listNamedViews,
        capturePreview,
        generate,
        cancel,
        getSettings,
        setSettings,
        openFolder,
        getHistory,
        loadHistoryImages,
    };
}
