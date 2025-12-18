import { useState, useRef, useEffect, useCallback, Component, ReactNode } from 'react';
import { Stage, Layer, Line, Text, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
import { Pencil, Type, Trash2, Check, X, Undo, Eraser, ZoomIn, ZoomOut, Move, AlertCircle } from 'lucide-react';

interface AnnotationEditorProps {
    imageUrl: string;
    onApply: (annotatedImageUrl: string) => void;
    onCancel: () => void;
}

type Tool = 'pen' | 'text' | 'eraser' | 'pan';

interface DrawLine {
    id: string;
    points: number[];
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

// 错误边界组件
interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, ErrorBoundaryState> {
    constructor(props: { children: ReactNode; onError: () => void }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="annotation-error">
                    <AlertCircle size={48} />
                    <h3>标注编辑器加载失败</h3>
                    <p>{this.state.error?.message || '未知错误'}</p>
                    <button onClick={this.props.onError} className="annotation-btn-cancel">
                        <X size={16} /> 返回
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
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

function AnnotationEditorInner({ imageUrl, onApply, onCancel }: AnnotationEditorProps) {
    const stageRef = useRef<Konva.Stage>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');

    // 工具状态
    const [tool, setTool] = useState<Tool>('pen');
    const [currentColor, setCurrentColor] = useState('#F04E30');
    const [currentFontSize, setCurrentFontSize] = useState(32);
    const [strokeWidth] = useState(3);

    // 缩放状态
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    // 绘图数据
    const [lines, setLines] = useState<DrawLine[]>([]);
    const [texts, setTexts] = useState<TextItem[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentLine, setCurrentLine] = useState<number[]>([]);

    // 文字编辑
    const [editingText, setEditingText] = useState<{ id: string | null; x: number; y: number } | null>(null);
    const [textInputValue, setTextInputValue] = useState('');

    // 显示尺寸
    const containerWidth = 900;
    const containerHeight = 600;

    // 加载图片
    useEffect(() => {
        if (!imageUrl) {
            setLoadingState('error');
            setErrorMessage('没有图片可编辑');
            return;
        }

        setLoadingState('loading');
        const img = new window.Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            console.log('Image loaded:', img.width, 'x', img.height);
            setImage(img);
            // 自动缩放以适应容器
            const scaleX = (containerWidth - 40) / img.width;
            const scaleY = (containerHeight - 40) / img.height;
            const autoScale = Math.min(scaleX, scaleY, 1);
            setScale(autoScale);
            // 居中
            setPosition({
                x: (containerWidth - img.width * autoScale) / 2,
                y: (containerHeight - img.height * autoScale) / 2
            });
            setLoadingState('loaded');
        };

        img.onerror = (e) => {
            console.error('Image load error:', e);
            setLoadingState('error');
            setErrorMessage('图片加载失败');
        };

        // 超时处理
        const timeout = setTimeout(() => {
            if (loadingState === 'loading') {
                setLoadingState('error');
                setErrorMessage('图片加载超时');
            }
        }, 10000);

        img.src = imageUrl;

        return () => clearTimeout(timeout);
    }, [imageUrl]);

    // 生成唯一ID
    const generateId = () => Math.random().toString(36).substr(2, 9);

    // 获取鼠标在图片坐标系中的位置
    const getPointerPosition = useCallback(() => {
        const stage = stageRef.current;
        if (!stage) return null;

        const pointer = stage.getPointerPosition();
        if (!pointer) return null;

        // 转换为图片坐标
        return {
            x: (pointer.x - position.x) / scale,
            y: (pointer.y - position.y) / scale
        };
    }, [position, scale]);

    // 鼠标按下
    const handleMouseDown = () => {
        const pos = getPointerPosition();
        if (!pos) return;

        if (tool === 'pen') {
            setIsDrawing(true);
            setCurrentLine([pos.x, pos.y]);
        } else if (tool === 'text') {
            // 检查是否点击了现有文字（通过 Konva 事件处理）
            if (!editingText) {
                setEditingText({ id: null, x: pos.x, y: pos.y });
                setTextInputValue('');
            }
        }
    };

    // 鼠标移动
    const handleMouseMove = () => {
        if (!isDrawing || tool !== 'pen') return;

        const pos = getPointerPosition();
        if (!pos) return;

        setCurrentLine(prev => [...prev, pos.x, pos.y]);
    };

    // 鼠标释放
    const handleMouseUp = () => {
        if (isDrawing && currentLine.length >= 4) {
            setLines(prev => [...prev, {
                id: generateId(),
                points: currentLine,
                color: currentColor,
                strokeWidth: strokeWidth
            }]);
        }
        setIsDrawing(false);
        setCurrentLine([]);
    };

    // 点击线条删除（橡皮擦模式）
    const handleLineClick = (lineId: string) => {
        if (tool === 'eraser') {
            setLines(prev => prev.filter(l => l.id !== lineId));
        }
    };

    // 点击文字
    const handleTextClick = (textItem: TextItem) => {
        if (tool === 'eraser') {
            setTexts(prev => prev.filter(t => t.id !== textItem.id));
        } else if (tool === 'text') {
            setEditingText({ id: textItem.id, x: textItem.x, y: textItem.y });
            setTextInputValue(textItem.text);
            setCurrentFontSize(textItem.fontSize);
            setCurrentColor(textItem.color);
        }
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
                y: editingText.y,
                text: textInputValue,
                color: currentColor,
                fontSize: currentFontSize
            }]);
        }

        setEditingText(null);
        setTextInputValue('');
    };

    // 缩放
    const handleZoom = (delta: number) => {
        const newScale = Math.max(0.2, Math.min(3, scale + delta));
        setScale(newScale);
    };

    // 滚轮缩放
    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const delta = e.evt.deltaY > 0 ? -0.1 : 0.1;
        handleZoom(delta);
    };

    // 拖拽画布
    const handleStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
        if (tool === 'pan') {
            setPosition({
                x: e.target.x(),
                y: e.target.y()
            });
        }
    };

    // 撤销
    const handleUndo = () => {
        if (lines.length > 0) {
            setLines(prev => prev.slice(0, -1));
        } else if (texts.length > 0) {
            setTexts(prev => prev.slice(0, -1));
        }
    };

    // 清除所有
    const handleClear = () => {
        setLines([]);
        setTexts([]);
    };

    // 应用标注
    const handleApply = () => {
        const stage = stageRef.current;
        if (!stage || !image) return;

        // 创建一个临时画布，使用原始图片尺寸
        const tempStage = new Konva.Stage({
            container: document.createElement('div'),
            width: image.width,
            height: image.height
        });

        const tempLayer = new Konva.Layer();
        tempStage.add(tempLayer);

        // 绘制背景图片
        const bgImage = new Konva.Image({
            image: image,
            x: 0,
            y: 0,
            width: image.width,
            height: image.height
        });
        tempLayer.add(bgImage);

        // 绘制所有线条
        lines.forEach(line => {
            const konvaLine = new Konva.Line({
                points: line.points,
                stroke: line.color,
                strokeWidth: line.strokeWidth,
                lineCap: 'round',
                lineJoin: 'round'
            });
            tempLayer.add(konvaLine);
        });

        // 绘制所有文字
        texts.forEach(text => {
            const konvaText = new Konva.Text({
                x: text.x,
                y: text.y,
                text: text.text,
                fontSize: text.fontSize,
                fill: text.color,
                fontStyle: 'bold'
            });
            tempLayer.add(konvaText);
        });

        tempLayer.draw();

        const dataUrl = tempStage.toDataURL({ pixelRatio: 1 });
        tempStage.destroy();

        onApply(dataUrl);
    };

    // 计算文字输入框位置（屏幕坐标）
    const getTextInputScreenPosition = () => {
        if (!editingText) return { left: 0, top: 0 };
        return {
            left: editingText.x * scale + position.x,
            top: editingText.y * scale + position.y
        };
    };

    const textInputPos = getTextInputScreenPosition();

    // 加载中状态
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
                    <div className="annotation-canvas-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                            <div className="loading-spinner" style={{ width: 40, height: 40, border: '3px solid var(--color-border)', borderTop: '3px solid var(--color-accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                            正在加载图片...
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 错误状态
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
                    <div className="annotation-canvas-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                            <AlertCircle size={48} style={{ marginBottom: 16, color: 'var(--color-error)' }} />
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

                        {/* 字体大小（文字模式） */}
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

                {/* Konva 画布 */}
                <div className="annotation-canvas-container" style={{ position: 'relative', background: '#1a1a1a' }}>
                    <Stage
                        ref={stageRef}
                        width={containerWidth}
                        height={containerHeight}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onWheel={handleWheel}
                        draggable={tool === 'pan'}
                        onDragEnd={handleStageDragEnd}
                        x={position.x}
                        y={position.y}
                        scaleX={scale}
                        scaleY={scale}
                        style={{ cursor: tool === 'pan' ? 'grab' : tool === 'eraser' ? 'crosshair' : 'default' }}
                    >
                        <Layer>
                            {/* 背景图片 */}
                            {image && (
                                <KonvaImage
                                    image={image}
                                    x={0}
                                    y={0}
                                />
                            )}

                            {/* 已绘制的线条 */}
                            {lines.map(line => (
                                <Line
                                    key={line.id}
                                    points={line.points}
                                    stroke={line.color}
                                    strokeWidth={line.strokeWidth}
                                    lineCap="round"
                                    lineJoin="round"
                                    onClick={() => handleLineClick(line.id)}
                                    onTap={() => handleLineClick(line.id)}
                                    hitStrokeWidth={20}
                                />
                            ))}

                            {/* 当前正在绘制的线条 */}
                            {currentLine.length >= 4 && (
                                <Line
                                    points={currentLine}
                                    stroke={currentColor}
                                    strokeWidth={strokeWidth}
                                    lineCap="round"
                                    lineJoin="round"
                                />
                            )}

                            {/* 文字标注 */}
                            {texts.map(text => (
                                <Text
                                    key={text.id}
                                    x={text.x}
                                    y={text.y}
                                    text={text.text}
                                    fontSize={text.fontSize}
                                    fill={text.color}
                                    fontStyle="bold"
                                    onClick={() => handleTextClick(text)}
                                    onTap={() => handleTextClick(text)}
                                    draggable={tool === 'text'}
                                    onDragEnd={(e) => {
                                        setTexts(prev => prev.map(t =>
                                            t.id === text.id
                                                ? { ...t, x: e.target.x(), y: e.target.y() }
                                                : t
                                        ));
                                    }}
                                />
                            ))}
                        </Layer>
                    </Stage>

                    {/* 文字输入框 */}
                    {editingText && (
                        <div
                            className="annotation-text-overlay"
                            style={{
                                left: textInputPos.left,
                                top: textInputPos.top
                            }}
                        >
                            <input
                                type="text"
                                value={textInputValue}
                                onChange={(e) => setTextInputValue(e.target.value)}
                                onKeyDown={(e) => {
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
                                    fontSize: currentFontSize * scale,
                                    fontWeight: 'bold'
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* 提示 */}
                <div className="annotation-hint">
                    {tool === 'pen' && '拖动绘制 | 滚轮缩放'}
                    {tool === 'text' && '点击添加文字 | 点击已有文字编辑 | 拖动文字移动'}
                    {tool === 'eraser' && '点击线条或文字删除'}
                    {tool === 'pan' && '拖动移动画布 | 滚轮缩放'}
                </div>
            </div>
        </div>
    );
}

// 导出包装了错误边界的组件
export function AnnotationEditor(props: AnnotationEditorProps) {
    return (
        <ErrorBoundary onError={props.onCancel}>
            <AnnotationEditorInner {...props} />
        </ErrorBoundary>
    );
}

export default AnnotationEditor;
