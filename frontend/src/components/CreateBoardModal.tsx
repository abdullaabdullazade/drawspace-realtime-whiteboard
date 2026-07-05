'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Lock, Box } from 'lucide-react';

interface CreateBoardModalProps {
  onClose: () => void;
  onCreate: (data: { name: string; description: string; isPublic: boolean }) => void;
}

export default function CreateBoardModal({ onClose, onCreate }: CreateBoardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    onCreate({ name: name.trim(), description: description.trim(), isPublic });
    setLoading(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/20 backdrop-blur-sm dark:bg-black/60"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-[500px] bg-[var(--card)] rounded-[24px] shadow-[var(--shadow-sidebar)] border border-[var(--border)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--border-light)]">
            <div className="flex items-center gap-4">
              <div className="w-[40px] h-[40px] rounded-[12px] bg-[var(--primary-gradient)] flex items-center justify-center shadow-[var(--shadow-primary)]">
                <Box className="w-5 h-5 text-white" strokeWidth={1.75} />
              </div>
              <h2 className="text-[20px] font-semibold text-[var(--text)] tracking-tight">
                Create new board
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg)] text-[var(--muted-darker)] hover:text-[var(--text)] transition-colors"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            <div>
              <label className="block text-[14px] font-semibold text-[var(--text)] mb-2">
                Board Name <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q3 Design System"
                required
                autoFocus
                className="input w-full px-4 py-3.5 text-[15px]"
              />
            </div>

            <div>
              <label className="block text-[14px] font-semibold text-[var(--text)] mb-2">
                Description <span className="text-[var(--muted)] font-normal">(Optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is the goal of this board?"
                rows={3}
                className="input w-full px-4 py-3.5 text-[15px] resize-none custom-scrollbar"
              />
            </div>

            <div>
              <label className="block text-[14px] font-semibold text-[var(--text)] mb-3">Privacy</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`flex-1 flex flex-col items-center gap-2 p-5 rounded-[16px] border-2 transition-all duration-250 ${
                    !isPublic
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted)] text-[var(--muted-darker)]'
                  }`}
                >
                  <Lock className="w-6 h-6" strokeWidth={2} />
                  <div className="text-center">
                    <span className="block font-semibold text-[15px] text-[var(--text)]">Private</span>
                    <span className="block text-[12px] mt-1 text-[var(--muted)]">Only invited members</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`flex-1 flex flex-col items-center gap-2 p-5 rounded-[16px] border-2 transition-all duration-250 ${
                    isPublic
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted)] text-[var(--muted-darker)]'
                  }`}
                >
                  <Globe className="w-6 h-6" strokeWidth={2} />
                  <div className="text-center">
                    <span className="block font-semibold text-[15px] text-[var(--text)]">Public</span>
                    <span className="block text-[12px] mt-1 text-[var(--muted)]">Anyone with the link</span>
                  </div>
                </button>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || loading}
                className="btn-primary min-w-[140px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Create board'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
