'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Command, LayoutGrid, Star, PenTool, LayoutTemplate, Archive, Trash2, Bell, UserPlus, Users2, Globe, Lock, Sparkles, UserCheck, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import BoardCard from '@/components/BoardCard';
import CreateBoardModal from '@/components/CreateBoardModal';
import { Board, getBoards, createBoard, deleteBoard, updateBoard } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [nav, setNav] = useState('boards');
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    document.documentElement.classList.remove('dark');
    // Restore sidebar state so it doesn't reset on navigation
    const saved = localStorage.getItem('sidebar-expanded');
    if (saved !== null) setExpanded(saved === 'true');
  }, []);

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
                    <BoardCard board={board} onDelete={handleDelete} onRename={handleRename} now={now} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity — full width bottom */}
          <div>
            <h2 className="h2-title text-[var(--text)] mb-6">Recent Activity</h2>
            <div className="card-premium rounded-[24px] divide-y divide-[var(--border-light)]">
              {[
                { icon: Sparkles, title: 'Workspace created', time: 'Just now' },
                { icon: UserCheck, title: 'You logged in', time: '2 mins ago' },
                { icon: Clock, title: 'Board updated', time: '5 mins ago' },
              ].map(({ icon: Icon, title, time }, idx) => (
                <div key={idx} className="flex items-center gap-4 px-6 py-5">
                  <div className="w-10 h-10 rounded-[12px] bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shrink-0">
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <p className="text-[15px] font-medium text-[var(--text)] flex-1">{title}</p>
                  <span className="text-[14px] text-[var(--muted)]">{time}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      );
    }

    const placeholders: Record<string, { icon: React.ElementType, title: string, desc: string }> = {
      'templates': { icon: LayoutTemplate, title: 'Templates', desc: 'Jumpstart your work with premium templates.' },
      'shared': { icon: Users2, title: 'Shared with me', desc: 'Spaces shared with your account will appear here.' },
      'favorites': { icon: Star, title: 'Favorites', desc: 'Access your most important spaces instantly.' },
      'archive': { icon: Archive, title: 'Archive', desc: 'Past projects stored safely.' },
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
          <div className="h-[76px] bg-[var(--card)]/80 backdrop-blur-[24px] rounded-[20px] shadow-[var(--shadow-soft)] border border-[var(--border)] px-6 flex items-center justify-between">
            
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
              <button className="h-[40px] px-4 rounded-[12px] bg-[var(--bg)] border border-[var(--border)] text-[14px] font-medium text-[var(--text)] hover:bg-[var(--card)] transition-colors flex items-center gap-2 shadow-sm hidden md:flex">
                <UserPlus className="w-4 h-4" /> Invite
              </button>
              
              <div className="w-px h-6 bg-[var(--border)] mx-2 hidden sm:block"></div>

              <div className="relative">
                <button onClick={() => setShowNotif((s) => !s)} className="w-[40px] h-[40px] flex items-center justify-center rounded-full text-[var(--muted-darker)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors relative">
                  <Bell className="w-5 h-5" strokeWidth={1.75} />
                  <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[var(--primary)] border-2 border-[var(--card)]"></span>
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
                          <span className="text-[13px] font-medium text-[var(--primary)] cursor-pointer">Mark all read</span>
                        </div>
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
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-[40px] h-[40px] ml-2 rounded-full bg-[var(--primary-gradient)] flex items-center justify-center text-[15px] font-bold text-white shadow-[var(--shadow-primary)] cursor-pointer">
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
