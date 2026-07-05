'use client';
import { motion } from 'framer-motion';
import {
  LayoutGrid, Star,
  Trash2, ChevronsLeft, ChevronsRight,
  LogOut,
} from 'lucide-react';

// Custom Drawspace logo mark — pen stroke inside a rounded square
function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect x="5" y="5" width="22" height="22" rx="7" fill="white" fillOpacity="0.22" />
      <path d="M11 21.5 L19.5 9.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M18 8 L22 12 L20 14 L16 10 Z" fill="white" />
      <circle cx="11" cy="21.5" r="2" fill="white" />
    </svg>
  );
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

const NAV: NavItem[] = [
  { id: 'boards', label: 'All Boards', icon: LayoutGrid },
  { id: 'favorites', label: 'Favorites', icon: Star },
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
          <div className="w-9 h-9 rounded-[11px] grad-primary flex items-center justify-center shrink-0 shadow-[var(--shadow-primary)]">
            <LogoMark className="w-6 h-6" />
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

        <nav className="flex flex-col gap-1">
          {NAV.map(renderItem)}
        </nav>
      </div>

      {/* Footer profile */}
      <div className="p-3 border-t border-[var(--border-light)]">
        {expanded ? (
          <div className="flex items-center gap-3 p-2.5 rounded-[16px] border border-[var(--border)] bg-[var(--card)]">
            <div className="w-9 h-9 rounded-full grad-primary flex items-center justify-center text-[14px] font-semibold text-white shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[var(--text)] truncate">{username}</p>
              <p className="text-[12px] text-[var(--muted)] truncate">{email}</p>
            </div>
            <button onClick={onLogout} className="tooltip w-8 h-8 flex items-center justify-center rounded-[10px] text-[var(--muted)] hover:bg-[rgba(239,68,68,0.08)] hover:text-[var(--danger)] transition-colors shrink-0" data-tooltip="Logout">
              <LogOut className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <button onClick={onLogout} className="tooltip w-full h-11 flex items-center justify-center rounded-[14px] grad-primary text-[15px] font-semibold text-white" data-tooltip={`${username} — Logout`}>
            {initial}
          </button>
        )}
      </div>
    </motion.aside>
  );
}
