import { useState, useCallback, useEffect } from 'react';
import { useBridge } from './hooks/useBridge';
import type {
    AppStatus,
    HistoryItem,
    SettingsData,
} from './types/bridge';

// 生成模式选项
const MODES = [
    { value: 'pro', label: '专业模式', desc: 'Gemini 3 Pro Image - 高质量，支持 4K' },
    { value: 'flash', label: '快速模式', desc: 'Gemini 2.5 Flash Image - 快速响应' },
] as const;

// Gemini 3 Pro Image Preview 分辨率选项
const RESOLUTIONS = [
    { value: '1K', label: '1K', desc: '标准' },
    { value: '2K', label: '2K', desc: '高清' },
    { value: '4K', label: '4K', desc: '超清' },
] as const;

// 比例选项 - 空字符串表示 Auto
// 完整列表: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
const ASPECT_RATIOS = [
    { value: '', label: 'AUTO' },
    { value: '1:1', label: '1:1' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' },
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: '3:2', label: '3:2' },
    { value: '2:3', label: '2:3' },
    { value: '4:5', label: '4:5' },
    { value: '5:4', label: '5:4' },
    { value: '21:9', label: '21:9' },
] as const;

// 截图长边尺寸选项
const LONG_EDGE_OPTIONS = [
    { value: 0, label: '视口尺寸', desc: '使用 Rhino 视口实际尺寸' },
    { value: 1024, label: '1024px', desc: '标准' },
    { value: 1920, label: '1920px', desc: '全高清' },
    { value: 2560, label: '2560px', desc: '2K' },
    { value: 3840, label: '3840px', desc: '4K' },
] as const;

