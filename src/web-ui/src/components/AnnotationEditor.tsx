import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Type, Trash2, Check, X, Undo, Eraser } from 'lucide-react';

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

export function AnnotationEditor({ imageUrl, onApply, onCancel }: AnnotationEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // 工具状态
    const [tool, setTool] = useState<Tool>('pen');
    const [currentColor, setCurrentColor] = useState('#F04E30');
    const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');

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

    const penWidth = 3;
    const eraserWidth = 20;
    const fontSize = 18;

    // 生成唯一ID
    const generateId = () => Math.random().toString(36).substr(2, 9);

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

    // 绘制Canvas
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

        // 绘制文字标注（不带背景）
        textAnnotations.forEach(annotation => {
            ctx.font = `bold ${annotation.fontSize}px Arial`;
            ctx.fillStyle = annotation.color;
            // 添加描边使文字在任何背景下都可见
            ctx.strokeStyle = annotation.color === '#FFFFFF' ? '#000000' : '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.strokeText(annotation.text, annotation.x, annotation.y);
            ctx.fillText(annotation.text, annotation.x, annotation.y);
        });
    }, [imageLoaded, paths, currentPath, textAnnotations, currentColor, tool]);

    useEffect(() => {
        redrawCanvas();
    }, [redrawCanvas]);

    // 获取画布坐标
    const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    // 检查点是否在文字上
    const findTextAtPoint = (point: Point): TextAnnotation | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // 从后往前检查（后添加的在上面）
        for (let i = textAnnotations.length - 1; i >= 0; i--) {
            const annotation = textAnnotations[i];
            ctx.font = `bold ${annotation.fontSize}px Arial`;
            const metrics = ctx.measureText(annotation.text);
            const height = annotation.fontSize;

            if (point.x >= annotation.x &&
                point.x <= annotation.x + metrics.width &&
                point.y >= annotation.y - height &&
                point.y <= annotation.y) {
                return annotation;
            }
        }
        return null;
    };

    // 检查点是否在路径上
    const findPathAtPoint = (point: Point): DrawPath | null => {
        const threshold = 10;

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
            // 检查是否点击了现有文字
            const existingText = findTextAtPoint(point);
            if (existingText) {
                setEditingTextId(existingText.id);
                setTextInput(existingText.text);
                setTextPosition({ x: existingText.x, y: existingText.y });
            } else {
                setEditingTextId(null);
                setTextInput('');
                setTextPosition(point);
            }
        } else if (tool === 'eraser') {
            if (eraserMode === 'stroke') {
                // 按笔画擦除
                const pathToRemove = findPathAtPoint(point);
                if (pathToRemove) {
                    setPaths(prev => prev.filter(p => p.id !== pathToRemove.id));
                }
                // 也检查文字
                const textToRemove = findTextAtPoint(point);
                if (textToRemove) {
                    setTextAnnotations(prev => prev.filter(t => t.id !== textToRemove.id));
                }
            } else {
                // 像素擦除 - 开始擦除路径
                setIsDrawing(true);
                setCurrentPath([point]);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const point = getCanvasCoordinates(e);

        if (tool === 'pen') {
            setCurrentPath(prev => [...prev, point]);
        } else if (tool === 'eraser' && eraserMode === 'pixel') {
            // 像素擦除 - 用背景色绘制
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (ctx && imageRef.current) {
                // 直接在canvas上用背景图擦除
                ctx.save();
                ctx.beginPath();
                ctx.arc(point.x, point.y, eraserWidth / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(imageRef.current, 0, 0, canvas!.width, canvas!.height);
                ctx.restore();
            }
            setCurrentPath(prev => [...prev, point]);
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

    // 添加或更新文字
    const handleAddText = () => {
        if (!textPosition || !textInput.trim()) {
            setTextPosition(null);
            setTextInput('');
            setEditingTextId(null);
            return;
        }

        if (editingTextId) {
            // 更新现有文字
            setTextAnnotations(prev => prev.map(t =>
                t.id === editingTextId
                    ? { ...t, text: textInput, color: currentColor }
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
                fontSize: fontSize
            }]);
        }

        setTextInput('');
        setTextPosition(null);
        setEditingTextId(null);
    };

    // 撤销最后操作
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
        setTextPosition(null);
        setTextInput('');
        setEditingTextId(null);
    };

    // 应用标注
    const handleApply = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 确保重绘一次（不包含编辑中的文本框）
        setTextPosition(null);
        setEditingTextId(null);

        setTimeout(() => {
            const dataUrl = canvas.toDataURL('image/png');
            onApply(dataUrl);
        }, 50);
    };

    // 计算显示尺寸
    const getDisplaySize = () => {
        const maxWidth = 800;
        const maxHeight = 600;

        if (imageSize.width === 0 || imageSize.height === 0) {
            return { width: maxWidth, height: maxHeight };
        }

        const ratio = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height);
        return {
            width: imageSize.width * ratio,
            height: imageSize.height * ratio
        };
    };

    const displaySize = getDisplaySize();

    return (
        <div className="annotation-editor-overlay">
            <div className="annotation-editor">
                {/* 工具栏 */}
                <div className="annotation-toolbar">
                    <div className="annotation-tools">
                        {/* 工具按钮 */}
                        <button
                            className={`annotation-tool-btn ${tool === 'pen' ? 'active' : ''}`}
                            onClick={() => setTool('pen')}
                            title="画笔工具"
                        >
                            <Pencil size={18} />
                        </button>
                        <button
                            className={`annotation-tool-btn ${tool === 'text' ? 'active' : ''}`}
                            onClick={() => setTool('text')}
                            title="文字工具 (点击已有文字可编辑)"
                        >
                            <Type size={18} />
                        </button>
                        <button
                            className={`annotation-tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                            onClick={() => setTool('eraser')}
                            title="橡皮擦"
                        >
                            <Eraser size={18} />
                        </button>

                        {/* 橡皮擦模式选择 */}
                        {tool === 'eraser' && (
                            <div className="annotation-eraser-modes">
                                <button
                                    className={`annotation-mode-btn ${eraserMode === 'stroke' ? 'active' : ''}`}
                                    onClick={() => setEraserMode('stroke')}
                                    title="按笔画擦除"
                                >
                                    笔画
                                </button>
                                <button
                                    className={`annotation-mode-btn ${eraserMode === 'pixel' ? 'active' : ''}`}
                                    onClick={() => setEraserMode('pixel')}
                                    title="按像素擦除"
                                >
                                    像素
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
                            <Check size={16} /> 应用标注
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

                    {/* 文字输入框（不在canvas内，纯UI元素） */}
                    {textPosition && (
                        <div
                            className="annotation-text-input-container"
                            style={{
                                left: (textPosition.x / (imageSize.width || 800)) * displaySize.width,
                                top: (textPosition.y / (imageSize.height || 600)) * displaySize.height
                            }}
                        >
                            <input
                                type="text"
                                className="annotation-text-input"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddText();
                                    if (e.key === 'Escape') {
                                        setTextPosition(null);
                                        setTextInput('');
                                        setEditingTextId(null);
                                    }
                                }}
                                placeholder={editingTextId ? "编辑文字..." : "输入文字后按 Enter"}
                                autoFocus
                                style={{ color: currentColor, borderColor: currentColor }}
                            />
                        </div>
                    )}
                </div>

                {/* 提示 */}
                <div className="annotation-hint">
                    {tool === 'pen' && '点击拖动绘制线条'}
                    {tool === 'text' && '点击空白处添加文字，点击已有文字可编辑'}
                    {tool === 'eraser' && (eraserMode === 'stroke' ? '点击笔画或文字删除' : '拖动擦除像素')}
                </div>
            </div>
        </div>
    );
}

export default AnnotationEditor;
