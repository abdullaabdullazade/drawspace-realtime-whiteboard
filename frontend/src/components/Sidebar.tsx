'use client';
import { motion } from 'framer-motion';
import {
  LayoutGrid, LayoutTemplate, Users2, Star,
  Archive, Trash2, Settings, ChevronsLeft, ChevronsRight,
  LogOut, Layers,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const NAV: NavItem[] = [
  { id: 'boards', label: 'All Boards', icon: LayoutGrid },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'shared', label: 'Shared with me', icon: Users2 },
  { id: 'favorites', label: 'Favorites', icon: Star },
];

const NAV_SECONDARY: NavItem[] = [
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

interface SidebarProps {
  active: string;
  onSelect: (id: string) => void;
  username: string;
  email: string;
  expanded: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

export default function Sidebar({ active, onSelect, username, email, expanded, onToggle, onLogout }: SidebarProps) {
  const initial = username.charAt(0).toUpperCase();
  const width = expanded ? 260 : 80;

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = active === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onSelect(item.id)}
        data-tooltip={expanded ? undefined : item.label}
        className={`group relative w-full flex items-center gap-3 h-[42px] rounded-[12px] transition-colors duration-150 ${
          expanded ? 'px-3' : 'px-0 justify-center tooltip'
        } ${
          isActive
            ? 'bg-[var(--accent-soft)] text-[var(--primary)]'
            : 'text-[var(--muted-darker)] hover:bg-[var(--hover)] hover:text-[var(--text)]'
        }`}
      >
        {/* Active left bar */}
        {isActive && expanded && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--primary)]" />
        )}
        <Icon
          className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)] group-hover:text-[var(--text)]'}`}
          strokeWidth={isActive ? 2 : 1.75}
        />
        {expanded && <span className="text-[14px] font-medium whitespace-nowrap">{item.label}</span>}
      </button>
    );
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) =>
    expanded ? (
      <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--text-3)] mb-2 px-3">{children}</p>
    ) : (
      <div className="h-4" />
    );

  return (
    <motion.aside
      initial={false}
      animate={{ width }}
      transition={{ type: 'spring', stiffness: 350, damping: 32 }}
      className="fixed left-4 top-4 bottom-4 z-50 flex flex-col bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] rounded-[24px] shadow-[var(--shadow-soft)] overflow-hidden"
    >
      {/* Header */}
      <div className={`h-16 shrink-0 flex items-center border-b border-[var(--border-light)] ${expanded ? 'px-5 justify-between' : 'px-0 justify-center'}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[11px] bg-[var(--primary-gradient)] flex items-center justify-center shrink-0 shadow-[var(--shadow-primary)]">
            <Layers className="w-[18px] h-[18px] text-white" strokeWidth={2} />
          </div>
          {expanded && <span className="text-[18px] font-bold tracking-tight text-[var(--text)] truncate">Drawspace</span>}
        </div>
        {expanded && (
          <button
            onClick={onToggle}
            className="w-8 h-8 flex items-center justify-center rounded-[10px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors shrink-0"
          >
            <ChevronsLeft className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Nav */}
      <div className={`flex-1 min-h-0 overflow-y-auto py-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${expanded ? 'px-4' : 'px-4'}`}>
        {!expanded && (
          <button onClick={onToggle} className="tooltip w-full h-[42px] flex items-center justify-center rounded-[12px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] transition-colors mb-4" data-tooltip="Expand">
            <ChevronsRight className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>
        )}

        <SectionLabel>Main</SectionLabel>
        <nav className="flex flex-col gap-1 mb-8">
          {NAV.map(renderItem)}
        </nav>

        <SectionLabel>Workspace</SectionLabel>
        <nav className="flex flex-col gap-1">
          {NAV_SECONDARY.map(renderItem)}
        </nav>
      </div>

      {/* Footer profile */}
      <div className="p-3 border-t border-[var(--border-light)]">
        {expanded ? (
          <div className="p-3 rounded-[16px] hover:bg-[var(--hover)] transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[15px] font-semibold text-[var(--primary)] shrink-0">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[var(--text)] truncate">{username}</p>
                <p className="text-[12px] text-[var(--muted)] truncate">{email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-light)]">
              <button className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[10px] hover:bg-[var(--card)] text-[13px] font-medium text-[var(--muted-darker)] hover:text-[var(--text)] transition-colors">
                <Settings className="w-4 h-4" strokeWidth={1.75} /> Settings
              </button>
              <button onClick={onLogout} className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-[10px] hover:bg-[rgba(239,68,68,0.06)] text-[13px] font-medium text-[var(--danger)] transition-colors">
                <LogOut className="w-4 h-4" strokeWidth={1.75} /> Logout
              </button>
            </div>
          </div>
        ) : (
          <button onClick={onLogout} className="tooltip w-full h-11 flex items-center justify-center rounded-[14px] bg-[var(--accent-soft)] text-[15px] font-semibold text-[var(--primary)]" data-tooltip={username}>
            {initial}
          </button>
        )}
      </div>
    </motion.aside>
  );
}