function App() {
    // 状态
    const [status, setStatus] = useState<AppStatus>('idle');
    const [statusMessage, setStatusMessage] = useState('就绪');
    const [progress, setProgress] = useState(0);

    // 输入状态
    const [prompt, setPrompt] = useState('');
    const [source, setSource] = useState<'active' | 'named'>('active');
    const [selectedNamedView, setSelectedNamedView] = useState('');
    const [resolution, setResolution] = useState('1K');
    const [aspectRatio, setAspectRatio] = useState(''); // 空 = Auto
    const [count, setCount] = useState(1);
    const [mode, setMode] = useState<'pro' | 'flash'>('pro'); // 生成模式
    const [contrastAdjust, setContrastAdjust] = useState(-92); // 对比度调整（快速模式）
    const [longEdge, setLongEdge] = useState(1920); // 截图长边尺寸

    // 数据状态
    const [namedViews, setNamedViews] = useState<string[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

    // UI 状态
    const [showSettings, setShowSettings] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null); // Lightbox 放大图片
    const [comparePosition, setComparePosition] = useState(50); // AB 对比滑块位置 (0-100)
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null); // 拖拽排序
    const [settings, setSettings] = useState<SettingsData>({
        outputMode: 'auto',
        outputFolder: '',
        apiKey: '',
        provider: 'gemini-3-pro-image',
        devMode: false,
    });

    // 错误状态
    const [error, setError] = useState<string | null>(null);

    // 桥接
    const bridge = useBridge({
        onNamedViews: (data) => {
            setNamedViews(data.items);
            if (data.items.length > 0 && !selectedNamedView) {
                setSelectedNamedView(data.items[0]);
            }
        },
        onPreviewImage: (data) => {
            setPreviewImage(`data:image/png;base64,${data.base64}`);
            setStatus('idle');
            setStatusMessage('预览完成');
        },
        onGenerateProgress: (data) => {
            setStatusMessage(data.message);
            setProgress(data.percent || 0);
            if (data.stage === 'cancelled') {
                setStatus('idle');
                setStatusMessage('已取消');
                setProgress(0);
            }
        },
        onGenerateResult: (data) => {
            setGeneratedImages(data.images.map(img => `data:image/png;base64,${img}`));
            setStatus('idle');
            setStatusMessage('生成完成');
            setProgress(100);
            // 刷新历史
            bridge.getHistory();
        },
        onError: (data) => {
            setError(data.message);
            setStatus('error');
            setStatusMessage('错误');
            setTimeout(() => setError(null), 4000);
        },
        onSettings: (data) => {
            setSettings(data);
        },
        onHistoryUpdate: (data) => {
            setHistory(data.items);
        },
    });

    // 初始化
    useEffect(() => {
        const timer = setTimeout(() => {
            bridge.listNamedViews();
            bridge.getSettings();
            bridge.getHistory();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // 截图预览 - 使用 longEdge 和 aspectRatio
    const handleCapturePreview = useCallback(() => {
        setStatus('capturing');
        setStatusMessage('正在截图...');
        bridge.capturePreview({
            source,
            namedView: source === 'named' ? selectedNamedView : undefined,
            width: 1024, // 备用
            height: 1024, // 备用
            transparent: false,
            longEdge: longEdge > 0 ? longEdge : undefined,
            aspectRatio: aspectRatio || undefined,
        } as any);
    }, [bridge, source, selectedNamedView, longEdge, aspectRatio]);

    // 生成 - 支持并发
    const handleGenerate = useCallback(() => {
        if (!prompt.trim()) {
            setError('请输入提示词');
            return;
        }

        setStatus('generating');
        setStatusMessage('正在生成...');
        setProgress(0);
        setGeneratedImages([]);

        // 传递所有参数，包括模式和对比度
        bridge.generate({
            prompt: prompt.trim(),
            source,
            namedView: source === 'named' ? selectedNamedView : undefined,
            width: 1024,
            height: 1024,
            count,
            resolution,
            aspectRatio: aspectRatio || undefined,
            mode,
            contrastAdjust: mode === 'flash' ? contrastAdjust : undefined,
            longEdge: longEdge > 0 ? longEdge : undefined,
        } as any);
    }, [bridge, prompt, source, selectedNamedView, count, resolution, aspectRatio, mode, contrastAdjust, longEdge]);

    // 取消
    const handleCancel = useCallback(() => {
        bridge.cancel();
    }, [bridge]);

    // 打开文件夹
    const handleOpenFolder = useCallback((path: string) => {
        const dir = path.substring(0, path.lastIndexOf('\\'));
        bridge.openFolder({ path: dir });
    }, [bridge]);

    // 保存设置
    const handleSaveSettings = useCallback(() => {
        bridge.setSettings(settings);
        setShowSettings(false);
    }, [bridge, settings]);

    // 拖拽排序处理
    const handleDragStart = useCallback((index: number) => {
        setDraggedIndex(index);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        // 重新排序
        const newImages = [...generatedImages];
        const draggedImage = newImages[draggedIndex];
        newImages.splice(draggedIndex, 1);
        newImages.splice(index, 0, draggedImage);
        setGeneratedImages(newImages);
        setDraggedIndex(index);
    }, [draggedIndex, generatedImages]);

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null);
    }, []);


    const isProcessing = status === 'generating' || status === 'capturing';

    return (
        <div className="app">
            {/* 顶部栏 */}
            <header className="app-header">
                <div className="app-title">
                    <div className="app-title-icon" />
                    <span>AI RENDER</span>
                </div>
                <div className="status-indicator">
                    <span className={`status-dot ${isProcessing ? 'processing' : status === 'error' ? 'error' : ''}`} />
                    <span>{statusMessage}</span>
                </div>
            </header>

            <div className="app-content">
                {/* 控制面板 */}
                <aside className="controls-panel">
                    <div className="controls-header">
                        <h2>参数设置</h2>
                    </div>

                    <div className="controls-body">
                        {/* 提示词 */}
                        <div className="control-group">
                            <label className="label">提示词</label>
                            <textarea
                                className="textarea"
                                placeholder="描述你想要生成的图像效果..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                        </div>

                        {/* 截图来源 */}
                        <div className="control-group">
                            <label className="label">视图来源</label>
                            <div className="segment-group">
                                <div
                                    className={`segment-option ${source === 'active' ? 'active' : ''}`}
                                    onClick={() => setSource('active')}
                                >
                                    活动视口
                                </div>
                                <div
                                    className={`segment-option ${source === 'named' ? 'active' : ''}`}
                                    onClick={() => setSource('named')}
                                >
                                    命名视图
                                </div>
                            </div>
                        </div>

                        {/* 命名视图选择 */}
                        {source === 'named' && (
                            <div className="control-group">
                                <label className="label">
                                    选择视图
                                    <button
                                        className="btn-refresh"
                                        onClick={() => bridge.listNamedViews()}
                                        title="刷新命名视图列表"
                                    >
                                        ↻
                                    </button>
                                </label>
                                {namedViews.length > 0 ? (
                                    <select
                                        className="select"
                                        value={selectedNamedView}
                                        onChange={(e) => setSelectedNamedView(e.target.value)}
                                    >
                                        {namedViews.map((view) => (
                                            <option key={view} value={view}>{view}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-muted">当前文档没有命名视图</p>
                                )}
                            </div>
                        )}

                        <div className="control-divider" />

                        {/* 生成模式 */}
                        <div className="control-group">
                            <label className="label">生成模式</label>
                            <div className="segment-group">
                                {MODES.map((m) => (
                                    <div
                                        key={m.value}
                                        className={`segment-option ${mode === m.value ? 'active' : ''}`}
                                        onClick={() => setMode(m.value)}
                                        title={m.desc}
                                    >
                                        {m.label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 对比度调整 - 仅快速模式 */}
                        {mode === 'flash' && (
                            <div className="control-group">
                                <label className="label">
                                    对比度调整 <span className="text-muted">（{contrastAdjust}%）</span>
                                </label>
                                <input
                                    type="range"
                                    className="slider"
                                    min="-100"
                                    max="0"
                                    value={contrastAdjust}
                                    onChange={(e) => setContrastAdjust(Number(e.target.value))}
                                />
                                <div className="slider-labels">
                                    <span>-100%</span>
                                    <span>0%</span>
                                </div>
                            </div>
                        )}

                        {/* 分辨率 - 仅专业模式显示 */}
                        {mode === 'pro' && (
                            <div className="control-group">
                                <label className="label">分辨率</label>
                                <div className="segment-group">
                                    {RESOLUTIONS.map((res) => (
                                        <div
                                            key={res.value}
                                            className={`segment-option ${resolution === res.value ? 'active' : ''}`}
                                            onClick={() => setResolution(res.value)}
                                        >
                                            {res.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 比例 */}
                        <div className="control-group">
                            <label className="label">画面比例</label>
                            <div className="chip-group">
                                {ASPECT_RATIOS.map((ratio) => (
                                    <div
                                        key={ratio.value}
                                        className={`chip ${aspectRatio === ratio.value ? 'active' : ''}`}
                                        onClick={() => setAspectRatio(ratio.value)}
                                    >
                                        {ratio.label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 截图尺寸 */}
                        <div className="control-group">
                            <label className="label">截图尺寸（长边）</label>
                            <div className="chip-group">
                                {LONG_EDGE_OPTIONS.map((opt) => (
                                    <div
                                        key={opt.value}
                                        className={`chip ${longEdge === opt.value ? 'active' : ''}`}
                                        onClick={() => setLongEdge(opt.value)}
                                        title={opt.desc}
                                    >
                                        {opt.label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 生成数量 */}
                        <div className="control-group">
                            <label className="label">生成数量</label>
                            <div className="segment-group">
                                {[1, 2, 3, 4].map((n) => (
                                    <div
                                        key={n}
                                        className={`segment-option ${count === n ? 'active' : ''}`}
                                        onClick={() => setCount(n)}
                                    >
                                        {n}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="controls-footer">
                        <button
                            className="btn btn-secondary"
                            onClick={handleCapturePreview}
                            disabled={isProcessing}
                        >
                            预览
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleGenerate}
                            disabled={isProcessing || !prompt.trim()}
                        >
                            {isProcessing ? '生成中...' : '生成'}
                        </button>
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={() => setShowSettings(true)}
                        >
                            ⚙
                        </button>
                    </div>
                </aside>

                {/* 预览区域 */}
                <main className="preview-panel">
                    <div className="preview-toolbar">
                        <div className="preview-toolbar-left">
                            <span className="text-muted">{resolution} · {aspectRatio || 'AUTO'}</span>
                            {generatedImages.length > 0 && (
                                <span className="text-muted" style={{ marginLeft: 12 }}>
                                    {generatedImages.length} 张图片
                                </span>
                            )}
                        </div>
                        <div className="preview-toolbar-right">
                            {isProcessing && (
                                <button className="btn btn-ghost btn-sm" onClick={handleCancel}>
                                    取消
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="preview-container">
                        {/* 主预览区域 - 生成的图片 */}
                        {generatedImages.length === 0 && !previewImage ? (
                            <div className="preview-empty">
                                <div className="preview-empty-icon">◎</div>
                                <div className="preview-empty-text">
                                    <div>输入提示词并点击「生成」</div>
                                    <div>或点击「预览」查看当前视口截图</div>
                                </div>
                            </div>
                        ) : generatedImages.length === 0 && previewImage ? (
                            // 只有截图预览，没有生成图
                            <div className="preview-single">
                                <img src={previewImage} alt="视口截图" className="preview-image" />
                                <div className="preview-caption">视口截图预览</div>
                            </div>
                        ) : generatedImages.length === 1 ? (
                            // 单张生成图
                            <img src={generatedImages[0]} alt="生成结果" className="preview-image" />
                        ) : (
                            // 多张生成图 - 网格显示（支持拖拽排序）
                            <div className={`preview-grid ${generatedImages.length <= 2 ? 'cols-2' : generatedImages.length <= 4 ? 'cols-2-2' : 'cols-3'}`}>
                                {generatedImages.map((img, index) => (
                                    <div
                                        key={`img-${index}-${img.slice(-20)}`}
                                        className={`preview-grid-item ${draggedIndex === index ? 'dragging' : ''}`}
                                        onClick={() => setLightboxImage(img)}
                                        title="点击放大 / 拖拽排序"
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <img src={img} alt={`结果 ${index + 1}`} draggable={false} />
                                        <div className="preview-grid-index">{index + 1}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 左下角截图预览小窗口 - 仅在有生成图时显示 */}
                        {previewImage && generatedImages.length > 0 && (
                            <div className="preview-thumbnail">
                                <div className="preview-thumbnail-label">参考图</div>
                                <img src={previewImage} alt="参考截图" />
                            </div>
                        )}
                    </div>

                    {/* 进度条 */}
                    {status === 'generating' && (
                        <div className="preview-progress">
                            <div className="progress-bar">
                                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="progress-info">
                                <span>{statusMessage}</span>
                                <span>{progress > 0 ? `${progress}%` : ''}</span>
                            </div>
                        </div>
                    )}
                </main>

                {/* 历史面板 */}
                <aside className="history-panel">
                    <div className="history-header">历史记录</div>
                    <div className="history-list">
                        {history.length === 0 ? (
                            <div className="history-empty">
                                <span>暂无记录</span>
                            </div>
                        ) : (
                            history.map((item) => (
                                <div
                                    key={item.id}
                                    className={`history-item ${selectedHistoryItem?.id === item.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedHistoryItem(item);
                                        if (item.thumbnails.length > 0) {
                                            setGeneratedImages(item.thumbnails.map(t => `data:image/jpeg;base64,${t}`));
                                        }
                                    }}
                                >
                                    <div className="history-thumb">
                                        {item.thumbnails.length > 0 && (
                                            <img src={`data:image/jpeg;base64,${item.thumbnails[0]}`} alt="" />
                                        )}
                                    </div>
                                    <div className="history-info">
                                        <div className="history-prompt">{item.prompt}</div>
                                        <div className="history-meta">
                                            {new Date(item.timestamp).toLocaleDateString('zh-CN')}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {selectedHistoryItem && selectedHistoryItem.paths.length > 0 && (
                        <div className="history-footer">
                            <button
                                className="btn btn-secondary btn-sm"
                                style={{ width: '100%' }}
                                onClick={() => handleOpenFolder(selectedHistoryItem.paths[0])}
                            >
                                打开文件夹
                            </button>
                        </div>
                    )}
                </aside>
            </div>

            {/* 设置弹窗 */}
            {showSettings && (
                <div className="modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">设置</div>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowSettings(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="control-group">
                                <label className="label">API Key</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Google AI API Key"
                                    value={settings.apiKey || ''}
                                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                                />
                                <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                    也可设置环境变量 GEMINI_API_KEY
                                </p>
                            </div>

                            <div className="control-group">
                                <label className="label">代理地址</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="例如 http://127.0.0.1:7890"
                                    value={settings.proxyUrl || ''}
                                    onChange={(e) => setSettings({ ...settings, proxyUrl: e.target.value })}
                                />
                                <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                    留空使用系统代理，也可设置 HTTP_PROXY 环境变量
                                </p>
                            </div>

                            <div className="control-divider" />

                            <div className="control-group">
                                <label className="label">输出目录</label>
                                <div className="segment-group">
                                    <div
                                        className={`segment-option ${settings.outputMode === 'auto' ? 'active' : ''}`}
                                        onClick={() => setSettings({ ...settings, outputMode: 'auto' })}
                                    >
                                        跟随文件
                                    </div>
                                    <div
                                        className={`segment-option ${settings.outputMode === 'fixed' ? 'active' : ''}`}
                                        onClick={() => setSettings({ ...settings, outputMode: 'fixed' })}
                                    >
                                        固定目录
                                    </div>
                                </div>
                            </div>

                            {settings.outputMode === 'fixed' && (
                                <div className="control-group">
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="D:\Renders"
                                        value={settings.outputFolder || ''}
                                        onChange={(e) => setSettings({ ...settings, outputFolder: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                                取消
                            </button>
                            <button className="btn btn-primary" onClick={handleSaveSettings}>
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 错误提示 */}
            {error && <div className="toast">{error}</div>}

            {/* 图片 AB 对比 Lightbox */}
            {lightboxImage && (
                <div className="lightbox" onClick={() => setLightboxImage(null)}>
                    <div className="lightbox-compare" onClick={(e) => e.stopPropagation()}>
                        <div className="compare-container">
                            {/* 原始截图 - 左侧，使用 clipPath 裁切 */}
                            <div
                                className="compare-left"
                                style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                            >
                                {previewImage && (
                                    <img src={previewImage} alt="原始截图" />
                                )}
                                <div className="compare-label compare-label-left">原始截图</div>
                            </div>

                            {/* AI 生成图 - 右侧（底层） */}
                            <div className="compare-right">
                                <img src={lightboxImage} alt="AI 渲染" />
                                <div className="compare-label compare-label-right">AI 渲染</div>
                            </div>

                            {/* 分割线 */}
                            <div
                                className="compare-slider"
                                style={{ left: `${comparePosition}%` }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    const container = e.currentTarget.parentElement;
                                    if (!container) return;

                                    const handleMove = (moveEvent: MouseEvent) => {
                                        const rect = container.getBoundingClientRect();
                                        const x = moveEvent.clientX - rect.left;
                                        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
                                        setComparePosition(percent);
                                    };

                                    const handleUp = () => {
                                        document.removeEventListener('mousemove', handleMove);
                                        document.removeEventListener('mouseup', handleUp);
                                    };

                                    document.addEventListener('mousemove', handleMove);
                                    document.addEventListener('mouseup', handleUp);
                                }}
                            >
                                <div className="compare-slider-handle">◀ ▶</div>
                            </div>
                        </div>

                        <button className="lightbox-close" onClick={() => setLightboxImage(null)}>×</button>
                        <div className="compare-hint">← 拖动分割线对比 →</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
