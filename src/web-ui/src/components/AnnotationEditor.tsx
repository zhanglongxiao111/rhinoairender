import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Type, Trash2, Check, X, Undo, Eraser, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface AnnotationEditorProps {
    imageUrl: string;
    onApply: (annotatedImageUrl: string) => void;
    onCancel: () => void;
}

type Tool = 'pen' | 'text' | 'eraser' | 'pan';

interface DrawLine {
    id: string;
    points: number[]; // [x1, y1, x2, y2, ...]
    color: string;
    strokeWidth: number;
}

interface TextItem {
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
    fontSize: number;
}

// 预设颜色
const COLORS = [
    { name: '红色', value: '#F04E30' },
    { name: '蓝色', value: '#2196F3' },
    { name: '绿色', value: '#4CAF50' },
    { name: '黄色', value: '#FFEB3B' },
    { name: '白色', value: '#FFFFFF' },
    { name: '黑色', value: '#000000' },
];

const FONT_SIZES = [16, 24, 32, 48, 64];

// 生成唯一ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// 计算点到线段的距离
function pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// 检查点是否在折线上
function isPointOnLine(px: number, py: number, points: number[], threshold: number = 10): boolean {
    for (let i = 0; i < points.length - 2; i += 2) {
        const dist = pointToLineDistance(px, py, points[i], points[i + 1], points[i + 2], points[i + 3]);
        if (dist < threshold) return true;
    }
    return false;
}

// 检查点是否在文字区域内
function isPointInTextBounds(px: number, py: number, text: TextItem, ctx: CanvasRenderingContext2D): boolean {
    ctx.font = `bold ${text.fontSize}px Arial`;
    const metrics = ctx.measureText(text.text);
    const width = metrics.width;
    const height = text.fontSize;

    return px >= text.x && px <= text.x + width && py >= text.y - height && py <= text.y;
}

