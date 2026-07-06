'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Share2, Download, Layers, X, Mail, Copy, Check, Maximize2,
  ZoomIn, ZoomOut, Users, RotateCcw, RotateCw, CheckCircle2, Loader2, ImagePlus,
} from 'lucide-react';
import Canvas, { CanvasRef, DrawElement } from '@/components/Canvas';
import Toolbar from '@/components/Toolbar';
import CursorOverlay from '@/components/CursorOverlay';
import { getBoard, getPublicBoard, inviteToBoard, Board } from '@/lib/api';
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
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  const [tool, setTool] = useState<Tool>('pencil');
  const [editImg, setEditImg] = useState<{ src: string; x: number; y: number; w: number; h: number } | null>(null);
  const [color, setColor] = useState('#111111');
  const [brushSize, setBrushSize] = useState<2 | 6 | 12>(6);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // world coord of viewport top-left
  const viewDirtyRef = useRef(false); // true once user pans/zooms — gate persistence
  const viewRestoredRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [boardName, setBoardName] = useState('Loading…');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [rxCount, setRxCount] = useState(0);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Lock body scroll while board open
  useEffect(() => {
    document.body.classList.add('board-open');
    return () => document.body.classList.remove('board-open');
  }, []);

  // Wheel: two-finger scroll = infinite pan (all directions); ctrl/⌘+wheel = zoom
  useEffect(() => {
    const sc = surfaceRef.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      viewDirtyRef.current = true;
      if (e.ctrlKey || e.metaKey) {
        setZoom((z) => Math.min(300, Math.max(20, Math.round(z - e.deltaY * 0.5))));
      } else {
        setZoom((z) => {
          const s = z / 100;
          setPan((p) => ({ x: p.x + e.deltaX / s, y: p.y + e.deltaY / s }));
          return z;
        });
      }
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, []);

  // Restore last view (pan + zoom) — runs once, does NOT mark dirty
  useEffect(() => {
    const saved = localStorage.getItem(`view-${id}`);
    if (saved) {
      const [x, y, z] = saved.split(',').map(Number);
      if (!Number.isNaN(x)) setPan({ x, y });
      if (!Number.isNaN(z) && z) setZoom(z);
    }
    viewRestoredRef.current = true;
  }, [id]);

  // Persist view only after the user actually pans/zooms (never overwrite with initial 0,0)
  useEffect(() => {
    if (!viewRestoredRef.current || !viewDirtyRef.current) return;
    localStorage.setItem(`view-${id}`, `${Math.round(pan.x)},${Math.round(pan.y)},${zoom}`);
  }, [id, pan, zoom]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    // Logged in → normal fetch (private or public). Guest → public-only fetch.
    const loader: Promise<Board> = token ? getBoard(id) : getPublicBoard(id);
    loader
      .then((b) => {
        setBoardName(b.name);
        // DB is authoritative (has every collaborator's elements) → load it first.
        if (b.elements?.length) {
          const els = b.elements.map((e) => e.data as unknown as DrawElement);
          canvasRef.current?.loadElements(els);
          // Always frame all content on open so collaborators share the same view
          requestAnimationFrame(() => fitToContent());
          return;
        }
        // Fallback: local snapshot (e.g. offline drawing before it synced)
        const snap = localStorage.getItem(`snap-${id}`);
        if (snap) {
          try {
            const els = JSON.parse(snap) as DrawElement[];
            if (els.length) canvasRef.current?.loadElements(els);
          } catch { /* ignore */ }
        }
      })
      .catch(() => {
        // Guest hitting a private board → send to login; logged-in error → dashboard
        router.push(token ? '/dashboard' : '/login');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // WebSocket — connect as guest when no token (public boards)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = getSocket(token);

    const join = () => { setConnected(true); socket.emit('board:join', { boardId: id }); };
    const onDisconnect = () => setConnected(false);
    const onDraw = ({ userId, element }: { userId: string; element: DrawElement }) => {
      canvasRef.current?.clearLiveStroke(userId);
      canvasRef.current?.addRemoteElement(element);
      setRxCount((c) => c + 1);
    };
    const onDrawProgress = ({ userId, element }: { userId: string; element: DrawElement }) => {
      canvasRef.current?.setLiveStroke(userId, element);
    };
    const onJoined = ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => prev.find((u) => u.id === userId) ? prev : [...prev, {
        id: userId, username: `User ${userId.slice(0, 4)}`,
        color: USER_COLORS[prev.length % USER_COLORS.length], cursor: { x: 0, y: 0 },
      }]);
    };
    const onLeft = ({ userId }: { userId: string }) => {
      canvasRef.current?.clearLiveStroke(userId);
      setOnlineUsers((prev) => prev.filter((u) => u.id !== userId));
    };
    const onCursor = ({ userId, x, y }: { userId: string; x: number; y: number }) =>
      setOnlineUsers((prev) => prev.map((u) => u.id === userId ? { ...u, cursor: { x, y } } : u));

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);
    socket.on('draw', onDraw);
    socket.on('draw:progress', onDrawProgress);
    socket.on('user:joined', onJoined);
    socket.on('user:left', onLeft);
    socket.on('cursor:moved', onCursor);

    return () => {
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
      socket.off('draw', onDraw);
      socket.off('draw:progress', onDrawProgress);
      socket.off('user:joined', onJoined);
      socket.off('user:left', onLeft);
      socket.off('cursor:moved', onCursor);
    };
  }, [id]);

  const handleDraw = useCallback((el: DrawElement) => {
    const token = localStorage.getItem('token');
    setSaveStatus('saving');
    getSocket(token).emit('draw', { boardId: id, element: el });
    setTimeout(() => setSaveStatus('saved'), 800);
  }, [id]);

  // Stream the in-progress stroke live (throttled) so others see it draw point-by-point
  const lastProgressRef = useRef(0);
  const handleDrawProgress = useCallback((el: DrawElement) => {
    const t = performance.now();
    if (t - lastProgressRef.current < 45) return;
    lastProgressRef.current = t;
    const token = localStorage.getItem('token');
    getSocket(token).emit('draw:progress', { boardId: id, element: el });
  }, [id]);

  // Snapshot every change to localStorage so reopening restores the exact state
  const saveSnapshot = useCallback((els: DrawElement[]) => {
    try {
      localStorage.setItem(`snap-${id}`, JSON.stringify(els));
    } catch {
      // Quota (large images) — drop image data from snapshot as fallback
      try {
        const light = els.filter((e) => e.type !== 'image');
        localStorage.setItem(`snap-${id}`, JSON.stringify(light));
      } catch { /* give up, DB still has it */ }
    }
  }, [id]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!connected) return;
    const token = localStorage.getItem('token');
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
        // Place at visible viewport center (world coords)
        const sc = surfaceRef.current;
        const cx = pan.x + (sc?.clientWidth ?? 800) / 2 / scale;
        const cy = pan.y + (sc?.clientHeight ?? 600) / 2 / scale;
        setEditImg({ src, x: cx - w / 2, y: cy - h / 2, w, h });
        setTool('select');
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [zoom, pan]);

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

  const fitToContent = useCallback(() => {
    const b = canvasRef.current?.getContentBounds();
    const sc = surfaceRef.current;
    if (!b || !sc) return;
    const vw = sc.clientWidth, vh = sc.clientHeight;
    const cw = Math.max(1, b.maxX - b.minX), ch = Math.max(1, b.maxY - b.minY);
    let z = Math.min(vw / cw, vh / ch) * 0.82 * 100;
    z = Math.min(200, Math.max(20, Math.round(z)));
    const s = z / 100;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    viewDirtyRef.current = true;
    setZoom(z);
    setPan({ x: cx - (vw / s) / 2, y: cy - (vh / s) / 2 });
  }, []);

  const handleZoomIn = () => { viewDirtyRef.current = true; setZoom((z) => Math.min(z + 10, 200)); };
  const handleZoomOut = () => { viewDirtyRef.current = true; setZoom((z) => Math.max(z - 10, 25)); };
  const handleExport = () => canvasRef.current?.exportPNG();
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  };
  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteLoading(true);
    setInviteMsg(null);
    try {
      const res = await inviteToBoard(id, email);
      setInviteMsg({ type: 'ok', text: res.message });
      setInviteEmail('');
    } catch (err: unknown) {
      setInviteMsg({ type: 'err', text: err instanceof Error ? err.message : 'Invite failed' });
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--bg)] flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-16 shrink-0 bg-[var(--card)]/90 backdrop-blur-xl border-b border-[var(--border)] flex items-center px-4 gap-3 z-40" style={{ boxShadow: 'var(--shadow-sm)' }}>
        <button onClick={() => router.push('/dashboard')} className="icon-btn w-9 h-9 rounded-[12px]">
          <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </button>
        <div className="h-6 w-px bg-[var(--border)]" />
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] grad-primary flex items-center justify-center shrink-0">
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
          <span className="text-[var(--muted)]" title="Remote draws received">rx {rxCount}</span>
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
        <button onClick={() => { setShowInvite(true); setInviteMsg(null); }} className="btn-secondary flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium">
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
          ref={surfaceRef}
          className="flex-1 relative overflow-hidden ml-[76px]"
          style={{ backgroundColor: '#FBFDFC', backgroundImage: `radial-gradient(circle, #DCEAE1 1px, transparent 1px)`, backgroundSize: `${28 * (zoom / 100)}px ${28 * (zoom / 100)}px`, backgroundPosition: `${-pan.x * (zoom / 100)}px ${-pan.y * (zoom / 100)}px` }}
          onMouseMove={(e) => { handleMouseMove(e); onOverlayMove(e); }}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="absolute inset-0">
            <Canvas ref={canvasRef} tool={tool} color={color} brushSize={brushSize} onDraw={handleDraw} onDrawProgress={handleDrawProgress} onChange={saveSnapshot} onSelectAll={() => setTool('select')} zoom={zoom} panX={pan.x} panY={pan.y} onPan={(dx, dy) => { viewDirtyRef.current = true; setPan((p) => ({ x: p.x + dx, y: p.y + dy })); }} />
            <CursorOverlay users={onlineUsers} />

            {/* Editable image overlay (world → screen) */}
            {editImg && (
              <div
                className="absolute z-20 group/img"
                style={{
                  left: (editImg.x - pan.x) * (zoom / 100),
                  top: (editImg.y - pan.y) * (zoom / 100),
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
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-full p-1 shadow-[var(--shadow-md)]">
                  <button onClick={commitImage} className="grad-primary text-white text-[13px] font-semibold px-4 h-8 rounded-full flex items-center gap-1.5 hover:brightness-105 transition">
                    <Check className="w-4 h-4" strokeWidth={2.5} /> Done
                  </button>
                  <button onClick={() => setEditImg(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition"><X className="w-4 h-4" strokeWidth={2} /></button>
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
        <div className="w-px h-4 bg-[var(--border)] mx-0.5" />
        <button onClick={fitToContent} className="icon-btn w-8 h-8 rounded-xl" title="Fit to content"><Maximize2 className="w-4 h-4" strokeWidth={1.75} /></button>
      </div>

      {/* Invite / Share modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative w-full max-w-[440px] bg-[var(--card)] rounded-[24px] border border-[var(--border)] shadow-[var(--shadow-lg)] overflow-hidden">
            <div className="flex items-center justify-between px-7 py-5 border-b border-[var(--border-light)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[11px] grad-primary flex items-center justify-center"><Share2 className="w-[18px] h-[18px] text-white" strokeWidth={2} /></div>
                <h2 className="text-[18px] font-semibold text-[var(--text)]">Share board</h2>
              </div>
              <button onClick={() => setShowInvite(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"><X className="w-5 h-5" strokeWidth={2} /></button>
            </div>

            <div className="p-7 space-y-5">
              {/* Invite by email */}
              <div>
                <label className="block text-[14px] font-semibold text-[var(--text)] mb-2">Invite by email</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--muted)]" strokeWidth={1.75} />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                      placeholder="teammate@email.com"
                      className="input w-full pl-11 pr-3 py-3 text-[15px]"
                    />
                  </div>
                  <button onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()} className="btn-primary px-5 text-[14px] disabled:opacity-50">
                    {inviteLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Invite'}
                  </button>
                </div>
                {inviteMsg && (
                  <p className={`text-[13px] mt-2 font-medium ${inviteMsg.type === 'ok' ? 'text-[var(--primary)]' : 'text-[var(--danger)]'}`}>{inviteMsg.text}</p>
                )}
              </div>

              {/* Copy link */}
              <div>
                <label className="block text-[14px] font-semibold text-[var(--text)] mb-2">Or share a link</label>
                <button onClick={handleCopyLink} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-[14px] border border-[var(--border)] bg-[var(--bg)] hover:border-[var(--primary)] transition-colors">
                  <span className="text-[14px] text-[var(--muted)] truncate">{typeof window !== 'undefined' ? window.location.href : ''}</span>
                  <span className={`flex items-center gap-1.5 text-[13px] font-semibold shrink-0 ${linkCopied ? 'text-[var(--primary)]' : 'text-[var(--muted-darker)]'}`}>
                    {linkCopied ? <><Check className="w-4 h-4" strokeWidth={2.5} /> Copied</> : <><Copy className="w-4 h-4" strokeWidth={2} /> Copy</>}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
