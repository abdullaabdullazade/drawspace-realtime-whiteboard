'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Trash2, ExternalLink, Pencil, Globe, Lock, Users, Clock, Box, ArrowRight } from 'lucide-react';
import { Board } from '@/lib/api';

function timeAgo(dateStr: string, now: number) {
  try {
    const diff = now - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const hr = Math.floor(m / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  } catch { return ''; }
}

interface BoardCardProps {
  board: Board;
  onDelete?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  now: number;
}

const GRADIENTS = [
  { from: '#26AE6C', to: '#1B9459' },
  { from: '#2BB673', to: '#17794A' },
  { from: '#34C57F', to: '#1FA463' },
  { from: '#1FA463', to: '#0F7B5A' },
];

export default function BoardCard({ board, onDelete, onRename, now }: BoardCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(board.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  const commitRename = () => {
    const trimmed = name.trim();
    setRenaming(false);
    if (trimmed && trimmed !== board.name) onRename?.(board.id, trimmed);
    else setName(board.name);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.menu-container') || renaming) return;
    router.push(`/board/${board.id}`);
  };

  const getGradientIndex = (n: string) => {
    let hash = 0;
    for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % GRADIENTS.length;
  };
  const grad = GRADIENTS[getGradientIndex(board.name)];

  return (
    <motion.div
      onClick={handleCardClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group relative card-premium rounded-[24px] flex flex-col cursor-pointer"
    >
      {/* Inner clip wrapper (rounds cover + body) */}
      <div className="rounded-[24px] overflow-hidden flex flex-col flex-1">
      {/* Gradient Cover */}
      <div
        className="relative h-[92px] overflow-hidden flex items-center px-6"
        style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
      >
        <div className="absolute -top-8 -right-6 w-28 h-28 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-10 -left-4 w-24 h-24 rounded-full bg-black/10 blur-2xl" />

        <div className="w-11 h-11 rounded-[13px] bg-white/20 backdrop-blur-sm border border-white/25 flex items-center justify-center">
          <Box className="w-[22px] h-[22px] text-white" strokeWidth={2} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-6">
        {renaming ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setName(board.name); setRenaming(false); } }}
            className="text-[18px] font-semibold text-[var(--text)] tracking-tight bg-[var(--bg-2)] border border-[var(--primary)] rounded-[10px] px-2 py-1 -mx-2 -my-1 focus:outline-none focus:ring-2 focus:ring-[rgba(22,163,74,0.16)]"
          />
        ) : (
          <h3 className="text-[18px] font-semibold text-[var(--text)] tracking-tight truncate">{board.name}</h3>
        )}
        <p className="text-[15px] text-[var(--muted)] line-clamp-2 leading-relaxed mt-1.5 flex-1">
          {board.description || 'No description yet. Open to start creating.'}
        </p>

        <div className="border-t border-[var(--border-light)] my-4" />

        <div className="flex items-center justify-between text-[14px]">
          <div className="flex items-center gap-4 text-[var(--muted)] font-medium">
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" strokeWidth={2} /> {board.memberCount ?? 1}</span>
            <span className="flex items-center gap-1.5" style={{ color: board.isPublic ? 'var(--primary)' : 'var(--warning)' }}>
              {board.isPublic ? <Globe className="w-4 h-4" strokeWidth={2} /> : <Lock className="w-4 h-4" strokeWidth={2} />}
              {board.isPublic ? 'Public' : 'Private'}
            </span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" strokeWidth={2} /> {timeAgo(board.createdAt, now)}</span>
          </div>
          <span className="flex items-center gap-1 text-[var(--primary)] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="w-4 h-4" strokeWidth={2.25} />
          </span>
        </div>
      </div>
      </div>{/* end inner clip */}

      {/* Menu — outside clip so dropdown isn't cut off */}
      <div className="absolute top-3 right-3 z-30 menu-container">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(!showMenu); }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white bg-black/15 hover:bg-black/30 backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-5 h-5" strokeWidth={2} />
        </button>
        <AnimatePresence>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(false); }} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-48 bg-[var(--card)] border border-[var(--border)] rounded-[16px] shadow-[var(--shadow-hover)] z-50 p-1.5"
              >
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(false); router.push(`/board/${board.id}`); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[14px] font-medium text-[var(--text)] hover:bg-[var(--hover)] rounded-[10px] transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-[var(--muted-darker)]" strokeWidth={2} /> Open
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(false); setRenaming(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[14px] font-medium text-[var(--text)] hover:bg-[var(--hover)] rounded-[10px] transition-colors"
                >
                  <Pencil className="w-4 h-4 text-[var(--muted-darker)]" strokeWidth={2} /> Rename
                </button>
                <div className="h-px bg-[var(--border-light)] my-1 mx-2" />
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMenu(false); onDelete?.(board.id); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[14px] font-medium text-[var(--danger)] hover:bg-[rgba(239,68,68,0.06)] rounded-[10px] transition-colors"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={2} /> Delete board
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
