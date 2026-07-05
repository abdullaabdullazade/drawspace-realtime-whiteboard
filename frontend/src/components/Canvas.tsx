'use client';
import {
  forwardRef,
  useRef,
  useEffect,
  useImperativeHandle,
  useCallback,
  useState,
} from 'react';

export type Tool = 'select' | 'pencil' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'text' | 'image';

export interface DrawElement {
  type: Tool;
  color: string;
  brushSize: number;
  points?: { x: number; y: number }[];
  x1?: number; y1?: number; x2?: number; y2?: number;
  // image
  src?: string;
  x?: number; y?: number; w?: number; h?: number;
  // text
  text?: string;
  fontSize?: number;
}

export interface CanvasRef {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  exportPNG: () => void;
  addRemoteElement: (el: DrawElement) => void;
  placeImage: (img: { src: string; x: number; y: number; w: number; h: number }) => void;
  loadElements: (els: DrawElement[]) => void;
}

interface CanvasProps {
  tool: Tool;
  color: string;
  brushSize: 2 | 6 | 12;
  onDraw: (el: DrawElement) => void;
  zoom: number;
}

// Shared image cache so redraws don't reload
const imageCache = new Map<string, HTMLImageElement>();

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: DrawElement,
  onImageLoad?: () => void,
) {
  ctx.save();
  if (el.type === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.strokeStyle = el.color;
  }
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.brushSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (el.type === 'image' && el.src) {
    let img = imageCache.get(el.src);
    if (!img) {
      img = new Image();
      img.src = el.src;
      imageCache.set(el.src, img);
      img.onload = () => onImageLoad?.();
    }
    if (img.complete && img.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, el.x ?? 0, el.y ?? 0, el.w ?? img.width, el.h ?? img.height);
    }
  } else if ((el.type === 'pencil' || el.type === 'eraser') && el.points && el.points.length > 0) {
    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
    ctx.stroke();
  } else if (el.type === 'line' && el.x1 !== undefined) {
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1!);
    ctx.lineTo(el.x2!, el.y2!);
    ctx.stroke();
  } else if (el.type === 'rectangle' && el.x1 !== undefined) {
    ctx.beginPath();
    ctx.strokeRect(el.x1, el.y1!, el.x2! - el.x1, el.y2! - el.y1!);
  } else if (el.type === 'circle' && el.x1 !== undefined) {
    const rx = Math.abs(el.x2! - el.x1) / 2;
    const ry = Math.abs(el.y2! - el.y1!) / 2;
    const cx = (el.x1 + el.x2!) / 2;
    const cy = (el.y1! + el.y2!) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (el.type === 'text' && el.text) {
    ctx.font = `600 ${el.fontSize ?? 26}px Inter, sans-serif`;
    ctx.fillStyle = el.color;
    ctx.textBaseline = 'top';
    ctx.fillText(el.text, el.x ?? 0, el.y ?? 0);
  }
  ctx.restore();
}

