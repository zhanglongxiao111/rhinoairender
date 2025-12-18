import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Type, Trash2, Check, X, Undo, Eraser, Plus, Minus } from 'lucide-react';

interface AnnotationEditorProps {
    imageUrl: string;
    onApply: (annotatedImageUrl: string) => void;
    onCancel: () => void;
}

type Tool = 'pen' | 'text' | 'eraser';
type EraserMode = 'stroke' | 'pixel';

interface Point {
    x: number;
    y: number;
}

interface DrawPath {
    id: string;
    points: Point[];
    color: string;
    width: number;
}

interface TextAnnotation {
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

// 字体大小预设
const FONT_SIZES = [12, 16, 20, 24, 32, 48];

export function AnnotationEditor({ imageUrl, onApply, onCancel }: AnnotationEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // 工具状态
    const [tool, setTool] = useState<Tool>('pen');
    const [currentColor, setCurrentColor] = useState('#F04E30');
    const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
    const [currentFontSize, setCurrentFontSize] = useState(24);

    // 绘图状态
    const [isDrawing, setIsDrawing] = useState(false);
    const [paths, setPaths] = useState<DrawPath[]>([]);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);

    // 文字编辑状态
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [textInput, setTextInput] = useState('');
    const [textPosition, setTextPosition] = useState<Point | null>(null);

    // 图片状态
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    // 显示尺寸（用于坐标转换）
    const [displaySize, setDisplaySize] = useState({ width: 800, height: 600 });

    const penWidth = 3;

    // 生成唯一ID
    const generateId = () => Math.random().toString(36).substr(2, 9);

