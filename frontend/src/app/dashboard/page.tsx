'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Command, LayoutGrid, Star, PenTool, LayoutTemplate, Trash2, Bell, Users2, Globe, Lock, Sparkles, UserCheck, Clock, Box, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BoardCard from '@/components/BoardCard';
import CreateBoardModal from '@/components/CreateBoardModal';
import { Board, getBoards, createBoard, deleteBoard, updateBoard, getTrashedBoards, restoreBoard, permanentDeleteBoard } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

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

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [notifRead, setNotifRead] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [nav, setNav] = useState('boards');
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [trashed, setTrashed] = useState<Board[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    document.documentElement.classList.remove('dark');
    const saved = localStorage.getItem('sidebar-expanded');
    if (saved !== null) setExpanded(saved === 'true');
    try { setFavorites(JSON.parse(localStorage.getItem('favorites') || '[]')); } catch { /* ignore */ }
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('favorites', JSON.stringify(next));
      return next;
    });
  };

  const toggleSidebar = () => {
    setExpanded((e) => {
      const next = !e;
      localStorage.setItem('sidebar-expanded', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    getBoards().then(setBoards).catch(console.error).finally(() => setBoardsLoading(false));
  }, [user]);

  useEffect(() => {
    if (nav === 'trash' && user) getTrashedBoards().then(setTrashed).catch(console.error);
  }, [nav, user]);

  const handleRestore = async (id: string) => {
    setTrashed((prev) => prev.filter((b) => b.id !== id));
    try { await restoreBoard(id); const fresh = await getBoards(); setBoards(fresh); }
    catch (err) { console.error(err); }
  };

  const handlePermanentDelete = async (id: string) => {
    setTrashed((prev) => prev.filter((b) => b.id !== id));
    try { await permanentDeleteBoard(id); } catch (err) { console.error(err); }
  };

  const handleCreate = async (data: { name: string; description: string; isPublic: boolean }) => {
    try {
      const board = await createBoard(data.name, data.description, data.isPublic);
      setBoards((prev) => [board, ...prev]);
      setShowModal(false);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
    } catch (err) { console.error(err); }
  };

  const handleRename = async (id: string, name: string) => {
    setBoards((prev) => prev.map((b) => b.id === id ? { ...b, name } : b));
    try {
      await updateBoard(id, { name });
    } catch (err) { console.error(err); }
  };

  const filtered = boards.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  if (authLoading || !mounted) {
    return (
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-8 h-8 border-[3px] border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin" />
      </div>
    );
  }

  const userName = user?.username ?? 'there';
  const userEmail = user?.email ?? '';

  const renderContent = () => {
    if (nav === 'boards') {
      const publicCount = boards.filter(b => b.isPublic).length;
      const privateCount = boards.filter(b => !b.isPublic).length;

      const memberTotal = boards.reduce((sum, b) => sum + (b.memberCount ?? 0), 0);
      const STATS = [
        { label: 'Boards', value: boards.length, icon: LayoutGrid },
        { label: 'Collaborators', value: memberTotal, icon: Users2 },
        { label: 'Public', value: publicCount, icon: Globe },
        { label: 'Private', value: privateCount, icon: Lock },
      ];

      // Real activity: latest boards by creation time
      const activity = [...boards]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((b) => ({ Icon: Sparkles, title: 'Created board', board: b.name, time: timeAgo(b.createdAt, now) }));

      return (
        <div className="flex flex-col gap-12">

          {/* Header */}
          <div className="flex items-end justify-between">
            <div>
              <h1 className="h1-title text-[var(--text)]">Overview</h1>
              <p className="text-[15px] text-[var(--muted)] mt-2">Manage and organize your creative spaces.</p>
            </div>
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" strokeWidth={2.5} /> New Board
            </button>
          </div>

          {/* Stats — 4 cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card-premium card-lift p-6 rounded-[20px]">
                <div className="w-11 h-11 rounded-[14px] bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] mb-5">
                  <Icon className="w-[22px] h-[22px]" strokeWidth={1.75} />
                </div>
                <span className="block text-[32px] font-bold text-[var(--text)] leading-none">{value}</span>
                <span className="block text-[15px] font-medium text-[var(--muted)] mt-2">{label}</span>
              </div>
            ))}
          </div>

          {/* Recent Boards — full width */}
          <div>
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="h2-title text-[var(--text)]">Workspaces</h2>
                <p className="text-[14px] text-[var(--muted)] mt-1">Recently updated workspaces</p>
              </div>
              <span className="text-[14px] font-medium text-[var(--muted)]">{boards.length} total</span>
            </div>

            {boardsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-[240px] card-premium rounded-[24px] overflow-hidden">
                    <div className="h-[96px] skeleton" />
                    <div className="p-6 space-y-3">
                      <div className="h-5 skeleton w-2/3 rounded-[8px]" />
                      <div className="h-4 skeleton w-4/5 rounded-[6px]" />
                      <div className="h-4 skeleton w-1/2 rounded-[6px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="card-premium flex flex-col items-center justify-center py-24 text-center rounded-[24px] w-full">
                <div className="w-16 h-16 rounded-[20px] bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-6">
                  <PenTool className="w-8 h-8 text-[var(--primary)]" strokeWidth={1.5} />
                </div>
                <h3 className="h2-title text-[var(--text)] mb-3">{search ? 'No results found' : 'Create your first workspace'}</h3>
                <p className="body-text text-[var(--muted)] mb-8 max-w-md px-6">
                  {search ? `We couldn't find anything matching "${search}".` : 'Start a new canvas to bring your ideas to life and collaborate with your team.'}
                </p>
                {!search && (
                  <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
                    <Plus className="w-5 h-5" strokeWidth={2.5} /> Create Workspace
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map((board, i) => (
                  <motion.div key={board.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.05, ease: "easeOut" }}>
                    <BoardCard board={board} onDelete={handleDelete} onRename={handleRename} isFav={favorites.includes(board.id)} onToggleFav={toggleFavorite} now={now} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity — derived from real boards */}
          <div>
            <h2 className="h2-title text-[var(--text)] mb-6">Recent Activity</h2>
            {activity.length === 0 ? (
              <div className="card-premium rounded-[24px] flex flex-col items-center py-14 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-[var(--muted)]" strokeWidth={1.5} />
                </div>
                <p className="text-[15px] font-medium text-[var(--muted-darker)]">No activity yet</p>
                <p className="text-[13px] text-[var(--muted)] mt-1">Create a board to get started</p>
              </div>
            ) : (
              <div className="card-premium rounded-[24px] divide-y divide-[var(--border-light)]">
                {activity.map(({ Icon, title, board, time }, idx) => (
                  <div key={idx} className="flex items-center gap-4 px-6 py-5">
                    <div className="w-10 h-10 rounded-[12px] bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shrink-0">
                      <Icon className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <p className="text-[15px] font-medium text-[var(--text)] flex-1">
                      {title} <span className="text-[var(--primary)]">{board}</span>
                    </p>
                    <span className="text-[14px] text-[var(--muted)] shrink-0">{time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      );
    }

    if (nav === 'trash') {
      return (
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="h1-title text-[var(--text)]">Trash</h1>
            <p className="text-[15px] text-[var(--muted)] mt-2">Deleted boards. Restore them or delete forever.</p>
          </div>
          {trashed.length === 0 ? (
            <div className="card-premium flex flex-col items-center justify-center py-24 text-center rounded-[24px]">
              <div className="w-16 h-16 rounded-[20px] bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-6">
                <Trash2 className="w-8 h-8 text-[var(--muted)]" strokeWidth={1.5} />
              </div>
              <h3 className="h2-title text-[var(--text)] mb-2">Trash is empty</h3>
              <p className="body-text text-[var(--muted)] max-w-md">Deleted boards will appear here.</p>
            </div>
          ) : (
            <div className="card-premium rounded-[24px] divide-y divide-[var(--border-light)]">
              {trashed.map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-10 h-10 rounded-[12px] grad-primary flex items-center justify-center text-white shrink-0"><Box className="w-5 h-5" strokeWidth={1.75} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[var(--text)] truncate">{b.name}</p>
                    <p className="text-[13px] text-[var(--muted)] truncate">{b.description || 'No description'}</p>
                  </div>
                  <button onClick={() => handleRestore(b.id)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors">
                    <RotateCcw className="w-4 h-4" strokeWidth={2} /> Restore
                  </button>
                  <button onClick={() => handlePermanentDelete(b.id)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors">
                    <Trash2 className="w-4 h-4" strokeWidth={2} /> Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (nav === 'favorites') {
      const favBoards = boards.filter((b) => favorites.includes(b.id));
      return (
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="h1-title text-[var(--text)]">Favorites</h1>
            <p className="text-[15px] text-[var(--muted)] mt-2">Your starred boards for quick access.</p>
          </div>
          {favBoards.length === 0 ? (
            <div className="card-premium flex flex-col items-center justify-center py-24 text-center rounded-[24px]">
              <div className="w-16 h-16 rounded-[20px] bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-6">
                <Star className="w-8 h-8 text-[var(--warning)]" strokeWidth={1.5} />
              </div>
              <h3 className="h2-title text-[var(--text)] mb-2">No favorites yet</h3>
              <p className="body-text text-[var(--muted)] max-w-md">Tap the ⭐ on any board to add it here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {favBoards.map((board, i) => (
                <motion.div key={board.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.05 }}>
                  <BoardCard board={board} onDelete={handleDelete} onRename={handleRename} isFav onToggleFav={toggleFavorite} now={now} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      );
    }

    const placeholders: Record<string, { icon: React.ElementType, title: string, desc: string }> = {
      'templates': { icon: LayoutTemplate, title: 'Templates', desc: 'Jumpstart your work with premium templates.' },
      'shared': { icon: Users2, title: 'Shared with me', desc: 'Spaces shared with your account will appear here.' },
      'trash': { icon: Trash2, title: 'Trash', desc: 'Deleted boards stay here for 30 days.' }
    };

    const ph = placeholders[nav] || { icon: LayoutGrid, title: nav, desc: 'Coming soon.' };
    const Icon = ph.icon;

    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-20 h-20 rounded-[20px] bg-[var(--card)] border border-[var(--border)] shadow-[var(--shadow-soft)] flex items-center justify-center mb-6">
          <Icon className="w-10 h-10 text-[var(--muted)]" strokeWidth={1.5} />
        </div>
        <h3 className="h2-title text-[var(--text)] mb-3 capitalize">{ph.title}</h3>
        <p className="body-text text-[var(--muted)] max-w-md">
          {ph.desc}
        </p>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        active={nav}
        onSelect={setNav}
        username={userName}
        email={userEmail}
        expanded={expanded}
        onToggle={toggleSidebar}
        onLogout={() => { logout(); router.push('/login'); }}
      />

      <motion.div
        initial={false}
        animate={{ paddingLeft: expanded ? 292 : 112 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="flex-1 flex flex-col w-full min-h-screen relative z-10"
      >
        {/* Floating Top Navbar */}
        <div className="sticky top-4 z-40 px-6 sm:px-10 mb-8">
          <div className="h-[72px] max-w-[1600px] mx-auto bg-[var(--card)] rounded-[20px] shadow-[var(--shadow-md)] border border-[var(--border)] px-5 flex items-center justify-between">
            
            {/* Search Bar */}
            <div className="relative w-full max-w-[420px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--muted)]" strokeWidth={2} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search boards..."
                className="w-full h-[48px] bg-[var(--bg)] border border-[var(--border)] rounded-full pl-11 pr-16 text-[15px] font-medium text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-4 focus:ring-[rgba(31,164,99,0.12)] transition-all shadow-inner"
              />
              <kbd className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-[2px] px-2 py-1 rounded-[6px] bg-[var(--card)] border border-[var(--border)] text-[12px] font-semibold text-[var(--muted)] shadow-sm">
                <Command className="w-3 h-3" strokeWidth={2.5} />K
              </kbd>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">

              <div className="relative">
                <button onClick={() => setShowNotif((s) => !s)} className="w-[40px] h-[40px] flex items-center justify-center rounded-full text-[var(--muted-darker)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors relative">
                  <Bell className="w-5 h-5" strokeWidth={1.75} />
                  {!notifRead && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[var(--primary)] border-2 border-[var(--card)]"></span>}
                </button>
                <AnimatePresence>
                  {showNotif && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-3 w-80 bg-[var(--card)] border border-[var(--border)] rounded-[20px] shadow-[var(--shadow-md)] z-50 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-light)]">
                          <h4 className="text-[15px] font-semibold text-[var(--text)]">Notifications</h4>
                          <button onClick={() => setNotifRead(true)} className="text-[13px] font-medium text-[var(--primary)] hover:underline">Mark all read</button>
                        </div>
                        {notifRead ? (
                          <div className="px-5 py-10 flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center mb-3"><Bell className="w-6 h-6 text-[var(--muted)]" strokeWidth={1.5} /></div>
                            <p className="text-[14px] font-medium text-[var(--muted-darker)]">You&apos;re all caught up</p>
                          </div>
                        ) : (
                        <div className="divide-y divide-[var(--border-light)]">
                          {[
                            { icon: Sparkles, title: 'Workspace created', time: 'Just now' },
                            { icon: UserCheck, title: 'Welcome to Drawspace', time: '2 mins ago' },
                          ].map(({ icon: I, title, time }, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--hover)] transition-colors cursor-pointer">
                              <div className="w-9 h-9 rounded-[11px] bg-[var(--accent-soft)] flex items-center justify-center text-[var(--primary)] shrink-0"><I className="w-[18px] h-[18px]" strokeWidth={1.75} /></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-[var(--text)] truncate">{title}</p>
                                <p className="text-[12px] text-[var(--muted)]">{time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-[40px] h-[40px] ml-2 rounded-full grad-primary flex items-center justify-center text-[15px] font-bold text-white shadow-[var(--shadow-primary)] cursor-pointer">
                {userName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="px-6 sm:px-10 pb-12 w-full flex-1 max-w-[1600px]">
          {renderContent()}
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && <CreateBoardModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
      </AnimatePresence>
    </div>
  );
}
