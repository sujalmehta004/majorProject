import React from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  feature?: string;
}

interface SidebarProps {
  user: {
    role: string;
    allowedFeatures?: string;
    fullName?: string | null;
    email: string;
  };
  profile: {
    companyName: string;
  };
  visibleNavItems: NavItem[];
  pathname: string;
  logActivity: (action: string, details: string) => void;
}

export default function Sidebar({ user, profile, visibleNavItems, pathname, logActivity }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col" aria-label="Sidebar navigation">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2" onClick={() => logActivity('CLICK_LOGO', 'Clicked brand logo')}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg tracking-widest" style={{ background: '#1A1A1A', color: '#FFC043' }}>M</div>
          <div>
            <span className="font-black tracking-widest uppercase text-sm" style={{ color: '#1A1A1A' }}>Med<span style={{ color: '#FFC043' }}>Hub</span></span>
            <div className="text-[10px] font-semibold text-gray-400 truncate max-w-[150px]">{profile.companyName}</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
        {visibleNavItems.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => logActivity('NAVIGATE', `Clicked menu link: ${item.name}`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              style={isActive ? { background: '#1A1A1A', color: '#FFFFFF' } : { color: '#475569' }}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 p-4">
        <form method="post" action="/api/auth/logout" onSubmit={e => { e.preventDefault(); logActivity('LOGOUT', 'User logged out'); window.location.href = '/api/auth/logout'; }}>
          <button type="submit" className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md hover:bg-gray-50" style={{ color: '#94A3B8', border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