    // 计算显示尺寸
    const calculateDisplaySize = useCallback(() => {
        const maxWidth = 800;
        const maxHeight = 600;

        if (imageSize.width === 0 || imageSize.height === 0) {
            return { width: maxWidth, height: maxHeight };
        }

        const ratio = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height, 1);
        return {
            width: Math.round(imageSize.width * ratio),
            height: Math.round(imageSize.height * ratio)
        };
    }, [imageSize]);

    // 加载背景图片
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imageRef.current = img;
            setImageSize({ width: img.width, height: img.height });
            setImageLoaded(true);
        };
        img.src = imageUrl;
    }, [imageUrl]);

    // 更新显示尺寸
    useEffect(() => {
        if (imageLoaded) {
            setDisplaySize(calculateDisplaySize());
        }
    }, [imageLoaded, calculateDisplaySize]);

    // 缩放比例
    const scale = imageSize.width > 0 ? displaySize.width / imageSize.width : 1;

    // 绘制Canvas（不包含正在编辑的文字）
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !imageLoaded || !img) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制背景图片
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 绘制所有路径
        paths.forEach(path => {
            if (path.points.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            ctx.stroke();
        });

        // 绘制当前路径
        if (currentPath.length >= 2 && tool === 'pen') {
            ctx.beginPath();
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = penWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(currentPath[0].x, currentPath[0].y);
            for (let i = 1; i < currentPath.length; i++) {
                ctx.lineTo(currentPath[i].x, currentPath[i].y);
            }
            ctx.stroke();
        }

        // 绘制文字标注（排除正在编辑的）
        textAnnotations.forEach(annotation => {
            if (annotation.id === editingTextId) return; // 跳过正在编辑的文字

            ctx.font = `bold ${annotation.fontSize}px Arial`;
            ctx.fillStyle = annotation.color;
            // 添加描边使文字在任何背景下都可见
            ctx.strokeStyle = annotation.color === '#000000' ? '#FFFFFF' : '#000000';
            ctx.lineWidth = 2;
            ctx.strokeText(annotation.text, annotation.x, annotation.y);
            ctx.fillText(annotation.text, annotation.x, annotation.y);
        });
    }, [imageLoaded, paths, currentPath, textAnnotations, currentColor, tool, editingTextId]);

    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    // 获取画布坐标（从显示坐标转换为实际坐标）
    const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: Math.round((e.clientX - rect.left) * scaleX),
            y: Math.round((e.clientY - rect.top) * scaleY)
        };
    };

    // 检查点是否在文字上（使用画布坐标）
    const findTextAtPoint = (point: Point): TextAnnotation | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        for (let i = textAnnotations.length - 1; i >= 0; i--) {
            const annotation = textAnnotations[i];
            ctx.font = `bold ${annotation.fontSize}px Arial`;
            const metrics = ctx.measureText(annotation.text);
            const height = annotation.fontSize;

            // 扩大点击区域
            const padding = 5;
            if (point.x >= annotation.x - padding &&
                point.x <= annotation.x + metrics.width + padding &&
                point.y >= annotation.y - height - padding &&
                point.y <= annotation.y + padding) {
                return annotation;
            }
        }
        return null;
    };

    // 检查点是否在路径上（使用画布坐标）
    const findPathAtPoint = (point: Point): DrawPath | null => {
        const threshold = 15; // 增大检测范围

        for (let i = paths.length - 1; i >= 0; i--) {
            const path = paths[i];
            for (const p of path.points) {
                const distance = Math.sqrt(Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2));
                if (distance < threshold) {
                    return path;
                }
            }
        }
        return null;
    };

    // 鼠标事件处理
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const point = getCanvasCoordinates(e);

        if (tool === 'pen') {
            setIsDrawing(true);
            setCurrentPath([point]);
        } else if (tool === 'text') {
            // 先确认之前的文字编辑
            if (textPosition && textInput.trim()) {
                confirmTextEdit();
            }

            // 检查是否点击了现有文字
            const existingText = findTextAtPoint(point);
            if (existingText) {
                setEditingTextId(existingText.id);
                setTextInput(existingText.text);
                setTextPosition({ x: existingText.x, y: existingText.y });
                setCurrentFontSize(existingText.fontSize);
                setCurrentColor(existingText.color);
            } else {
                setEditingTextId(null);
                setTextInput('');
                setTextPosition(point);
            }
        } else if (tool === 'eraser') {
            handleErase(point);
        }
    };

    // 橡皮擦处理
    const handleErase = (point: Point) => {
        if (eraserMode === 'stroke') {
            // 按笔画擦除 - 删除整条路径或文字
            const pathToRemove = findPathAtPoint(point);
            if (pathToRemove) {
                setPaths(prev => prev.filter(p => p.id !== pathToRemove.id));
                return;
            }
            const textToRemove = findTextAtPoint(point);
            if (textToRemove) {
                setTextAnnotations(prev => prev.filter(t => t.id !== textToRemove.id));
            }
        } else {
            // 像素擦除 - 直接在canvas上用背景图覆盖
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            const img = imageRef.current;
            if (ctx && img && canvas) {
                const eraserRadius = 15;
                // 保存当前状态
                ctx.save();
                // 创建圆形裁剪区域
                ctx.beginPath();
                ctx.arc(point.x, point.y, eraserRadius, 0, Math.PI * 2);
                ctx.clip();
                // 绘制背景图片到裁剪区域
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                ctx.restore();
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const point = getCanvasCoordinates(e);

        if (tool === 'pen') {
            setCurrentPath(prev => [...prev, point]);
        } else if (tool === 'eraser' && eraserMode === 'pixel') {
            handleErase(point);
        }
    };

    const handleMouseUp = () => {
        if (tool === 'pen' && isDrawing && currentPath.length >= 2) {
            setPaths(prev => [...prev, {
                id: generateId(),
                points: currentPath,
                color: currentColor,
                width: penWidth
            }]);
        }
        setIsDrawing(false);
        setCurrentPath([]);
    };

    // 确认文字编辑
    const confirmTextEdit = () => {
        if (!textPosition || !textInput.trim()) {
            cancelTextEdit();
            return;
        }

        if (editingTextId) {
            // 更新现有文字
            setTextAnnotations(prev => prev.map(t =>
                t.id === editingTextId
                    ? { ...t, text: textInput, color: currentColor, fontSize: currentFontSize }
                    : t
            ));
        } else {
            // 添加新文字
            setTextAnnotations(prev => [...prev, {
                id: generateId(),
                x: textPosition.x,
                y: textPosition.y,
                text: textInput,
                color: currentColor,
                fontSize: currentFontSize
            }]);
        }

        cancelTextEdit();
    };

    // 取消文字编辑
    const cancelTextEdit = () => {
        setTextInput('');
        setTextPosition(null);
        setEditingTextId(null);
    };

    // 调整字体大小
    const adjustFontSize = (delta: number) => {
        const currentIndex = FONT_SIZES.indexOf(currentFontSize);
        const newIndex = Math.max(0, Math.min(FONT_SIZES.length - 1, currentIndex + delta));
        setCurrentFontSize(FONT_SIZES[newIndex]);
    };

    // 撤销
    const handleUndo = () => {
        if (paths.length > 0) {
            setPaths(prev => prev.slice(0, -1));
        } else if (textAnnotations.length > 0) {
            setTextAnnotations(prev => prev.slice(0, -1));
        }
    };

    // 清除所有
    const handleClear = () => {
        setPaths([]);
        setTextAnnotations([]);
        setCurrentPath([]);
        cancelTextEdit();
    };

    // 应用标注
    const handleApply = () => {
        // 先确认当前编辑的文字
        if (textPosition && textInput.trim()) {
            confirmTextEdit();
        }

        // 等待重绘完成后导出
        setTimeout(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            // 强制重绘一次确保所有内容都绘制好
            redrawCanvas();

            setTimeout(() => {
                const dataUrl = canvas.toDataURL('image/png');
                onApply(dataUrl);
            }, 50);
        }, 50);
    };

    // 计算文字输入框在显示坐标系中的位置
    const getTextInputPosition = () => {
        if (!textPosition) return { left: 0, top: 0 };
        return {
            left: textPosition.x * scale,
            top: textPosition.y * scale
        };
    };

    const inputPos = getTextInputPosition();

    return (
        <div className="annotation-editor-overlay">
            <div className="annotation-editor">
                {/* 工具栏 */}
                <div className="annotation-toolbar">
                    <div className="annotation-tools">
                        {/* 工具按钮 */}
                        <button
                            className={`annotation-tool-btn ${tool === 'pen' ? 'active' : ''}`}
                            onClick={() => { setTool('pen'); cancelTextEdit(); }}
                            title="画笔工具"
                        >
                            <Pencil size={18} />
                        </button>
                        <button
                            className={`annotation-tool-btn ${tool === 'text' ? 'active' : ''}`}
                            onClick={() => setTool('text')}
                            title="文字工具"
                        >
                            <Type size={18} />
                        </button>
                        <button
                            className={`annotation-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                            onClick={() => { setTool('eraser'); cancelTextEdit(); }}
                            title="橡皮擦"
                        >
                            <Eraser size={18} />
                        </button>

                        {/* 橡皮擦模式 */}
                        {tool === 'eraser' && (
                            <div className="annotation-eraser-modes">
                                <button
                                    className={`annotation-mode-btn ${eraserMode === 'stroke' ? 'active' : ''}`}
                                    onClick={() => setEraserMode('stroke')}
                                >
                                    笔画
                                </button>
                                <button
                                    className={`annotation-mode-btn ${eraserMode === 'pixel' ? 'active' : ''}`}
                                    onClick={() => setEraserMode('pixel')}
                                >
                                    像素
                                </button>
                            </div>
                        )}

                        {/* 字体大小控制 */}
                        {tool === 'text' && (
                            <div className="annotation-font-size">
                                <button
                                    className="annotation-size-btn"
                                    onClick={() => adjustFontSize(-1)}
                                    disabled={currentFontSize === FONT_SIZES[0]}
                                >
                                    <Minus size={14} />
                                </button>
                                <span className="annotation-size-value">{currentFontSize}px</span>
                                <button
                                    className="annotation-size-btn"
                                    onClick={() => adjustFontSize(1)}
                                    disabled={currentFontSize === FONT_SIZES[FONT_SIZES.length - 1]}
                                >
                                    <Plus size={14} />
                                </button>
                            </div>
                        )}

                        <div className="annotation-divider" />

                        {/* 颜色选择器 */}
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

                        <div className="annotation-divider" />

                        <button
                            className="annotation-tool-btn"
                            onClick={handleUndo}
                            title="撤销"
                            disabled={paths.length === 0 && textAnnotations.length === 0}
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

                {/* 画布区域 */}
                <div className="annotation-canvas-container">
                    <canvas
                        ref={canvasRef}
                        width={imageSize.width || 800}
                        height={imageSize.height || 600}
                        style={{
                            width: displaySize.width,
                            height: displaySize.height,
                            cursor: tool === 'pen' ? 'crosshair' : tool === 'text' ? 'text' : 'cell'
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />

                    {/* 所见即所得的文字输入框 */}
                    {textPosition && (
                        <div
                            className="annotation-text-wysiwyg"
                            style={{
                                left: inputPos.left,
                                top: inputPos.top,
                                transform: 'translateY(-100%)'
                            }}
                        >
                            <input
                                type="text"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmTextEdit();
                                    if (e.key === 'Escape') cancelTextEdit();
                                }}
                                placeholder="输入文字..."
                                autoFocus
                                style={{
                                    color: currentColor,
                                    fontSize: `${currentFontSize * scale}px`,
                                    fontWeight: 'bold',
                                    textShadow: currentColor === '#000000'
                                        ? '1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff'
                                        : '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000'
                                }}
                            />
                            <div className="annotation-text-actions">
                                <button onClick={confirmTextEdit} title="确认 (Enter)">
                                    <Check size={14} />
                                </button>
                                <button onClick={cancelTextEdit} title="取消 (Esc)">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 提示 */}
                <div className="annotation-hint">
                    {tool === 'pen' && '拖动绘制线条'}
                    {tool === 'text' && (textPosition ? '输入文字，Enter确认，Esc取消' : '点击添加文字，点击已有文字可编辑')}
                    {tool === 'eraser' && (eraserMode === 'stroke' ? '点击删除整条线或文字' : '拖动擦除')}
                </div>
            </div>
        </div>
    );
}

export default AnnotationEditor;
