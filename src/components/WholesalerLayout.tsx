'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Truck, Receipt, LogOut,
  ShieldAlert, ChevronRight, Search, Settings, X,
  PanelLeftClose, PanelLeftOpen, Menu
} from 'lucide-react';

interface WholesalerLayoutProps {
  children: React.ReactNode;
  user: {
    userId: string;
    email: string;
    role: string;
    fullName?: string | null;
    allowedFeatures?: string;
  };
  profile: {
    id: string;
    companyName: string;
    taxId: string;
  };
}

export async function logActivity(action: string, details: string) {
  try {
    await fetch('/api/wholesaler/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details }),
    });
  } catch (err) {
    console.error('Failed to log audit activity:', err);
  }
}

export default function WholesalerLayout({ children, user, profile }: WholesalerLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const allowedList = user.allowedFeatures
    ? user.allowedFeatures.split(',')
    : ['Dashboard', 'Medicines', 'Orders', 'Billing', 'POS', 'Profile', 'Logs'];

  const navItems = [
    {
      name: 'Dashboard',
      href: '/wholesaler/dashboard',
      icon: LayoutDashboard,
      desc: 'Overview stats and widgets',
      feature: 'Dashboard',
      tags: 'home, main, analytics, widgets, stats',
    },
    {
      name: 'Medicines',
      href: '/wholesaler/inventory',
      icon: Package,
      desc: 'Product catalog, batches and barcodes',
      feature: 'Medicines',
      tags: 'stock, batch, add, medicines, inventory, barcode, print',
    },
    {
      name: 'Orders',
      href: '/wholesaler/orders',
      icon: Truck,
      desc: 'Create and dispatch B2B orders',
      feature: 'Orders',
      tags: 'sell, dispatch, buy, sales, retailer, pending',
    },
    {
      name: 'POS B2C',
      href: '/wholesaler/pos',
      icon: Receipt,
      desc: 'Manual bill for physical customer',
      feature: 'POS',
      tags: 'cash, pos, point of sale, checkout, manual, walkin',
    },
    {
      name: 'Billing',
      href: '/wholesaler/billing',
      icon: Receipt,
      desc: 'Invoices, margins and payment tracking',
      feature: 'Billing',
      tags: 'money, revenue, statement, invoice, profit, margins',
    },
    {
      name: 'Settings',
      href: '/wholesaler/settings',
      icon: Settings,
      desc: 'Profile, staff roster, logs and preferences',
      tags: 'profile, staff, team, logs, audit, security, settings',
    },
  ];

  let currentFeature = '';
  if (pathname === '/wholesaler/dashboard') currentFeature = 'Dashboard';
  else if (pathname === '/wholesaler/inventory') currentFeature = 'Medicines';
  else if (pathname === '/wholesaler/orders') currentFeature = 'Orders';
  else if (pathname === '/wholesaler/billing') currentFeature = 'Billing';
  else if (pathname === '/wholesaler/pos') currentFeature = 'POS';

  const isDenied =
    user.role === 'WHOLESALER_STAFF' &&
    currentFeature &&
    !allowedList.includes(currentFeature);

  useEffect(() => {
    setMounted(true);
    const savedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (savedCollapsed === 'true') setCollapsed(true);
    logActivity('VIEW_PAGE', `Opened page: ${pathname}`);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pathname]);

  useEffect(() => {
    if (!mounted) return;
    let timeoutVal = '60';
    if (typeof window !== 'undefined') {
      timeoutVal = localStorage.getItem('wholesaler_inactivity_timeout') || '60';
    }
    if (timeoutVal === 'never') return;

    const timeoutLimit = parseFloat(timeoutVal) * 60 * 1000;
    let lastActivity = Date.now();
    const resetTimer = () => { lastActivity = Date.now(); };
    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'click', 'touchstart'];
    events.forEach((event) => document.addEventListener(event, resetTimer, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivity >= timeoutLimit) {
        clearInterval(interval);
        logActivity('AUTO_LOGOUT', `Session terminated after ${timeoutVal} min of inactivity.`);
        window.location.href = '/api/auth/logout';
      }
    }, 5000);

    return () => {
      events.forEach((event) => document.removeEventListener(event, resetTimer));
      clearInterval(interval);
    };
  }, [mounted]);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    await logActivity('LOGOUT', 'User logged out.');
    window.location.href = '/api/auth/logout';
  };

  const visibleNavItems = navItems.filter((item) => {
    if (user.role === 'WHOLESALER_STAFF') {
      if (item.name === 'Settings')
        return allowedList.includes('Profile') || allowedList.includes('Logs');
      if (item.feature && !allowedList.includes(item.feature)) return false;
    }
    return true;
  });

  const searchResults = searchQuery
    ? navItems.filter((item) => {
        if (user.role === 'WHOLESALER_STAFF') {
          if (
            item.name === 'Settings' &&
            !(allowedList.includes('Profile') || allowedList.includes('Logs'))
          )
            return false;
          if (item.feature && !allowedList.includes(item.feature)) return false;
        }
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          item.tags.toLowerCase().includes(q)
        );
      })
    : [];

  if (!mounted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #EBF8FF 0%, #FCE7F3 30%, #FFF7ED 60%, #ECFDF5 100%)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '3px solid #0EA5E9',
              borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
            Loading workspace…
          </span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const userInitials = user.fullName
    ? user.fullName.substring(0, 2).toUpperCase()
    : user.email.substring(0, 2).toUpperCase();

  return (
    <div className="app-shell no-print">
      {/* ═══ SIDEBAR ═══ */}
      <aside className={`sidebar no-print ${collapsed ? 'collapsed' : ''}`}>
        {/* Header: Logo + Toggle */}
        <div className={`sidebar-header ${collapsed ? 'justify-center px-2 py-4' : ''}`}>
          {!collapsed && (
            <Link
              href="/"
              className="sidebar-logo"
              onClick={() => logActivity('CLICK_LOGO', 'Clicked brand logo')}
            >
              <div className="sidebar-logo-icon">M</div>
              <div className="sidebar-logo-text">
                <div className="sidebar-logo-name">
                  Med<span style={{ color: '#0EA5E9' }}>Hub</span>
                </div>
                <div className="sidebar-logo-company">{profile.companyName}</div>
              </div>
            </Link>
          )}
          <button
            className="sidebar-toggle"
            onClick={toggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar"
            style={collapsed ? { margin: '0 auto' } : {}}
          >
            {collapsed ? (
              <PanelLeftOpen style={{ width: 14, height: 14 }} />
            ) : (
              <PanelLeftClose style={{ width: 14, height: 14 }} />
            )}
          </button>
        </div>

        {/* Search trigger */}
        {!collapsed && (
          <div style={{ padding: '10px 12px 0' }}>
            <button
              onClick={() => setShowSearch(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1.5px solid #E0F2FE',
                background: 'rgba(255,255,255,0.7)',
                color: '#94A3B8',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0EA5E9';
                e.currentTarget.style.color = '#0EA5E9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#E0F2FE';
                e.currentTarget.style.color = '#94A3B8';
              }}
            >
              <Search style={{ width: 13, height: 13 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
              <kbd
                style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  background: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  borderRadius: 4,
                  padding: '1px 5px',
                  color: '#0EA5E9',
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                data-label={item.name}
                onClick={() => logActivity('NAVIGATE', `Clicked: ${item.name}`)}
              >
                <Icon className="nav-icon" />
                <span className="sidebar-nav-label">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: user + logout */}
        <div className="sidebar-bottom">
          {/* Node badge */}
          {!collapsed && (
            <div
              style={{
                padding: '6px 10px',
                margin: '0 0 8px',
                background: 'rgba(224,242,254,0.5)',
                borderRadius: 8,
                border: '1px solid #BAE6FD',
                fontSize: 10,
                fontWeight: 700,
                color: '#0284C7',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
              }}
            >
              NODE: {profile.id.substring(0, 8).toUpperCase()}
            </div>
          )}

          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {user.fullName || user.email.split('@')[0]}
              </div>
              <div className="sidebar-user-role">
                {user.role === 'WHOLESALER' ? 'Owner' : 'Staff'}
              </div>
            </div>
          </div>

          <form onSubmit={handleLogout}>
            <button type="submit" className="sidebar-logout" data-label="Sign Out">
              <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span className="sidebar-nav-label">Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ═══ MAIN CONTENT ═══ */}
      <main className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="animate-fadeIn" style={{ maxWidth: 1400 }}>
          {isDenied ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                textAlign: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: 'rgba(249,115,22,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldAlert style={{ width: 28, height: 28, color: '#F97316' }} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1E293B' }}>
                Access Restricted
              </h2>
              <p style={{ fontSize: 14, color: '#475569', maxWidth: 360, lineHeight: 1.6 }}>
                Your credentials do not allow access to{' '}
                <strong>{currentFeature}</strong>. Contact the account owner.
              </p>
              <Link href="/wholesaler/dashboard" className="btn-primary" style={{ marginTop: 8 }}>
                Back to Dashboard
              </Link>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* ═══ COMMAND PALETTE ═══ */}
      {showSearch && (
        <div
          className="no-print animate-fadeIn"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(15,23,42,0.2)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '14vh',
            padding: '14vh 24px 24px',
          }}
          onClick={() => { setShowSearch(false); setSearchQuery(''); }}
        >
          <div
            className="animate-scaleIn"
            style={{
              width: '100%',
              maxWidth: 520,
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(24px)',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 20px 60px rgba(14,165,233,0.15), 0 0 0 1px rgba(186,230,253,0.5)',
              border: '1.5px solid #BAE6FD',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="search-bar">
              <Search style={{ width: 16, height: 16, color: '#0EA5E9', flexShrink: 0 }} />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search features (e.g. pos, billing, staff)…"
              />
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: '#F0F9FF',
                  border: '1px solid #BAE6FD',
                  color: '#0EA5E9',
                  borderRadius: 6,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontFamily: 'inherit',
                }}
              >
                Esc
              </button>
            </div>

            {/* Results */}
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {searchQuery === '' ? (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Quick Jump
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {['pos', 'medicines', 'settings', 'billing', 'orders'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSearchQuery(tag)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #BAE6FD',
                          background: '#F0F9FF',
                          color: '#0284C7',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>
                  No results for &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                searchResults.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={() => {
                        setShowSearch(false);
                        setSearchQuery('');
                        logActivity('COMMAND_PALETTE', `Jumped to ${item.name}`);
                        router.push(item.href);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1.5px solid transparent',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'all 0.15s',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(186,230,253,0.25)';
                        e.currentTarget.style.borderColor = '#BAE6FD';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: '#F0F9FF',
                          border: '1px solid #BAE6FD',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Icon style={{ width: 16, height: 16, color: '#0EA5E9' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.desc}</div>
                      </div>
                      <ChevronRight style={{ width: 14, height: 14, color: '#BAE6FD', flexShrink: 0 }} />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