export function AnnotationEditor({ imageUrl, onApply, onCancel }: AnnotationEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const imageLoadedRef = useRef(false); // 用于超时检查

    // 加载状态
    const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');

    // 工具状态
    const [tool, setTool] = useState<Tool>('pen');
    const [currentColor, setCurrentColor] = useState('#F04E30');
    const [currentFontSize, setCurrentFontSize] = useState(32);
    const [strokeWidth, setStrokeWidth] = useState(3);

    // 缩放和平移
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // 绘图数据
    const [lines, setLines] = useState<DrawLine[]>([]);
    const [texts, setTexts] = useState<TextItem[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentLine, setCurrentLine] = useState<number[]>([]);

    // 文字编辑
    const [editingText, setEditingText] = useState<{ id: string | null; x: number; y: number } | null>(null);
    const [textInputValue, setTextInputValue] = useState('');
    const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
    const [dragOffset] = useState({ x: 0, y: 0 });

    // 画布尺寸 - 动态计算
    const [canvasSize, setCanvasSize] = useState({ width: 900, height: 600 });

    // 动态调整画布尺寸
    useEffect(() => {
        const updateSize = () => {
            // 使用窗口尺寸，留出工具栏和边距
            const width = Math.max(800, window.innerWidth - 80);
            const height = Math.max(500, window.innerHeight - 180);
            setCanvasSize({ width, height });
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    // 加载图片
    useEffect(() => {
        if (!imageUrl) {
            setLoadingState('error');
            setErrorMessage('没有图片可编辑');
            return;
        }

        setLoadingState('loading');
        imageLoadedRef.current = false;
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            imageRef.current = img;
            imageLoadedRef.current = true;
            // 自动缩放以适应画布
            const scaleX = (canvasSize.width - 40) / img.width;
            const scaleY = (canvasSize.height - 40) / img.height;
            const autoScale = Math.min(scaleX, scaleY, 1);
            setScale(autoScale);
            // 居中
            setOffset({
                x: (canvasSize.width - img.width * autoScale) / 2,
                y: (canvasSize.height - img.height * autoScale) / 2
            });
            setLoadingState('loaded');
        };

        img.onerror = () => {
            imageLoadedRef.current = true; // 标记为完成（虽然失败）
            setLoadingState('error');
            setErrorMessage('图片加载失败');
        };

        // 超时处理 - 使用 ref 检查实际状态
        const timeout = setTimeout(() => {
            if (!imageLoadedRef.current) {
                setLoadingState('error');
                setErrorMessage('图片加载超时');
            }
        }, 10000);

        img.src = imageUrl;

        return () => clearTimeout(timeout);
    }, [imageUrl]);

    // 屏幕坐标转图片坐标
    const screenToImage = useCallback((screenX: number, screenY: number) => {
        return {
            x: (screenX - offset.x) / scale,
            y: (screenY - offset.y) / scale
        };
    }, [offset, scale]);

    // 图片坐标转屏幕坐标
    const imageToScreen = useCallback((imgX: number, imgY: number) => {
        return {
            x: imgX * scale + offset.x,
            y: imgY * scale + offset.y
        };
    }, [offset, scale]);

    // 获取鼠标在画布上的位置
    const getCanvasPosition = useCallback((e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }, []);

    // 重绘画布
    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const img = imageRef.current;
        if (!canvas || !ctx || !img || loadingState !== 'loaded') return;

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 保存状态
        ctx.save();

        // 应用变换
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        // 绘制背景图片
        ctx.drawImage(img, 0, 0);

        // 绘制所有线条
        lines.forEach(line => {
            if (line.points.length < 4) return;
            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(line.points[0], line.points[1]);
            for (let i = 2; i < line.points.length; i += 2) {
                ctx.lineTo(line.points[i], line.points[i + 1]);
            }
            ctx.stroke();
        });

        // 绘制当前正在画的线条
        if (currentLine.length >= 4) {
            ctx.beginPath();
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(currentLine[0], currentLine[1]);
            for (let i = 2; i < currentLine.length; i += 2) {
                ctx.lineTo(currentLine[i], currentLine[i + 1]);
            }
            ctx.stroke();
        }

        // 绘制所有文字
        texts.forEach(text => {
            ctx.font = `bold ${text.fontSize}px Arial`;
            ctx.fillStyle = text.color;
            ctx.fillText(text.text, text.x, text.y);
        });

        // 恢复状态
        ctx.restore();
    }, [lines, texts, currentLine, currentColor, strokeWidth, offset, scale, loadingState]);

    // 监听状态变化重绘
    useEffect(() => {
        redraw();
    }, [redraw]);

    // 鼠标按下
    const handleMouseDown = (e: React.MouseEvent) => {
        // 如果当前正在编辑文字，先保存
        if (editingText && textInputValue.trim()) {
            if (editingText.id) {
                // 更新现有文字
                setTexts(prev => prev.map(t =>
                    t.id === editingText.id
                        ? { ...t, text: textInputValue, color: currentColor, fontSize: currentFontSize }
                        : t
                ));
            } else {
                // 添加新文字
                setTexts(prev => [...prev, {
                    id: generateId(),
                    x: editingText.x,
                    y: editingText.y + currentFontSize,
                    text: textInputValue,
                    color: currentColor,
                    fontSize: currentFontSize
                }]);
            }
        }
        // 清除编辑状态
        setEditingText(null);
        setTextInputValue('');

        const pos = getCanvasPosition(e);
        if (!pos) return;

        const imgPos = screenToImage(pos.x, pos.y);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (tool === 'pan') {
            setIsPanning(true);
            setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        } else if (tool === 'pen') {
            setIsDrawing(true);
            setCurrentLine([imgPos.x, imgPos.y]);
        } else if (tool === 'eraser' && ctx) {
            // 检查是否点击了线条
            for (let i = lines.length - 1; i >= 0; i--) {
                if (isPointOnLine(imgPos.x, imgPos.y, lines[i].points, 15 / scale)) {
                    setLines(prev => prev.filter((_, idx) => idx !== i));
                    return;
                }
            }
            // 检查是否点击了文字
            for (let i = texts.length - 1; i >= 0; i--) {
                if (isPointInTextBounds(imgPos.x, imgPos.y, texts[i], ctx)) {
                    setTexts(prev => prev.filter((_, idx) => idx !== i));
                    return;
                }
            }
        } else if (tool === 'text') {
            // 检查是否点击了现有文字（需要 ctx）
            if (ctx) {
                for (let i = texts.length - 1; i >= 0; i--) {
                    if (isPointInTextBounds(imgPos.x, imgPos.y, texts[i], ctx)) {
                        // 开始编辑现有文字
                        setEditingText({ id: texts[i].id, x: texts[i].x, y: texts[i].y });
                        setTextInputValue(texts[i].text);
                        setCurrentColor(texts[i].color);
                        setCurrentFontSize(texts[i].fontSize);
                        return;
                    }
                }
            }
            // 添加新文字（不需要 ctx）
            setEditingText({ id: null, x: imgPos.x, y: imgPos.y });
            setTextInputValue('');
        }
    };

    // 鼠标移动
    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        } else if (isDrawing && tool === 'pen') {
            const pos = getCanvasPosition(e);
            if (!pos) return;
            const imgPos = screenToImage(pos.x, pos.y);
            setCurrentLine(prev => [...prev, imgPos.x, imgPos.y]);
        } else if (draggingTextId) {
            const pos = getCanvasPosition(e);
            if (!pos) return;
            const imgPos = screenToImage(pos.x, pos.y);
            setTexts(prev => prev.map(t =>
                t.id === draggingTextId
                    ? { ...t, x: imgPos.x - dragOffset.x, y: imgPos.y - dragOffset.y }
                    : t
            ));
        }
    };

    // 鼠标释放
    const handleMouseUp = () => {
        if (isPanning) {
            setIsPanning(false);
        } else if (isDrawing && currentLine.length >= 4) {
            setLines(prev => [...prev, {
                id: generateId(),
                points: currentLine,
                color: currentColor,
                strokeWidth: strokeWidth
            }]);
        }
        setIsDrawing(false);
        setCurrentLine([]);
        setDraggingTextId(null);
    };

    // 滚轮缩放
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        handleZoom(delta);
    };

    // 缩放
    const handleZoom = (delta: number) => {
        setScale(prev => Math.max(0.2, Math.min(3, prev + delta)));
    };

    // 确认文字输入
    const confirmTextInput = () => {
        if (!editingText || !textInputValue.trim()) {
            setEditingText(null);
            setTextInputValue('');
            return;
        }

        if (editingText.id) {
            // 更新现有文字
            setTexts(prev => prev.map(t =>
                t.id === editingText.id
                    ? { ...t, text: textInputValue, color: currentColor, fontSize: currentFontSize }
                    : t
            ));
        } else {
            // 添加新文字
            setTexts(prev => [...prev, {
                id: generateId(),
                x: editingText.x,
                y: editingText.y + currentFontSize, // 文字基线向下偏移
                text: textInputValue,
                color: currentColor,
                fontSize: currentFontSize
            }]);
        }

        setEditingText(null);
        setTextInputValue('');
    };

    // 撤销
    const handleUndo = () => {
        if (lines.length > 0) {
            setLines(prev => prev.slice(0, -1));
        } else if (texts.length > 0) {
            setTexts(prev => prev.slice(0, -1));
        }
    };

    // 清除全部
    const handleClear = () => {
        setLines([]);
        setTexts([]);
    };

    // 应用标注
    const handleApply = () => {
        const img = imageRef.current;
        if (!img) return;

        // 创建临时画布，使用原始图片尺寸
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;

        // 绘制背景图片
        ctx.drawImage(img, 0, 0);

        // 绘制所有线条
        lines.forEach(line => {
            if (line.points.length < 4) return;
            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(line.points[0], line.points[1]);
            for (let i = 2; i < line.points.length; i += 2) {
                ctx.lineTo(line.points[i], line.points[i + 1]);
            }
            ctx.stroke();
        });

        // 绘制所有文字
        texts.forEach(text => {
            ctx.font = `bold ${text.fontSize}px Arial`;
            ctx.fillStyle = text.color;
            ctx.fillText(text.text, text.x, text.y);
        });

        const dataUrl = tempCanvas.toDataURL('image/png');
        onApply(dataUrl);
    };

    // 计算文字输入框屏幕位置
    const getTextInputScreenPos = () => {
        if (!editingText) return { left: 0, top: 0 };
        const screenPos = imageToScreen(editingText.x, editingText.y);
        return { left: screenPos.x, top: screenPos.y };
    };

    const textInputPos = getTextInputScreenPos();

    // 加载中
    if (loadingState === 'loading') {
        return (
            <div className="annotation-editor-overlay">
                <div className="annotation-editor">
                    <div className="annotation-toolbar">
                        <div className="annotation-tools">
                            <span style={{ color: 'var(--color-text-secondary)' }}>加载中...</span>
                        </div>
                        <div className="annotation-actions">
                            <button className="annotation-btn-cancel" onClick={onCancel}>
                                <X size={16} /> 取消
                            </button>
                        </div>
                    </div>
                    <div className="annotation-canvas-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: canvasSize.width, height: canvasSize.height }}>
                        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                            正在加载图片...
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 错误
    if (loadingState === 'error') {
        return (
            <div className="annotation-editor-overlay">
                <div className="annotation-editor">
                    <div className="annotation-toolbar">
                        <div className="annotation-tools">
                            <span style={{ color: 'var(--color-error)' }}>加载失败</span>
                        </div>
                        <div className="annotation-actions">
                            <button className="annotation-btn-cancel" onClick={onCancel}>
                                <X size={16} /> 返回
                            </button>
                        </div>
                    </div>
                    <div className="annotation-canvas-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: canvasSize.width, height: canvasSize.height }}>
                        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                            <p>{errorMessage}</p>
                            <button className="annotation-btn-cancel" onClick={onCancel} style={{ marginTop: 16 }}>
                                <X size={16} /> 返回
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="annotation-editor-overlay">
            <div className="annotation-editor">
                {/* 工具栏 */}
                <div className="annotation-toolbar">
                    <div className="annotation-tools">
                        <button
                            className={`annotation-tool-btn ${tool === 'pen' ? 'active' : ''}`}
                            onClick={() => setTool('pen')}
                            title="画笔"
                        >
                            <Pencil size={18} />
                        </button>
                        <button
                            className={`annotation-tool-btn ${tool === 'text' ? 'active' : ''}`}
                            onClick={() => setTool('text')}
                            title="文字"
                        >
                            <Type size={18} />
                        </button>
                        <button
                            className={`annotation-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                            onClick={() => setTool('eraser')}
                            title="橡皮擦 (点击删除)"
                        >
                            <Eraser size={18} />
                        </button>
                        <button
                            className={`annotation-tool-btn ${tool === 'pan' ? 'active' : ''}`}
                            onClick={() => setTool('pan')}
                            title="移动画布"
                        >
                            <Move size={18} />
                        </button>

                        <div className="annotation-divider" />

                        {/* 缩放 */}
                        <button
                            className="annotation-tool-btn"
                            onClick={() => handleZoom(-0.2)}
                            title="缩小"
                        >
                            <ZoomOut size={18} />
                        </button>
                        <span className="annotation-zoom-value">{Math.round(scale * 100)}%</span>
                        <button
                            className="annotation-tool-btn"
                            onClick={() => handleZoom(0.2)}
                            title="放大"
                        >
                            <ZoomIn size={18} />
                        </button>

                        <div className="annotation-divider" />

                        {/* 颜色 */}
                        <div className="annotation-colors">
                            {COLORS.map(color => (
                                <button
                                    key={color.value}
                                    className={`annotation-color-btn ${currentColor === color.value ? 'active' : ''}`}
                                    style={{ backgroundColor: color.value }}
                                    onClick={() => setCurrentColor(color.value)}
                                    title={color.name}
                                />
                            ))}
                        </div>

                        {/* 字体大小 */}
                        {tool === 'text' && (
                            <select
                                className="annotation-font-select"
                                value={currentFontSize}
                                onChange={(e) => setCurrentFontSize(Number(e.target.value))}
                            >
                                {FONT_SIZES.map(size => (
                                    <option key={size} value={size}>{size}px</option>
                                ))}
                            </select>
                        )}

                        {/* 笔画粗细 */}
                        {tool === 'pen' && (
                            <div className="annotation-stroke-width" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>粗细:</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="20"
                                    value={strokeWidth}
                                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                                    style={{ width: '80px', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', minWidth: '24px' }}>{strokeWidth}px</span>
                            </div>
                        )}

                        <div className="annotation-divider" />

                        <button
                            className="annotation-tool-btn"
                            onClick={handleUndo}
                            title="撤销"
                            disabled={lines.length === 0 && texts.length === 0}
                        >
                            <Undo size={18} />
                        </button>
                        <button
                            className="annotation-tool-btn"
                            onClick={handleClear}
                            title="清除全部"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>

                    <div className="annotation-actions">
                        <button className="annotation-btn-cancel" onClick={onCancel}>
                            <X size={16} /> 取消
                        </button>
                        <button className="annotation-btn-apply" onClick={handleApply}>
                            <Check size={16} /> 应用
                        </button>
                    </div>
                </div>

                {/* 画布容器 */}
                <div className="annotation-canvas-container" ref={containerRef} style={{ position: 'relative', flex: 1 }}>
                    <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                        style={{
                            cursor: tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') :
                                tool === 'eraser' ? 'crosshair' :
                                    tool === 'text' ? 'text' : 'crosshair'
                        }}
                    />

                    {/* 文字输入框 */}
                    {editingText && (
                        <div
                            className="annotation-text-overlay"
                            style={{
                                position: 'absolute',
                                left: textInputPos.left,
                                top: textInputPos.top,
                                zIndex: 1000,
                                pointerEvents: 'auto'
                            }}
                        >
                            <input
                                type="text"
                                value={textInputValue}
                                onChange={(e) => setTextInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') confirmTextInput();
                                    if (e.key === 'Escape') {
                                        setEditingText(null);
                                        setTextInputValue('');
                                    }
                                }}
                                placeholder="输入文字..."
                                autoFocus
                                style={{
                                    color: currentColor,
                                    fontSize: Math.max(16, currentFontSize * scale),
                                    fontWeight: 'bold',
                                    background: 'rgba(0,0,0,0.7)',
                                    border: '2px solid ' + currentColor,
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    minWidth: '150px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* 提示 */}
                <div className="annotation-hint">
                    {tool === 'pen' && '拖动绘制 | 滚轮缩放'}
                    {tool === 'text' && '点击添加文字 | 点击已有文字编辑'}
                    {tool === 'eraser' && '点击线条或文字删除'}
                    {tool === 'pan' && '拖动移动画布 | 滚轮缩放'}
                </div>
            </div>
        </div>
    );
}

export default AnnotationEditor;
