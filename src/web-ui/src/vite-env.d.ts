/// <reference types="vite/client" />

interface Window {
    chrome: {
        webview: {
            postMessage: (message: string) => void;
            addEventListener: (type: string, handler: (event: MessageEvent) => void) => void;
            removeEventListener: (type: string, handler: (event: MessageEvent) => void) => void;
        };
    };
}