function redrawAll(ctx: CanvasRenderingContext2D, elements: DrawElement[], onImageLoad?: () => void) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const el of elements) drawElement(ctx, el, onImageLoad);
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(
  { tool, color, brushSize, onDraw, zoom },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<DrawElement[]>([]);
  const undoStackRef = useRef<DrawElement[][]>([]);
  const redoStackRef = useRef<DrawElement[][]>([]);
  const isDrawingRef = useRef(false);
  const currentElementRef = useRef<DrawElement | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);

  // Text tool
  const [textEdit, setTextEdit] = useState<{ x: number; y: number; left: number; top: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  // Eraser cursor ring
  const [eraserPos, setEraserPos] = useState<{ left: number; top: number } | null>(null);
  const textFontSize = brushSize * 4 + 16; // 2→24, 6→40, 12→64

  const commitText = useCallback(() => {
    setTextEdit((edit) => {
      const value = textValue.trim();
      if (edit && value) {
        const el: DrawElement = { type: 'text', color, brushSize, x: edit.x, y: edit.y, text: value, fontSize: textFontSize };
        undoStackRef.current.push([...elementsRef.current]);
        redoStackRef.current = [];
        elementsRef.current.push(el);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) drawElement(ctx, el);
        onDraw(el);
      }
      return null;
    });
    setTextValue('');
  }, [textValue, color, brushSize, textFontSize, onDraw]);

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);

  const repaint = useCallback(() => {
    const ctx = getCtx();
    if (ctx) redrawAll(ctx, elementsRef.current, () => repaint());
  }, [getCtx]);

  const getPos = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = zoom / 100;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      repaint();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [repaint]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool === 'select' || tool === 'image') return;

    if (tool === 'text') {
      // If already editing, commit first
      if (textEdit) { commitText(); return; }
      const pos = getPos(e);
      const scale = zoom / 100;
      setTextEdit({ x: pos.x, y: pos.y, left: pos.x * scale, top: pos.y * scale });
      setTextValue('');
      return;
    }

    const ctx = getCtx();
    if (!ctx) return;
    isDrawingRef.current = true;
    const pos = getPos(e);
    snapshotRef.current = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (tool === 'pencil' || tool === 'eraser') {
      const size = tool === 'eraser' ? brushSize * 5 : brushSize;
      currentElementRef.current = { type: tool, color, brushSize: size, points: [pos] };
    } else {
      currentElementRef.current = { type: tool, color, brushSize, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
    }
  }, [tool, color, brushSize, getCtx, getPos]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    // Eraser ring follows cursor even when not drawing
    if (tool === 'eraser') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) setEraserPos({ left: e.clientX - rect.left, top: e.clientY - rect.top });
    } else if (eraserPos) {
      setEraserPos(null);
    }
    if (!isDrawingRef.current || !currentElementRef.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    const el = currentElementRef.current;
    if (tool === 'pencil' || tool === 'eraser') {
      el.points!.push(pos);
      drawElement(ctx, el);
    } else {
      el.x2 = pos.x; el.y2 = pos.y;
      if (snapshotRef.current) ctx.putImageData(snapshotRef.current, 0, 0);
      drawElement(ctx, el);
    }
  }, [tool, getCtx, getPos, eraserPos]);

  const onMouseUp = useCallback(() => {
    if (!isDrawingRef.current || !currentElementRef.current) return;
    isDrawingRef.current = false;
    const el = { ...currentElementRef.current };
    if (el.points) el.points = [...el.points];
    undoStackRef.current.push([...elementsRef.current]);
    redoStackRef.current = [];
    elementsRef.current.push(el);
    onDraw(el);
    currentElementRef.current = null;
    snapshotRef.current = null;
  }, [onDraw]);

  useImperativeHandle(ref, () => ({
    undo() {
      if (undoStackRef.current.length === 0) return;
      redoStackRef.current.push([...elementsRef.current]);
      elementsRef.current = undoStackRef.current.pop()!;
      repaint();
    },
    redo() {
      if (redoStackRef.current.length === 0) return;
      undoStackRef.current.push([...elementsRef.current]);
      elementsRef.current = redoStackRef.current.pop()!;
      repaint();
    },
    clear() {
      undoStackRef.current.push([...elementsRef.current]);
      elementsRef.current = [];
      const ctx = getCtx();
      if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    exportPNG() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = 'board.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    },
    addRemoteElement(el: DrawElement) {
      elementsRef.current.push(el);
      const ctx = getCtx();
      if (ctx) drawElement(ctx, el, () => repaint());
    },
    loadElements(els: DrawElement[]) {
      elementsRef.current = els.filter(Boolean);
      undoStackRef.current = [];
      redoStackRef.current = [];
      // Ensure canvas is sized before painting
      requestAnimationFrame(() => repaint());
    },
    placeImage({ src, x, y, w, h }) {
      const el: DrawElement = { type: 'image', color, brushSize, src, x, y, w, h };
      undoStackRef.current.push([...elementsRef.current]);
      redoStackRef.current = [];
      elementsRef.current.push(el);
      repaint();
      onDraw(el);
    },
  }), [getCtx, repaint, onDraw, color, brushSize, zoom]);

  const cursor = tool === 'select' ? 'default' : tool === 'image' ? 'copy' : tool === 'text' ? 'text' : tool === 'eraser' ? 'none' : 'crosshair';
  const eraserDiameter = brushSize * 5 * (zoom / 100);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        style={{ cursor, transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { onMouseUp(); setEraserPos(null); }}
        className="touch-none"
      />

      {/* Eraser cursor ring */}
      {tool === 'eraser' && eraserPos && (
        <div
          className="absolute pointer-events-none rounded-full border-2 border-[var(--danger)] bg-[var(--danger)]/10"
          style={{
            left: eraserPos.left - eraserDiameter / 2,
            top: eraserPos.top - eraserDiameter / 2,
            width: eraserDiameter,
            height: eraserDiameter,
          }}
        />
      )}

      {/* Text input overlay */}
      {textEdit && (
        <input
          autoFocus
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitText(); }
            if (e.key === 'Escape') { setTextEdit(null); setTextValue(''); }
          }}
          placeholder="Type…"
          className="absolute bg-transparent outline-none border-b-2 border-[var(--primary)] px-0.5"
          style={{
            left: textEdit.left,
            top: textEdit.top,
            color,
            fontSize: textFontSize * (zoom / 100),
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.1,
            minWidth: 80,
          }}
        />
      )}
    </div>
  );
});

export default Canvas;
