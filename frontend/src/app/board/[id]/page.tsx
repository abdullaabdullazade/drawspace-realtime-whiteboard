'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Share2, Download, Layers, X,
  ZoomIn, ZoomOut, Users, RotateCcw, RotateCw, CheckCircle2, Loader2, ImagePlus,
} from 'lucide-react';
import Canvas, { CanvasRef, DrawElement } from '@/components/Canvas';
import Toolbar from '@/components/Toolbar';
import CursorOverlay from '@/components/CursorOverlay';
import { getBoard } from '@/lib/api';
import { getSocket } from '@/lib/socket';

type Tool = 'select' | 'pencil' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'text' | 'image';

interface OnlineUser {
  id: string;
  username: string;
  color: string;
  cursor: { x: number; y: number };
}

type SaveStatus = 'saved' | 'saving';

const USER_COLORS = ['#6C5CE7', '#24D17E', '#F4B740', '#53A7FF', '#FF5E6C', '#8B7CF0'];

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canvasRef = useRef<CanvasRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  const [tool, setTool] = useState<Tool>('pencil');
  const [editImg, setEditImg] = useState<{ src: string; x: number; y: number; w: number; h: number } | null>(null);
  const [color, setColor] = useState('#111111');
  const [brushSize, setBrushSize] = useState<2 | 6 | 12>(6);
  const [zoom, setZoom] = useState(100);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [boardName, setBoardName] = useState('Loading…');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Lock body scroll while board open
  useEffect(() => {
    document.body.classList.add('board-open');
    return () => document.body.classList.remove('board-open');
  }, []);

  // Restore last scroll position for this board
  useEffect(() => {
    const saved = localStorage.getItem(`scroll-${id}`);
    const sc = scrollRef.current;
    if (saved && sc) {
      const [l, t] = saved.split(',').map(Number);
      requestAnimationFrame(() => { sc.scrollLeft = l; sc.scrollTop = t; });
    } else if (sc) {
      // Default: center the big surface
      requestAnimationFrame(() => {
        sc.scrollLeft = (3200 - sc.clientWidth) / 2;
        sc.scrollTop = (2000 - sc.clientHeight) / 2;
      });
    }
  }, [id]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }
    getBoard(id)
      .then((b) => {
        setBoardName(b.name);
        if (b.elements?.length) {
          const els = b.elements.map((e) => e.data as unknown as DrawElement);
          canvasRef.current?.loadElements(els);
        }
      })
      .catch(() => router.push('/dashboard'));
  }, [id, router]);

  // WebSocket
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const socket = getSocket(token);

    socket.on('connect', () => { setConnected(true); socket.emit('board:join', { boardId: id }); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('draw', ({ element }: { userId: string; element: DrawElement }) => {
      canvasRef.current?.addRemoteElement(element);
    });
    socket.on('user:joined', ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => prev.find((u) => u.id === userId) ? prev : [...prev, {
        id: userId, username: `User ${userId.slice(0, 4)}`,
        color: USER_COLORS[prev.length % USER_COLORS.length], cursor: { x: 0, y: 0 },
      }]);
    });
    socket.on('user:left', ({ userId }: { userId: string }) => setOnlineUsers((prev) => prev.filter((u) => u.id !== userId)));
    socket.on('cursor:moved', ({ userId, x, y }: { userId: string; x: number; y: number }) =>
      setOnlineUsers((prev) => prev.map((u) => u.id === userId ? { ...u, cursor: { x, y } } : u)));

    return () => {
      socket.emit('board:leave', { boardId: id });
      ['connect', 'disconnect', 'draw', 'user:joined', 'user:left', 'cursor:moved'].forEach((e) => socket.off(e));
    };
  }, [id]);

  const handleDraw = useCallback((el: DrawElement) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setSaveStatus('saving');
    getSocket(token).emit('draw', { boardId: id, element: el });
    setTimeout(() => setSaveStatus('saved'), 800);
  }, [id]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const token = localStorage.getItem('token');
    if (!token || !connected) return;
    const rect = e.currentTarget.getBoundingClientRect();
    getSocket(token).emit('cursor:move', { boardId: id, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [id, connected]);

  // Image paste (Ctrl+V) + drag-drop + file upload → editable overlay at viewport center
  const insertImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      if (typeof src !== 'string') return;
      const img = new Image();
      img.onload = () => {
        const scale = zoom / 100;
        // Fit initial size (cap 520 long edge), keep aspect + quality
        const cap = 520;
        let w = img.naturalWidth, h = img.naturalHeight;
        if (Math.max(w, h) > cap) { const r = cap / Math.max(w, h); w *= r; h *= r; }
        // Place at visible viewport center (canvas coords)
        const sc = scrollRef.current;
        const cx = ((sc?.scrollLeft ?? 0) + (sc?.clientWidth ?? 800) / 2) / scale;
        const cy = ((sc?.scrollTop ?? 0) + (sc?.clientHeight ?? 600) / 2) / scale;
        setEditImg({ src, x: cx - w / 2, y: cy - h / 2, w, h });
        setTool('select');
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [zoom]);

  const commitImage = useCallback(() => {
    if (!editImg) return;
    canvasRef.current?.placeImage(editImg);
    setEditImg(null);
  }, [editImg]);

  const startDrag = useCallback((mode: 'move' | 'resize', e: React.MouseEvent) => {
    if (!editImg) return;
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, ox: editImg.x, oy: editImg.y, ow: editImg.w, oh: editImg.h };
  }, [editImg]);

  const onOverlayMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const scale = zoom / 100;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;
    setEditImg((im) => {
      if (!im) return im;
      if (d.mode === 'move') return { ...im, x: d.ox + dx, y: d.oy + dy };
      // resize keep aspect
      const ratio = d.ow / d.oh;
      let w = Math.max(40, d.ow + dx);
      let h = w / ratio;
      return { ...im, w, h };
    });
  }, [zoom]);

  const endDrag = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) insertImageFile(file);
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [insertImageFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) insertImageFile(file);
  }, [insertImageFile]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 10, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 10, 25));
  const handleExport = () => canvasRef.current?.exportPNG();
  const handleShare = () => navigator.clipboard.writeText(window.location.href);

  return (
    <div className="fixed inset-0 bg-[var(--bg)] flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-16 shrink-0 bg-[var(--card)]/90 backdrop-blur-xl border-b border-[var(--border)] flex items-center px-4 gap-3 z-40" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <button onClick={() => router.push('/dashboard')} className="icon-btn w-9 h-9 rounded-[12px]">
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </button>
        <div className="h-6 w-px bg-[var(--border)]" />
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] bg-[var(--primary-gradient)] flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-[var(--text)] max-w-[240px] truncate leading-tight">{boardName}</h1>
            <span className="text-[12px] text-[var(--muted)]">Whiteboard</span>
          </div>
        </div>

        <div className="flex-1" />

        {onlineUsers.length > 0 && (
          <div className="flex -space-x-2 mr-1">
            {onlineUsers.slice(0, 4).map((u) => (
              <div key={u.id} className="w-8 h-8 rounded-full border-2 border-[var(--card)] flex items-center justify-center text-xs font-semibold text-white" style={{ backgroundColor: u.color }} title={u.username}>
                {u.username.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        {/* Grouped status pill */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[var(--bg-2)] rounded-full border border-[var(--border)] text-[13px] font-medium">
          <span className="flex items-center gap-1.5 text-[var(--muted)]">
            <Users className="w-3.5 h-3.5" strokeWidth={2} />{onlineUsers.length + 1}
          </span>
          <span className="w-px h-3.5 bg-[var(--border-2)]" />
          <span className={`flex items-center gap-1.5 ${saveStatus === 'saved' ? 'text-[var(--primary)]' : 'text-[var(--warning)]'}`}>
            {saveStatus === 'saved' ? <><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.25} /> Saved</> : <><Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.25} /> Saving</>}
          </span>
          <span className="w-px h-3.5 bg-[var(--border-2)]" />
          <span className={`flex items-center gap-1.5 ${connected ? 'text-[var(--primary)]' : 'text-[var(--danger)]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--primary)]' : 'bg-[var(--danger)]'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        <div className="h-6 w-px bg-[var(--border)] mx-1" />

        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium">
          <ImagePlus className="w-4 h-4" strokeWidth={1.75} /> Image
        </button>
        <button onClick={handleShare} className="btn-secondary flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium">
          <Share2 className="w-4 h-4" strokeWidth={1.75} /> Share
        </button>
        <button onClick={handleExport} className="btn-primary flex items-center gap-2 px-4 py-2 text-[13px] font-semibold">
          <Download className="w-4 h-4" strokeWidth={2} /> Export
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) insertImageFile(f); e.target.value = ''; }}
        />
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <Toolbar
          tool={tool}
          onToolChange={(t) => t === 'image' ? fileInputRef.current?.click() : setTool(t as Tool)}
          color={color}
          onColorChange={setColor}
          brushSize={brushSize}
          onBrushSizeChange={(s) => setBrushSize(s as 2 | 6 | 12)}
        />

        <div
          ref={scrollRef}
          className="flex-1 relative overflow-auto ml-[76px]"
          onMouseMove={(e) => { handleMouseMove(e); onOverlayMove(e); }}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onScroll={(e) => localStorage.setItem(`scroll-${id}`, `${e.currentTarget.scrollLeft},${e.currentTarget.scrollTop}`)}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* Large scrollable canvas surface */}
          <div className="canvas-grid relative" style={{ width: 3200, height: 2000 }}>
            <Canvas ref={canvasRef} tool={tool} color={color} brushSize={brushSize} onDraw={handleDraw} zoom={zoom} />
            <CursorOverlay users={onlineUsers} />

            {/* Editable image overlay */}
            {editImg && (
              <div
                className="absolute z-20 group/img"
                style={{
                  left: editImg.x * (zoom / 100),
                  top: editImg.y * (zoom / 100),
                  width: editImg.w * (zoom / 100),
                  height: editImg.h * (zoom / 100),
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editImg.src}
                  alt=""
                  draggable={false}
                  onMouseDown={(e) => startDrag('move', e)}
                  className="w-full h-full object-fill rounded-[2px] cursor-move ring-2 ring-[var(--primary)] shadow-[var(--shadow-md)] select-none"
                />
                {/* Resize handle */}
                <div
                  onMouseDown={(e) => startDrag('resize', e)}
                  className="absolute -right-2 -bottom-2 w-4 h-4 rounded-full bg-white border-2 border-[var(--primary)] cursor-nwse-resize shadow"
                />
                {/* Toolbar */}
                <div className="absolute -top-11 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-full px-1.5 py-1 shadow-[var(--shadow-md)]">
                  <button onClick={commitImage} className="btn-primary text-[12px] px-3 py-1 rounded-full">Done</button>
                  <button onClick={() => setEditImg(null)} className="icon-btn w-7 h-7 rounded-full"><X className="w-4 h-4" strokeWidth={2} /></button>
                </div>
              </div>
            )}
          </div>

          {/* Paste hint — fixed over viewport */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] text-xs text-[var(--muted)] pointer-events-none z-30">
            <ImagePlus className="w-3.5 h-3.5" strokeWidth={1.75} />
            Paste, drop or upload an image
          </div>
        </div>
      </div>

      {/* Undo / Redo */}
      <div className="fixed bottom-6 left-20 flex items-center gap-1 bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] rounded-2xl px-2 py-1.5 z-40" style={{ boxShadow: 'var(--shadow-md)' }}>
        <button onClick={() => canvasRef.current?.undo()} className="icon-btn w-8 h-8 rounded-xl" title="Undo"><RotateCcw className="w-4 h-4" strokeWidth={1.75} /></button>
        <button onClick={() => canvasRef.current?.redo()} className="icon-btn w-8 h-8 rounded-xl" title="Redo"><RotateCw className="w-4 h-4" strokeWidth={1.75} /></button>
      </div>

      {/* Zoom */}
      <div className="fixed bottom-6 right-6 flex items-center gap-1 bg-[var(--card)]/95 backdrop-blur-md border border-[var(--border)] rounded-2xl px-2 py-1.5 z-40" style={{ boxShadow: 'var(--shadow-md)' }}>
        <button onClick={handleZoomOut} className="icon-btn w-8 h-8 rounded-xl"><ZoomOut className="w-4 h-4" strokeWidth={1.75} /></button>
        <span className="text-xs text-[var(--muted)] font-medium px-1 min-w-[3rem] text-center">{zoom}%</span>
        <button onClick={handleZoomIn} className="icon-btn w-8 h-8 rounded-xl"><ZoomIn className="w-4 h-4" strokeWidth={1.75} /></button>
      </div>
    </div>
  );
}
