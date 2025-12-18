import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import {
    Settings2,
    ScanEye,
    List,
    LayoutDashboard,
    History as HistoryIcon,
    Star,
    RefreshCw,
    Copy,
    FolderOpen,
    X,
    ArrowRight,
    Columns,
    Folder,
    Moon,
    Sun,
    Cloud,
    Pencil
} from 'lucide-react';
import { useBridge } from './hooks/useBridge';

// 动态导入标注编辑器（避免 konva 阻塞主应用加载）
const AnnotationEditor = lazy(() => import('./components/AnnotationEditor'));

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

// 诙谐加载消息（建筑师幽默版）
const WITTY_MESSAGES = {
    start: [
        "正在唤醒沉睡的 GPU...",
        "显卡风扇已起飞...",
        "正在连接到灵感矩阵...",
        "正在与 Gemini Pro 建立神经连接...",
        "载入建筑几何体数据...",
    ],
    waiting: [
        "正在教 AI 什么是'五彩斑斓的黑'...",
        "正在跟柯布西耶探讨光影...",
        "别催了，正在一块砖一块砖地砌...",
        "正在计算空气中尘埃的丁达尔效应...",
        "正在给混凝土表面添加沧桑感...",
        "AI 正在思考：这是窗户还是门？...",
        "正在渲染那个'五分钟后就要'的方案...",
        "正在把'感觉不对'转化为像素...",
        "正在模拟甲方满意的眼神...",
        "正在寻找丢失的光子...",
        "正在阅读《建筑十书》...",
        "正在模拟苏黎世的阴雨天光线...",
        "正在对齐每一个像素的网格...",
        "慢工出细活，AI 也是...",
    ],
    progress: [
        "正在上传几何体数据...",
        "正在进行光线追踪降噪...",
        "正在细化材质纹理...",
        "最终像素光栅化中...",
        "正在进行色彩校正...",
        "AI 正在精雕细琢...",
        "即将完成...",
    ],
};

