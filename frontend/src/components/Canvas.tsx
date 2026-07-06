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
  src?: string;
  x?: number; y?: number; w?: number; h?: number;
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
  getContentBounds: () => { minX: number; minY: number; maxX: number; maxY: number } | null;
  setLiveStroke: (id: string, el: DrawElement) => void;
  clearLiveStroke: (id: string) => void;
}

interface CanvasProps {
  tool: Tool;
  color: string;
  brushSize: 2 | 6 | 12;
  onDraw: (el: DrawElement) => void;
  onDrawProgress?: (el: DrawElement) => void;
  onChange?: (els: DrawElement[]) => void;
  onSelectAll?: () => void;
  zoom: number;
  panX: number;
  panY: number;
  onPan: (dx: number, dy: number) => void;
}

const imageCache = new Map<string, HTMLImageElement>();

function drawElement(ctx: CanvasRenderingContext2D, el: DrawElement, onImageLoad?: () => void) {
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

interface Bounds { minX: number; minY: number; maxX: number; maxY: number; }

function elementBounds(el: DrawElement): Bounds {
  if (el.type === 'image') {
    return { minX: el.x ?? 0, minY: el.y ?? 0, maxX: (el.x ?? 0) + (el.w ?? 0), maxY: (el.y ?? 0) + (el.h ?? 0) };
  }
  if (el.type === 'text') {
    const fs = el.fontSize ?? 26;
    const w = (el.text?.length ?? 1) * fs * 0.55;
    return { minX: el.x ?? 0, minY: el.y ?? 0, maxX: (el.x ?? 0) + w, maxY: (el.y ?? 0) + fs * 1.2 };
  }
  if ((el.type === 'pencil' || el.type === 'eraser') && el.points?.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of el.points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    return { minX, minY, maxX, maxY };
  }
  // line / rect / circle
  const x1 = el.x1 ?? 0, y1 = el.y1 ?? 0, x2 = el.x2 ?? 0, y2 = el.y2 ?? 0;
  return { minX: Math.min(x1, x2), minY: Math.min(y1, y2), maxX: Math.max(x1, x2), maxY: Math.max(y1, y2) };
}

function pointInBounds(b: Bounds, x: number, y: number, pad = 6): boolean {
  return x >= b.minX - pad && x <= b.maxX + pad && y >= b.minY - pad && y <= b.maxY + pad;
}

function boundsIntersect(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function moveElement(el: DrawElement, dx: number, dy: number) {
  if (el.points) el.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  if (el.x1 !== undefined) { el.x1 += dx; el.y1! += dy; el.x2! += dx; el.y2! += dy; }
  if (el.x !== undefined) { el.x += dx; el.y! += dy; }
}

// Scale an element around a pivot point by factors fx, fy
function scaleElement(el: DrawElement, px: number, py: number, fx: number, fy: number) {
  if (el.points) el.points = el.points.map((p) => ({ x: px + (p.x - px) * fx, y: py + (p.y - py) * fy }));
  if (el.x1 !== undefined) {
    el.x1 = px + (el.x1 - px) * fx; el.y1! = py + (el.y1! - py) * fy;
    el.x2! = px + (el.x2! - px) * fx; el.y2! = py + (el.y2! - py) * fy;
  }
  if (el.x !== undefined) {
    el.x = px + (el.x - px) * fx; el.y! = py + (el.y! - py) * fy;
    if (el.w !== undefined) el.w *= fx;
    if (el.h !== undefined) el.h *= fy;
    if (el.fontSize !== undefined) el.fontSize *= (Math.abs(fx) + Math.abs(fy)) / 2;
  }
}

const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(
  { tool, color, brushSize, onDraw, onDrawProgress, onChange, onSelectAll, zoom, panX, panY, onPan },
  ref
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onProgressRef = useRef(onDrawProgress);
  onProgressRef.current = onDrawProgress;
  const liveStrokesRef = useRef<Map<string, DrawElement>>(new Map());
  const onSelectAllRef = useRef(onSelectAll);
  onSelectAllRef.current = onSelectAll;
  const emitChange = useCallback(() => { onChangeRef.current?.(elementsRef.current); }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<DrawElement[]>([]);
  const undoStackRef = useRef<DrawElement[][]>([]);
  const redoStackRef = useRef<DrawElement[][]>([]);
  const isDrawingRef = useRef(false);
  const currentElementRef = useRef<DrawElement | null>(null);
  const panningRef = useRef<{ sx: number; sy: number } | null>(null);

  // Selection (Microsoft Whiteboard style)
  const selectedRef = useRef<DrawElement[]>([]);
  const marqueeRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const moveRef = useRef<{ x: number; y: number } | null>(null); // last world pos while dragging selection
  // pivot (px,py) + current size (ow,oh) + which edges move (ex/ey: -1 left/top, +1 right/bottom, 0 fixed)
  const resizeRef = useRef<{ px: number; py: number; ow: number; oh: number; ex: number; ey: number } | null>(null);

  const [textEdit, setTextEdit] = useState<{ wx: number; wy: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const [eraserPos, setEraserPos] = useState<{ left: number; top: number } | null>(null);

  const scale = zoom / 100;
  const textFontSize = brushSize * 4 + 16;

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);

  // screen (px within canvas) → world coords
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const sx = clientX - (rect?.left ?? 0);
    const sy = clientY - (rect?.top ?? 0);
    return { x: panX + sx / scale, y: panY + sy / scale };
  }, [panX, panY, scale]);

  const dprRef = useRef(1);

  const paint = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const d = dprRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Combine device-pixel-ratio + zoom + pan into one transform
    ctx.setTransform(scale * d, 0, 0, scale * d, -panX * scale * d, -panY * scale * d);
    for (const el of elementsRef.current) drawElement(ctx, el, () => paint());
    if (currentElementRef.current) drawElement(ctx, currentElementRef.current);
    // Remote in-progress strokes (streamed live)
    for (const el of liveStrokesRef.current.values()) drawElement(ctx, el, () => paint());

    // Selection overlay (crisp regardless of zoom)
    const lw = 1.5 / scale;
    if (selectedRef.current.length) {
      ctx.save();
      ctx.strokeStyle = '#16A34A';
      ctx.lineWidth = lw;
      ctx.setLineDash([6 / scale, 4 / scale]);
      // combined bounds of all selected
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of selectedRef.current) {
        const b = elementBounds(el);
        minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
      }
      const pad = 6 / scale;
      const bx = minX - pad, by = minY - pad, bw = (maxX - minX) + pad * 2, bh = (maxY - minY) + pad * 2;
      ctx.strokeRect(bx, by, bw, bh);
      // 8 resize handles (corners + edge midpoints)
      ctx.setLineDash([]);
      const hs = 8 / scale;
      ctx.lineWidth = 2 / scale;
      const cx = bx + bw / 2, cy = by + bh / 2;
      const pts: [number, number][] = [
        [bx, by], [cx, by], [bx + bw, by],
        [bx, cy], [bx + bw, cy],
        [bx, by + bh], [cx, by + bh], [bx + bw, by + bh],
      ];
      for (const [hx, hy] of pts) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        ctx.strokeStyle = '#16A34A';
        ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
      }
      ctx.restore();
    }
    if (marqueeRef.current) {
      const m = marqueeRef.current;
      ctx.save();
      ctx.strokeStyle = '#16A34A';
      ctx.fillStyle = 'rgba(22,163,74,0.08)';
      ctx.lineWidth = lw;
      ctx.setLineDash([5 / scale, 3 / scale]);
      const x = Math.min(m.x1, m.x2), y = Math.min(m.y1, m.y2);
      const w = Math.abs(m.x2 - m.x1), h = Math.abs(m.y2 - m.y1);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }, [getCtx, scale, panX, panY]);

  // Resize canvas to viewport + repaint on pan/zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      paint();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [getCtx, paint]);

  useEffect(() => { paint(); }, [panX, panY, zoom, paint]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Pan with middle mouse
    if (e.button === 1) {
      panningRef.current = { sx: e.clientX, sy: e.clientY };
      return;
    }

    // Select tool: click element → select+move; click selection → move; empty → marquee
    if (tool === 'select') {
      const w = toWorld(e.clientX, e.clientY);
      // Combined bounds of current selection — clicking anywhere inside (incl. gaps) moves all
      let onSelected = false;
      if (selectedRef.current.length) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of selectedRef.current) {
          const b = elementBounds(el);
          minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
          maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
        }
        // Resize: 8 handles (4 corners + 4 edges). Opposite side is the pivot.
        const hw = 11 / scale;
        const rp = 6 / scale; // match the padded selection box
        const pMinX = minX - rp, pMinY = minY - rp, pMaxX = maxX + rp, pMaxY = maxY + rp;
        const midX = (pMinX + pMaxX) / 2, midY = (pMinY + pMaxY) / 2;
        const ow = Math.max(1, pMaxX - pMinX), oh = Math.max(1, pMaxY - pMinY);
        // [x, y, ex, ey, pivotX, pivotY]
        const handles: [number, number, number, number, number, number][] = [
          [pMinX, pMinY, -1, -1, pMaxX, pMaxY], // nw
          [midX, pMinY, 0, -1, pMinX, pMaxY],   // n
          [pMaxX, pMinY, 1, -1, pMinX, pMaxY],  // ne
          [pMaxX, midY, 1, 0, pMinX, pMinY],    // e
          [pMaxX, pMaxY, 1, 1, pMinX, pMinY],   // se
          [midX, pMaxY, 0, 1, pMinX, pMinY],    // s
          [pMinX, pMaxY, -1, 1, pMaxX, pMinY],  // sw
          [pMinX, midY, -1, 0, pMaxX, pMinY],   // w
        ];
        for (const [hx, hy, ex, ey, px, py] of handles) {
          if (Math.abs(w.x - hx) < hw && Math.abs(w.y - hy) < hw) {
            resizeRef.current = { px, py, ow, oh, ex, ey };
            undoStackRef.current.push(elementsRef.current.map((el) => ({ ...el })));
            return;
          }
        }
        onSelected = pointInBounds({ minX, minY, maxX, maxY }, w.x, w.y);
      }
      if (onSelected) {
        moveRef.current = { x: w.x, y: w.y };
        undoStackRef.current.push(elementsRef.current.map((el) => ({ ...el })));
        return;
      }
      // hit-test topmost element
      const hit = [...elementsRef.current].reverse().find((el) => pointInBounds(elementBounds(el), w.x, w.y));
      if (hit) {
        selectedRef.current = [hit];
        moveRef.current = { x: w.x, y: w.y };
        undoStackRef.current.push(elementsRef.current.map((el) => ({ ...el })));
      } else {
        selectedRef.current = [];
        marqueeRef.current = { x1: w.x, y1: w.y, x2: w.x, y2: w.y };
      }
      paint();
      return;
    }

    if (tool === 'image') return;

    if (tool === 'text') {
      // Prevent the browser's default mousedown focus change from immediately
      // blurring (and committing) the text input we're about to mount.
      e.preventDefault();
      if (textEdit) { commitText(); return; }
      const w = toWorld(e.clientX, e.clientY);
      setTextEdit({ wx: w.x, wy: w.y });
      setTextValue('');
      return;
    }

    isDrawingRef.current = true;
    const w = toWorld(e.clientX, e.clientY);
    if (tool === 'pencil' || tool === 'eraser') {
      const size = tool === 'eraser' ? brushSize * 5 : brushSize;
      currentElementRef.current = { type: tool, color, brushSize: size, points: [w] };
    } else {
      currentElementRef.current = { type: tool, color, brushSize, x1: w.x, y1: w.y, x2: w.x, y2: w.y };
    }
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, color, brushSize, toWorld, paint, textEdit]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (tool === 'eraser') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) setEraserPos({ left: e.clientX - rect.left, top: e.clientY - rect.top });
    } else if (eraserPos) setEraserPos(null);

    if (panningRef.current) {
      const dx = (e.clientX - panningRef.current.sx) / scale;
      const dy = (e.clientY - panningRef.current.sy) / scale;
      panningRef.current = { sx: e.clientX, sy: e.clientY };
      onPan(-dx, -dy);
      return;
    }

    // Selection drag / marquee / resize
    if (tool === 'select') {
      const w = toWorld(e.clientX, e.clientY);
      if (resizeRef.current) {
        const r = resizeRef.current;
        const rawW = r.ex > 0 ? (w.x - r.px) : r.ex < 0 ? (r.px - w.x) : r.ow;
        const rawH = r.ey > 0 ? (w.y - r.py) : r.ey < 0 ? (r.py - w.y) : r.oh;
        const nw = Math.max(6, rawW), nh = Math.max(6, rawH);
        const fx = r.ex ? nw / r.ow : 1;
        const fy = r.ey ? nh / r.oh : 1;
        for (const el of selectedRef.current) scaleElement(el, r.px, r.py, fx, fy);
        r.ow = nw; r.oh = nh; // incremental baseline
        paint();
      } else if (moveRef.current) {
        const dx = w.x - moveRef.current.x, dy = w.y - moveRef.current.y;
        for (const el of selectedRef.current) moveElement(el, dx, dy);
        moveRef.current = { x: w.x, y: w.y };
        paint();
      } else if (marqueeRef.current) {
        marqueeRef.current.x2 = w.x; marqueeRef.current.y2 = w.y;
        paint();
      }
      return;
    }

    if (!isDrawingRef.current || !currentElementRef.current) return;
    const w = toWorld(e.clientX, e.clientY);
    const el = currentElementRef.current;
    if (tool === 'pencil' || tool === 'eraser') el.points!.push(w);
    else { el.x2 = w.x; el.y2 = w.y; }
    paint();
    // Stream the in-progress stroke to collaborators (skip eraser)
    if (tool !== 'eraser') onProgressRef.current?.(el);
  }, [tool, eraserPos, scale, onPan, toWorld, paint]);

  const onMouseUp = useCallback(() => {
    panningRef.current = null;

    // Finish selection interaction
    if (tool === 'select') {
      if (marqueeRef.current) {
        const m = marqueeRef.current;
        const box: Bounds = { minX: Math.min(m.x1, m.x2), minY: Math.min(m.y1, m.y2), maxX: Math.max(m.x1, m.x2), maxY: Math.max(m.y1, m.y2) };
        // treat a tiny marquee as a click (clear selection)
        if (Math.abs(m.x2 - m.x1) > 3 || Math.abs(m.y2 - m.y1) > 3) {
          selectedRef.current = elementsRef.current.filter((el) => boundsIntersect(elementBounds(el), box));
        }
        marqueeRef.current = null;
        paint();
      }
      if (moveRef.current) {
        moveRef.current = null;
        redoStackRef.current = [];
        emitChange();
      }
      if (resizeRef.current) {
        resizeRef.current = null;
        redoStackRef.current = [];
        emitChange();
      }
      return;
    }

    if (!isDrawingRef.current || !currentElementRef.current) return;
    isDrawingRef.current = false;
    const el = { ...currentElementRef.current };
    if (el.points) el.points = [...el.points];
    undoStackRef.current.push([...elementsRef.current]);
    redoStackRef.current = [];
    elementsRef.current.push(el);
    currentElementRef.current = null;
    paint();
    onDraw(el);
    emitChange();
  }, [tool, onDraw, paint, emitChange]);

  // Delete selected with Delete/Backspace; Escape clears selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      // Ctrl/Cmd+A → select all elements
      if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
        if (elementsRef.current.length) {
          e.preventDefault();
          selectedRef.current = [...elementsRef.current];
          onSelectAllRef.current?.();
          paint();
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current.length) {
        e.preventDefault();
        undoStackRef.current.push([...elementsRef.current]);
        const sel = new Set(selectedRef.current);
        elementsRef.current = elementsRef.current.filter((el) => !sel.has(el));
        selectedRef.current = [];
        paint();
        emitChange();
      } else if (e.key === 'Escape' && selectedRef.current.length) {
        selectedRef.current = [];
        paint();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paint, emitChange]);

  const commitText = useCallback(() => {
    setTextEdit((edit) => {
      const value = textValue.trim();
      if (edit && value) {
        const el: DrawElement = { type: 'text', color, brushSize, x: edit.wx, y: edit.wy, text: value, fontSize: textFontSize };
        undoStackRef.current.push([...elementsRef.current]);
        redoStackRef.current = [];
        elementsRef.current.push(el);
        paint();
        onDraw(el);
        emitChange();
      }
      return null;
    });
    setTextValue('');
  }, [textValue, color, brushSize, textFontSize, onDraw, paint, emitChange]);

  useImperativeHandle(ref, () => ({
    undo() {
      if (!undoStackRef.current.length) return;
      redoStackRef.current.push([...elementsRef.current]);
      elementsRef.current = undoStackRef.current.pop()!;
      selectedRef.current = [];
      paint();
      emitChange();
    },
    redo() {
      if (!redoStackRef.current.length) return;
      undoStackRef.current.push([...elementsRef.current]);
      elementsRef.current = redoStackRef.current.pop()!;
      selectedRef.current = [];
      paint();
      emitChange();
    },
    clear() {
      undoStackRef.current.push([...elementsRef.current]);
      elementsRef.current = [];
      selectedRef.current = [];
      paint();
      emitChange();
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
      if (!el) return;
      elementsRef.current.push(el);
      paint();
      // safety repaint (handles async images / timing)
      requestAnimationFrame(() => paint());
    },
    placeImage({ src, x, y, w, h }) {
      const el: DrawElement = { type: 'image', color, brushSize, src, x, y, w, h };
      undoStackRef.current.push([...elementsRef.current]);
      redoStackRef.current = [];
      elementsRef.current.push(el);
      paint();
      onDraw(el);
      emitChange();
    },
    loadElements(els: DrawElement[]) {
      elementsRef.current = els.filter(Boolean);
      selectedRef.current = [];
      undoStackRef.current = [];
      redoStackRef.current = [];
      requestAnimationFrame(() => paint());
    },
    setLiveStroke(id: string, el: DrawElement) {
      liveStrokesRef.current.set(id, el);
      paint();
    },
    clearLiveStroke(id: string) {
      if (liveStrokesRef.current.delete(id)) paint();
    },
    getContentBounds() {
      if (!elementsRef.current.length) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const el of elementsRef.current) {
        const b = elementBounds(el);
        minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
      }
      if (!isFinite(minX)) return null;
      return { minX, minY, maxX, maxY };
    },
  }), [paint, onDraw, color, brushSize, emitChange]);

  const cursor = tool === 'select' ? 'default' : tool === 'image' ? 'copy' : tool === 'text' ? 'text' : tool === 'eraser' ? 'none' : 'crosshair';
  const eraserDiameter = brushSize * 5 * scale;

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ cursor }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { onMouseUp(); setEraserPos(null); }}
        className="touch-none block"
      />

      {textEdit && (
        <input
          autoFocus
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onBlur={commitText}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); commitText(); }
            if (e.key === 'Escape') { setTextEdit(null); setTextValue(''); }
          }}
          placeholder="Type…"
          className="absolute z-30 bg-white/70 outline-none border-b-2 border-[var(--primary)] px-1 rounded-sm"
          style={{
            left: (textEdit.wx - panX) * scale,
            top: (textEdit.wy - panY) * scale,
            color: color === '#FFFFFF' ? '#111111' : color,
            fontSize: Math.max(14, textFontSize * scale),
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
            lineHeight: 1.1,
            minWidth: 100,
          }}
        />
      )}

      {tool === 'eraser' && eraserPos && (
        <div
          className="absolute pointer-events-none rounded-full border-2 border-[var(--danger)] bg-[var(--danger)]/10"
          style={{ left: eraserPos.left - eraserDiameter / 2, top: eraserPos.top - eraserDiameter / 2, width: eraserDiameter, height: eraserDiameter }}
        />
      )}
    </div>
  );
});

export default Canvas;
