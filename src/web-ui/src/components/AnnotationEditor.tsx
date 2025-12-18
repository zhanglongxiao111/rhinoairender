import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Type, Trash2, Check, X, Undo } from 'lucide-react';

interface AnnotationEditorProps {
    imageUrl: string;
    onApply: (annotatedImageUrl: string) => void;
    onCancel: () => void;
}

type Tool = 'pen' | 'text';

interface Point {
    x: number;
    y: number;
}

interface DrawPath {
    points: Point[];
    color: string;
    width: number;
}

interface TextAnnotation {
    x: number;
    y: number;
    text: string;
    color: string;
    fontSize: number;
}

export function AnnotationEditor({ imageUrl, onApply, onCancel }: AnnotationEditorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tool, setTool] = useState<Tool>('pen');
    const [isDrawing, setIsDrawing] = useState(false);
    const [paths, setPaths] = useState<DrawPath[]>([]);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [textAnnotations, setTextAnnotations] = useState<TextAnnotation[]>([]);
    const [textInput, setTextInput] = useState('');
    const [textPosition, setTextPosition] = useState<Point | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    const penColor = '#F04E30'; // 使用主题强调色
    const penWidth = 3;
    const textColor = '#FFFFFF';
    const fontSize = 18;

    // 加载背景图片
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setImageSize({ width: img.width, height: img.height });
            setImageLoaded(true);
        };
        img.src = imageUrl;
    }, [imageUrl]);

    // 绘制Canvas
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imageLoaded) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制背景图片
        const img = new Image();
        img.src = imageUrl;
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
        if (currentPath.length >= 2) {
            ctx.beginPath();
            ctx.strokeStyle = penColor;
            ctx.lineWidth = penWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(currentPath[0].x, currentPath[0].y);
            for (let i = 1; i < currentPath.length; i++) {
                ctx.lineTo(currentPath[i].x, currentPath[i].y);
            }
            ctx.stroke();
        }

        // 绘制文字标注
        textAnnotations.forEach(annotation => {
            ctx.font = `bold ${annotation.fontSize}px Arial`;
            ctx.fillStyle = annotation.color;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(annotation.text, annotation.x, annotation.y);
            ctx.fillText(annotation.text, annotation.x, annotation.y);
        });
    }, [imageUrl, imageLoaded, paths, currentPath, textAnnotations]);

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

    // 鼠标事件处理
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const point = getCanvasCoordinates(e);

        if (tool === 'pen') {
            setIsDrawing(true);
            setCurrentPath([point]);
        } else if (tool === 'text') {
            setTextPosition(point);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || tool !== 'pen') return;

        const point = getCanvasCoordinates(e);
        setCurrentPath(prev => [...prev, point]);
    };

    const handleMouseUp = () => {
        if (isDrawing && currentPath.length >= 2) {
            setPaths(prev => [...prev, {
                points: currentPath,
                color: penColor,
                width: penWidth
            }]);
        }
        setIsDrawing(false);
        setCurrentPath([]);
    };

    // 添加文字
    const handleAddText = () => {
        if (!textPosition || !textInput.trim()) return;

        setTextAnnotations(prev => [...prev, {
            x: textPosition.x,
            y: textPosition.y,
            text: textInput,
            color: textColor,
            fontSize: fontSize
        }]);
        setTextInput('');
        setTextPosition(null);
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
    };

    // 应用标注
    const handleApply = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dataUrl = canvas.toDataURL('image/png');
        onApply(dataUrl);
    };

    // 计算显示尺寸（保持宽高比，适应容器）
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
            <div className="annotation-editor" ref={containerRef}>
                {/* 工具栏 */}
                <div className="annotation-toolbar">
                    <div className="annotation-tools">
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
                            title="文字工具"
                        >
                            <Type size={18} />
                        </button>
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
                            cursor: tool === 'pen' ? 'crosshair' : 'text'
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />

                    {/* 文字输入框 */}
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
                                    }
                                }}
                                placeholder="输入文字后按 Enter"
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                {/* 提示 */}
                <div className="annotation-hint">
                    {tool === 'pen' ? '点击并拖动绘制' : '点击画布添加文字'}
                </div>
            </div>
        </div>
    );
}

export default AnnotationEditor;