// 获取随机诙谐消息
const getWittyMessage = (category: keyof typeof WITTY_MESSAGES): string => {
    const messages = WITTY_MESSAGES[category];
    return messages[Math.floor(Math.random() * messages.length)];
};

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
    const [referenceImages, setReferenceImages] = useState<string[]>([]); // 参考图列表（base64）
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null);

    // UI 状态
    const [showSettings, setShowSettings] = useState(false);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false); // 只显示收藏
    const [lightboxImage, setLightboxImage] = useState<string | null>(null); // Lightbox 放大图片
    const [comparePosition, setComparePosition] = useState(50); // AB 对比滑块位置 (0-100)
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null); // 拖拽排序
    const [historyView, setHistoryView] = useState<'list' | 'masonry'>('list'); // 历史面板视图
    const [wittyMessage, setWittyMessage] = useState(''); // 诙谐加载消息
    const [generateStartTime, setGenerateStartTime] = useState<number | null>(null); // 生成开始时间
    const [elapsedTime, setElapsedTime] = useState('00:00.00'); // 已用时间显示
    const [themeMode, setThemeMode] = useState<'auto' | 'light' | 'dark'>('auto'); // 主题模式
    const [rhinoIsDark, setRhinoIsDark] = useState(false); // Rhino主题状态
    const [canvasView, setCanvasView] = useState<'render' | 'source' | 'compare'>('render'); // 画布视图模式
    const [showAnnotationEditor, setShowAnnotationEditor] = useState(false); // 显示标注编辑器
    const [settings, setSettings] = useState<SettingsData>({
        outputMode: 'auto',
        outputFolder: '',
        apiKey: '',
        provider: 'gemini',
        devMode: false,
        useGeminiApi: true,
        useVertexAI: false,
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
        onHistoryImages: (data) => {
            // 收到原图和截图后更新显示
            if (data.images && data.images.length > 0) {
                setGeneratedImages(data.images);
            }
            if (data.screenshot) {
                setPreviewImage(data.screenshot);
            }
        },
        onFavoriteStatus: (data) => {
            // 更新历史记录中的收藏状态
            setHistory(prev => prev.map(item =>
                item.id === data.historyId
                    ? { ...item, isFavorite: data.isFavorite }
                    : item
            ));
            // 如果当前选中的项是被操作的项，也更新它
            if (selectedHistoryItem?.id === data.historyId) {
                setSelectedHistoryItem(prev => prev ? { ...prev, isFavorite: data.isFavorite } : null);
            }
            setStatusMessage(data.isFavorite ? '已收藏' : '已取消收藏');
        },
        onThemeUpdate: (data) => {
            setRhinoIsDark(data.isDark);
        },
    });

    // 初始化
    useEffect(() => {
        const timer = setTimeout(() => {
            bridge.listNamedViews();
            bridge.getSettings();
            bridge.getHistory();
            bridge.getTheme();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // 生成计时器效果
    useEffect(() => {
        if (status !== 'generating' || !generateStartTime) return;

        const timerInterval = setInterval(() => {
            const elapsed = Date.now() - generateStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const ms = Math.floor((elapsed % 1000) / 10);
            setElapsedTime(`00:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`);
        }, 50);

        return () => clearInterval(timerInterval);
    }, [status, generateStartTime]);

    // 诙谐消息轮换效果
    useEffect(() => {
        if (status !== 'generating') return;

        const messageInterval = setInterval(() => {
            const r = Math.random();
            if (r > 0.7) {
                // 30% 概率显示进度消息
                setWittyMessage(`>> ${getWittyMessage('progress')}`);
            } else {
                // 70% 概率显示等待消息
                setWittyMessage(getWittyMessage('waiting'));
            }
        }, 5000);

        return () => clearInterval(messageInterval);
    }, [status]);

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

        // 启动计时器和诙谐消息
        setGenerateStartTime(Date.now());
        setWittyMessage(getWittyMessage('start'));
        setElapsedTime('00:00.00');

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
            referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        } as any);
    }, [bridge, prompt, source, selectedNamedView, count, resolution, aspectRatio, mode, contrastAdjust, longEdge, referenceImages]);

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

    // 复制提示词到剪贴板
    const handleCopyPrompt = useCallback((text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setStatusMessage('已复制到剪贴板');
            setTimeout(() => setStatusMessage('就绪'), 1500);
        }).catch(() => {
            setError('复制失败');
        });
    }, []);

    // 使用历史记录的设置
    const handleUseHistorySettings = useCallback((item: HistoryItem) => {
        setPrompt(item.prompt);
        if (item.source === 'named' && item.namedView) {
            setSource('named');
            setSelectedNamedView(item.namedView);
        } else {
            setSource('active');
        }
        setStatusMessage('已加载历史设置');
    }, []);

    // 计算有效主题
    const effectiveTheme = themeMode === 'auto' ? (rhinoIsDark ? 'dark' : 'light') : themeMode;

    // 主题切换（循环：light → auto → dark → light）
    const cycleTheme = useCallback(() => {
        if (themeMode === 'light') {
            setThemeMode('auto');
        } else if (themeMode === 'auto') {
            setThemeMode('dark');
        } else {
            setThemeMode('light');
        }
    }, [themeMode]);

    const isProcessing = status === 'generating' || status === 'capturing';

    return (
        <div className={`app-swiss ${effectiveTheme === 'dark' ? 'dark' : 'light'}`}>
            {/* 三栏布局 */}
            <div className="layout-swiss">
                {/* ============ 左侧面板 ============ */}
                <aside className="panel-left swiss-grid-r">
                    {/* 头部 - Logo 和主题切换 */}
                    <header className="panel-header swiss-grid-b">
                        <div>
                            <h1 className="type-h1 text-2xl">
                                SA&amp;DAGA<br />ARCHITECTS
                            </h1>
                            <div className="header-badges">
                                <span className="badge-outline">BETA</span>
                                <span className="type-label">AI RENDER v2.0</span>
                            </div>
                        </div>
                        <button
                            className="btn-theme"
                            onClick={cycleTheme}
                            title={
                                themeMode === 'light' ? '浅色模式 (点击切换到自动)' :
                                    themeMode === 'auto' ? `自动模式 (当前${effectiveTheme === 'dark' ? '深色' : '浅色'}，点击切换到深色)` :
                                        '深色模式 (点击切换到浅色)'
                            }
                        >
                            {themeMode === 'light' ? <Sun size={16} /> :
                                themeMode === 'auto' ? <Cloud size={16} /> :
                                    <Moon size={16} />}
                        </button>
                    </header>

                    {/* 控制区域 */}
                    <div className="panel-body">
                        {/* 提示词 */}
                        <div className="control-section swiss-grid-b">
                            <div className="control-section-header">
                                <label className="type-label accent">提示词 / Prompt</label>
                                <span className="type-sub">CMD + ENTER</span>
                            </div>
                            <textarea
                                className="textarea-swiss"
                                placeholder="// 在此处输入建筑场景描述..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                        </div>

                        {/* 参考图上传 */}
                        <div className="control-section swiss-grid-b">
                            <label className="type-label">参考图 / Reference Images</label>
                            <span className="type-sub">最多 3 张，截图为图1 / Max 3, screenshot is Image 1</span>

                            {/* 上传区域 */}
                            <div style={{ marginTop: 'var(--space-3)' }}>
                                {referenceImages.length < 3 && (
                                    <label className="reference-upload-label">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files || []);
                                                const remainingSlots = 3 - referenceImages.length;
                                                const filesToProcess = files.slice(0, remainingSlots);

                                                filesToProcess.forEach(file => {
                                                    const reader = new FileReader();
                                                    reader.onload = (event) => {
                                                        const base64 = event.target?.result as string;
                                                        setReferenceImages(prev => [...prev, base64]);
                                                    };
                                                    reader.readAsDataURL(file);
                                                });
                                                e.target.value = '';
                                            }}
                                        />
                                        <div className="reference-upload-button">
                                            <Folder size={20} />
                                            <span>点击选择图片 / Click to Upload</span>
                                        </div>
                                    </label>
                                )}

                                {/* 预览缩略图 */}
                                {referenceImages.length > 0 && (
                                    <div className="reference-thumbnails">
                                        {referenceImages.map((image, index) => (
                                            <div key={index} className="reference-thumbnail">
                                                <img src={image} alt={`参考图 ${index + 2}`} />
                                                <button
                                                    className="reference-delete"
                                                    onClick={() => {
                                                        setReferenceImages(prev => prev.filter((_, i) => i !== index));
                                                    }}
                                                    title="删除"
                                                >
                                                    <X size={14} />
                                                </button>
                                                <span className="reference-index">图{index + 2}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 视图来源 */}
                        <div className="control-section swiss-grid-b">
                            <label className="type-label">视图来源 / Source</label>
                            <div className="option-cards">
                                <button
                                    className={`option-card ${source === 'active' ? 'active' : ''}`}
                                    onClick={() => setSource('active')}
                                >
                                    当前视口
                                    <span className="type-sub">Active Viewport</span>
                                </button>
                                <button
                                    className={`option-card ${source === 'named' ? 'active' : ''}`}
                                    onClick={() => setSource('named')}
                                >
                                    命名视图
                                    <span className="type-sub">Named View</span>
                                </button>
                            </div>
                            <button
                                className="btn-capture"
                                onClick={handleCapturePreview}
                                disabled={isProcessing}
                            >
                                <ScanEye size={16} style={{ marginRight: '8px' }} /> 截取当前视图预览 / Capture Preview
                            </button>
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
                                        <RefreshCw size={12} />
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

                        {/* 比例 - 5列网格布局 */}
                        <div className="control-section swiss-grid-b">
                            <label className="type-label">画幅比例 / Aspect Ratio</label>
                            <div className="aspect-ratio-grid">
                                {ASPECT_RATIOS.filter(r => r.value !== '21:9').map((ratio) => (
                                    <button
                                        key={ratio.value}
                                        className={`aspect-ratio-box ${aspectRatio === ratio.value ? 'active' : ''}`}
                                        onClick={() => setAspectRatio(ratio.value)}
                                    >
                                        <span>{ratio.label}</span>
                                    </button>
                                ))}
                                {/* 21:9 占据整行 */}
                                <button
                                    className={`aspect-ratio-box aspect-ratio-wide ${aspectRatio === '21:9' ? 'active' : ''}`}
                                    onClick={() => setAspectRatio('21:9')}
                                >
                                    <span>21:9 CINEMATIC</span>
                                </button>
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

                    {/* 底部操作按钮 */}
                    <div className="panel-footer swiss-grid-t">
                        <button
                            className="btn-settings"
                            onClick={() => setShowSettings(true)}
                            title="设置"
                        >
                            <Settings2 size={20} />
                        </button>
                        <button
                            className={`btn-render ${isProcessing ? 'loading' : ''}`}
                            onClick={handleGenerate}
                            disabled={isProcessing || !prompt.trim()}
                        >
                            <span className="btn-render-text">
                                {isProcessing ? '生成中 / Generating...' : '开始渲染 / Render'}
                            </span>
                            <span className="btn-render-icon"><ArrowRight size={18} /></span>
                            {isProcessing && <div className="btn-render-stripe loading-stripe" />}
                        </button>
                    </div>
                </aside>

                {/* ============ 中央画布 ============ */}
                <main className="panel-center">
                    {/* 工具栏 */}
                    <div className="canvas-toolbar swiss-grid-b">
                        <div className="toolbar-left">
                            <div className="toolbar-file">
                                <Folder size={14} />
                                <span className="type-mono">PROJECT_RENDER.3DM</span>
                            </div>
                            <div className="toolbar-divider" />
                            <div className="toolbar-status">
                                <span className={`status-dot ${isProcessing ? 'processing' : ''}`}>●</span>
                                <span>{isProcessing ? 'RENDERING' : 'READY'}</span>
                            </div>
                        </div>
                        <div className="toolbar-right">
                            <div className="toolbar-tabs">
                                <button
                                    className={`toolbar-tab ${canvasView === 'render' ? 'active' : ''}`}
                                    onClick={() => setCanvasView('render')}
                                >
                                    Render
                                </button>
                                <button
                                    className={`toolbar-tab ${canvasView === 'source' ? 'active' : ''}`}
                                    onClick={() => setCanvasView('source')}
                                    disabled={!previewImage}
                                >
                                    Source
                                </button>
                                <button
                                    className={`toolbar-tab ${canvasView === 'compare' ? 'active' : ''}`}
                                    onClick={() => setCanvasView('compare')}
                                    disabled={!previewImage || generatedImages.length === 0}
                                    title="AB 对比"
                                >
                                    <Columns size={16} />
                                </button>
                                {previewImage && (
                                    <button
                                        className="toolbar-tab"
                                        onClick={() => setShowAnnotationEditor(true)}
                                        title="标注截图"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                )}
                                {isProcessing && (
                                    <button
                                        className="toolbar-tab"
                                        onClick={handleCancel}
                                        style={{ color: 'var(--color-accent)' }}
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 画布容器 - 带网格背景 */}
                    <div className="canvas-container bg-grid-pattern">
                        <div className={`canvas-wrapper ${isProcessing ? 'animate-pulse-border' : ''}`}
                            style={{ opacity: isProcessing ? 0.4 : 1 }}>

                            {/* 根据 canvasView 显示不同内容 */}
                            {canvasView === 'source' && previewImage ? (
                                <>
                                    <div className="canvas-label">Source Screenshot</div>
                                    <img src={previewImage} alt="视口截图" className="preview-image" />
                                </>
                            ) : canvasView === 'compare' && previewImage && generatedImages.length > 0 ? (
                                <>
                                    <div className="canvas-label">AB Compare</div>
                                    <div className="compare-container">
                                        <div className="compare-layer compare-before">
                                            <img src={previewImage} alt="原始截图" />
                                        </div>
                                        <div
                                            className="compare-layer compare-after"
                                            style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                                        >
                                            <img src={generatedImages[0]} alt="渲染结果" />
                                        </div>
                                        <input
                                            type="range"
                                            className="compare-slider"
                                            min="0"
                                            max="100"
                                            value={comparePosition}
                                            onChange={(e) => setComparePosition(Number(e.target.value))}
                                        />
                                        <div className="compare-labels">
                                            <span>BEFORE</span>
                                            <span>AFTER</span>
                                        </div>
                                    </div>
                                </>
                            ) : generatedImages.length === 0 && !previewImage ? (
                                <div className="preview-empty">
                                    <div className="preview-empty-icon"><ScanEye size={32} /></div>
                                    <div className="preview-empty-text">
                                        <div>输入提示词并点击「生成」</div>
                                        <div>或点击「截取预览」查看当前视口</div>
                                    </div>
                                </div>
                            ) : generatedImages.length === 0 && previewImage ? (
                                <>
                                    <div className="canvas-label">Source Screenshot</div>
                                    <img src={previewImage} alt="视口截图" className="preview-image" />
                                </>
                            ) : generatedImages.length === 1 ? (
                                <>
                                    <div className="canvas-label">AI Render Preview</div>
                                    <img
                                        src={generatedImages[0]}
                                        alt="生成结果"
                                        className="preview-image clickable"
                                        onClick={() => setLightboxImage(generatedImages[0])}
                                        title="点击放大"
                                    />
                                </>
                            ) : (
                                <>
                                    <div className="canvas-label">AI Render Preview</div>
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
                                </>
                            )}
                        </div>

                        {/* 诙谐加载状态叠加层 - 覆盖整个画布容器 */}
                        {status === 'generating' && (
                            <div className="status-overlay">
                                <div className="status-overlay-box animate-fade-in-up">
                                    <div className="status-timer">{elapsedTime}</div>
                                    <div className="status-message">{wittyMessage || statusMessage}</div>
                                    <div className="status-progress-bar">
                                        <div className="status-progress-fill loading-stripe" />
                                    </div>
                                    <div className="status-engine">Gemini AI Processing</div>
                                </div>
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

                {/* ============ 右侧历史面板 ============ */}
                <aside className="panel-right swiss-grid-l">
                    {/* 侧边栏收缩时的图标 */}
                    <div className="sidebar-collapsed-icon">
                        <HistoryIcon size={24} className="text-muted" />
                    </div>

                    {/* 侧边栏完整内容 */}
                    <div className="sidebar-content">
                        <div className="panel-header-right swiss-grid-b">
                            <div>
                                <h2 className="type-h1 text-lg">SESSION<br />HISTORY</h2>
                                <span className="type-label">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</span>
                            </div>
                            <div className="history-header-actions">
                                <button
                                    className={`btn btn-ghost btn-sm ${historyView === 'list' ? 'active' : ''}`}
                                    onClick={() => setHistoryView('list')}
                                    title="列表视图"
                                    style={{ padding: '0 4px' }}
                                >
                                    <List size={16} />
                                </button>
                                <button
                                    className={`btn btn-ghost btn-sm ${historyView === 'masonry' ? 'active' : ''}`}
                                    onClick={() => setHistoryView('masonry')}
                                    title="瀑布流视图"
                                    style={{ padding: '0 4px' }}
                                >
                                    <LayoutDashboard size={16} />
                                </button>
                                <button
                                    className={`btn btn-ghost btn-sm ${showFavoritesOnly ? 'active' : ''}`}
                                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                                    title={showFavoritesOnly ? '显示全部' : '只显示收藏'}
                                    style={{ padding: '0 4px' }}
                                >
                                    <Star size={16} fill={showFavoritesOnly ? "currentColor" : "none"} />
                                </button>
                            </div>
                        </div>
                        <div className={`history-list ${historyView === 'masonry' ? 'masonry-wrapper' : ''}`}>
                            {history.filter(item => !showFavoritesOnly || item.isFavorite).length === 0 ? (
                                <div className="history-empty">
                                    <span>{showFavoritesOnly ? '暂无收藏' : '暂无记录'}</span>
                                </div>
                            ) : historyView === 'masonry' ? (
                                // 瀑布流视图 - 只显示图片，悬停显示时间
                                history
                                    .filter(item => !showFavoritesOnly || item.isFavorite)
                                    .map((item) => (
                                        <div
                                            key={item.id}
                                            className={`masonry-col history-masonry-item ${selectedHistoryItem?.id === item.id ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedHistoryItem(item);
                                                if (item.paths && item.paths.length > 0) {
                                                    bridge.loadHistoryImages(item.paths, item.screenshotPath);
                                                }
                                            }}
                                            onDoubleClick={() => handleUseHistorySettings(item)}
                                        >
                                            {item.thumbnails.length > 0 && (
                                                <img src={`data:image/png;base64,${item.thumbnails[0]}`} alt="" />
                                            )}
                                            <div className="history-masonry-overlay">
                                                <span className="history-masonry-time">
                                                    {new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {item.isFavorite && <span className="history-favorite-badge"><Star size={10} fill="currentColor" /></span>}
                                        </div>
                                    ))
                            ) : (
                                // 列表视图
                                history
                                    .filter(item => !showFavoritesOnly || item.isFavorite)
                                    .map((item) => (
                                        <div
                                            key={item.id}
                                            className={`history-item ${selectedHistoryItem?.id === item.id ? 'active' : ''}`}
                                            onClick={() => {
                                                setSelectedHistoryItem(item);
                                                if (item.paths && item.paths.length > 0) {
                                                    bridge.loadHistoryImages(item.paths, item.screenshotPath);
                                                }
                                            }}
                                            onDoubleClick={() => handleUseHistorySettings(item)}
                                            title="单击查看 · 双击使用此设置"
                                        >
                                            <div className="history-thumb">
                                                {item.thumbnails.length > 0 && (
                                                    <img src={`data:image/png;base64,${item.thumbnails[0]}`} alt="" />
                                                )}
                                                {item.isFavorite && <span className="history-favorite-badge"><Star size={10} fill="currentColor" /></span>}
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
                        {selectedHistoryItem && (
                            <div className="history-footer">
                                <div className="history-actions">
                                    <button
                                        className={`btn btn-ghost btn-sm ${selectedHistoryItem.isFavorite ? 'active' : ''}`}
                                        onClick={() => bridge.toggleFavorite(selectedHistoryItem.id)}
                                        title={selectedHistoryItem.isFavorite ? '取消收藏' : '收藏'}
                                    >
                                        <Star size={14} fill={selectedHistoryItem.isFavorite ? "currentColor" : "none"} />
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleCopyPrompt(selectedHistoryItem.prompt)}
                                        title="复制提示词"
                                    >
                                        <Copy size={14} />
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        style={{ flex: 1 }}
                                        onClick={() => handleUseHistorySettings(selectedHistoryItem)}
                                    >
                                        使用此设置
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleOpenFolder(selectedHistoryItem.paths[0])}
                                        title="打开文件夹"
                                        disabled={!selectedHistoryItem.paths.length}
                                    >
                                        <FolderOpen size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            </div >

            {/* 设置弹窗 */}
            {
                showSettings && (
                    <div className="modal-overlay" onClick={() => setShowSettings(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-title">设置</div>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowSettings(false)}>
                                    <X size={16} />
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
                                        从 Google AI Studio 获取，同时支持 Gemini API 和 Vertex AI
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

                                <div className="control-group">
                                    <label className="label">API 端点</label>
                                    <div className="checkbox-group">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={settings.useGeminiApi !== false}
                                                onChange={(e) => setSettings({ ...settings, useGeminiApi: e.target.checked })}
                                            />
                                            <span>Gemini Developer API</span>
                                        </label>
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={settings.useVertexAI === true}
                                                onChange={(e) => setSettings({ ...settings, useVertexAI: e.target.checked })}
                                            />
                                            <span>Vertex AI Express（备用）</span>
                                        </label>
                                    </div>
                                    <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                        同时勾选时，优先使用 Gemini API，失败后自动切换到 Vertex AI
                                    </p>
                                </div>

                                {/* Vertex AI API Key - 仅当启用 Vertex AI 时显示 */}
                                {settings.useVertexAI && (
                                    <div className="control-group">
                                        <label className="label">Vertex AI API Key</label>
                                        <input
                                            type="password"
                                            className="input"
                                            placeholder="Vertex AI Express API Key"
                                            value={settings.vertexApiKey || ''}
                                            onChange={(e) => setSettings({ ...settings, vertexApiKey: e.target.value })}
                                        />
                                        <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                            从 Google Cloud Console 获取 Vertex AI 专用 API Key
                                        </p>
                                    </div>
                                )}

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
                )
            }

            {/* 错误提示 */}
            {error && <div className="toast">{error}</div>}

            {/* 图片 AB 对比 Lightbox */}
            {
                lightboxImage && (
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

                            <button className="lightbox-close" onClick={() => setLightboxImage(null)}><X size={24} /></button>
                            <div className="compare-hint">← 拖动分割线对比 →</div>
                        </div>
                    </div>
                )
            }

            {/* 标注编辑器 */}
            {showAnnotationEditor && previewImage && (
                <Suspense fallback={<div className="annotation-editor-overlay"><div style={{ color: 'white', textAlign: 'center', marginTop: '40vh' }}>加载标注编辑器...</div></div>}>
                    <AnnotationEditor
                        imageUrl={previewImage}
                        onApply={(annotatedImageUrl) => {
                            setPreviewImage(annotatedImageUrl);
                            setShowAnnotationEditor(false);
                        }}
                        onCancel={() => setShowAnnotationEditor(false)}
                    />
                </Suspense>
            )}
        </div >
    );
}

export default App;
