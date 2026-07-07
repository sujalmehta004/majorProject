'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Package, Truck, Receipt, LogOut,
  ShieldAlert, ChevronRight, Search, Settings, X,
  PanelLeftClose, PanelLeftOpen, Menu, Users, Briefcase, ClipboardList
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
    : ['Dashboard', 'Medicines', 'Orders', 'Billing', 'POS', 'Profile', 'Logs', 'Customers', 'Suppliers'];

  const groupedNavItems = [
    {
      category: 'Operations',
      items: [
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
          name: 'POS B2C',
          href: '/wholesaler/pos',
          icon: Receipt,
          desc: 'Manual bill for physical customer',
          feature: 'POS',
          tags: 'cash, pos, point of sale, checkout, manual, walkin',
        },
      ]
    },
    {
      category: 'B2B & Distribution',
      items: [
        {
          name: 'Orders',
          href: '/wholesaler/orders',
          icon: Truck,
          desc: 'Create and dispatch B2B orders',
          feature: 'Orders',
          tags: 'sell, dispatch, buy, sales, retailer, pending',
        },
        {
          name: 'Customers',
          href: '/wholesaler/customers',
          icon: Users,
          desc: 'Retailer accounts and transaction histories',
          feature: 'Customers',
          tags: 'retailer, customer, history, transactions, accounts',
        },
        {
          name: 'Suppliers',
          href: '/wholesaler/suppliers',
          icon: Briefcase,
          desc: 'Manufacturer and supplier bills and shipments',
          feature: 'Suppliers',
          tags: 'vendor, manufacturer, supplier, bills, settlements',
        },
        {
          name: 'Billing',
          href: '/wholesaler/billing',
          icon: Receipt,
          desc: 'Invoices, margins and payment tracking',
          feature: 'Billing',
          tags: 'money, revenue, statement, invoice, profit, margins',
        },
      ]
    }
  ];

  const searchablePages = [
    ...groupedNavItems.flatMap(g => g.items),
    {
      name: 'Settings',
      href: '/wholesaler/settings',
      icon: Settings,
      desc: 'Profile, staff roster, logs and preferences',
      feature: 'Settings',
      tags: 'profile, staff, team, logs, audit, security, settings',
    },
    {
      name: 'Activity Log',
      href: '/wholesaler/settings?tab=logs',
      icon: ClipboardList,
      desc: 'Audit trail of all system events and actions',
      feature: 'Logs',
      tags: 'activity log, audit, logs, history, events, actions, trail',
    },
  ];

  let currentFeature = '';
  if (pathname === '/wholesaler/dashboard') currentFeature = 'Dashboard';
  else if (pathname === '/wholesaler/inventory') currentFeature = 'Medicines';
  else if (pathname === '/wholesaler/orders') currentFeature = 'Orders';
  else if (pathname === '/wholesaler/customers') currentFeature = 'Customers';
  else if (pathname === '/wholesaler/suppliers') currentFeature = 'Suppliers';
  else if (pathname === '/wholesaler/billing') currentFeature = 'Billing';
  else if (pathname === '/wholesaler/pos') currentFeature = 'POS';

  const isDenied =
    user.role === 'WHOLESALER_STAFF' &&
    currentFeature &&
    !allowedList.includes(currentFeature);

  const isSettingsAllowed =
    user.role === 'WHOLESALER' ||
    allowedList.includes('Profile') ||
    allowedList.includes('Logs');

  const filteredGroups = groupedNavItems.map(group => {
    const items = group.items.filter(item => {
      if (user.role === 'WHOLESALER') return true;
      if (item.feature && !allowedList.includes(item.feature)) return false;
      return true;
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  const [searchResults, setSearchResults] = useState<{
    pages: Array<any>;
    medicines: Array<any>;
    transactions: Array<any>;
    customers: Array<any>;
  }>({ pages: [], medicines: [], transactions: [], customers: [] });

  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Flattened results helper for keyboard navigation
  const flatResults: Array<{
    type: 'page' | 'medicine' | 'transaction' | 'customer';
    title: string;
    subtitle: string;
    url: string;
    icon: any;
  }> = [];

  searchResults.pages.forEach(p => {
    flatResults.push({ type: 'page', title: p.name, subtitle: p.desc, url: p.href, icon: p.icon });
  });
  searchResults.medicines.forEach(m => {
    flatResults.push({ type: 'medicine', title: m.name, subtitle: `SKU: ${m.sku}`, url: `/wholesaler/inventory`, icon: Package });
  });
  searchResults.transactions.forEach(t => {
    flatResults.push({
      type: 'transaction',
      title: `INV-${t.id.substring(0, 8).toUpperCase()}`,
      subtitle: `Rs. ${t.netAmount?.toLocaleString()} · ${t.retailer?.pharmacyName || 'Walk-in'} · ${new Date(t.createdAt).toLocaleDateString()}`,
      url: `/wholesaler/billing?invoiceId=${t.id}`,
      icon: Receipt
    });
  });
  searchResults.customers.forEach(c => {
    flatResults.push({
      type: 'customer',
      title: c.pharmacyName,
      subtitle: `Phone: ${c.phone || 'N/A'} | Email: ${c.user?.email || 'N/A'}`,
      url: `/wholesaler/customers?search=${encodeURIComponent(c.pharmacyName)}`,
      icon: Users
    });
  });
  (searchResults as any).suppliers?.forEach((s: any) => {
    flatResults.push({
      type: 'customer' as any,
      title: s.name,
      subtitle: `Supplier · ${s.contactPerson || s.email || s.phone || 'No contact'}`,
      url: `/wholesaler/suppliers?search=${encodeURIComponent(s.name)}`,
      icon: Briefcase
    });
  });

  useEffect(() => {
    setMounted(true);
    const savedCollapsed = localStorage.getItem('sidebar_collapsed');
    if (savedCollapsed === 'true') setCollapsed(true);
    
    // Set theme on mount
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    // Set font scale on mount
    const savedFontScale = localStorage.getItem('font_scale') || 'md';
    document.body.classList.remove('font-xs', 'font-sm', 'font-md', 'font-lg', 'font-xl');
    document.body.classList.add(`font-${savedFontScale}`);

    // Restore fullscreen if it was active before navigation
    const wantsFullscreen = localStorage.getItem('app_fullscreen') === 'true';
    if (wantsFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    
    logActivity('VIEW_PAGE', `Opened page: ${pathname}`);
  }, [pathname]);

  // Handle global keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem('sidebar_collapsed', String(next));
          return next;
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'f') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          localStorage.setItem('app_fullscreen', 'true');
        } else {
          document.exitFullscreen().catch(() => {});
          localStorage.setItem('app_fullscreen', 'false');
        }
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
      }

      if (showSearch && flatResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % flatResults.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const target = flatResults[activeIndex];
          if (target) {
            setShowSearch(false);
            setSearchQuery('');
            logActivity('COMMAND_PALETTE', `Jumped to ${target.title}`);
            router.push(target.url);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, flatResults, activeIndex, router]);

  // Sync fullscreen: if user exits via Esc or browser chrome, clear the preference
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        localStorage.setItem('app_fullscreen', 'false');
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Load live DB results dynamically on query change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ pages: [], medicines: [], transactions: [], customers: [] });
      setActiveIndex(0);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const q = searchQuery.toLowerCase();
        const matchedPages = searchablePages.filter((item) => {
          if (user.role === 'WHOLESALER_STAFF') {
            if (item.name === 'Settings' && !(allowedList.includes('Profile') || allowedList.includes('Logs'))) return false;
            if (item.feature && !allowedList.includes(item.feature)) return false;
          }
          return (
            item.name.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            item.tags.toLowerCase().includes(q)
          );
        });

        const res = await fetch(`/api/wholesaler/search?q=${encodeURIComponent(searchQuery)}&wholesalerId=${profile.id}`);
        const data = await res.json();
        
        setSearchResults({
          pages: matchedPages,
          medicines: data.medicines || [],
          transactions: data.transactions || [],
          customers: data.customers || [],
        });
        setActiveIndex(0);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSearch(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

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

  // Real-time search state is managed above dynamically via SWR and API routes.

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
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
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
                  <span style={{ color: '#FFFFFF' }}>Med</span><span style={{ color: '#3B82F6' }}>Hub</span>
                </div>
                <div className="sidebar-logo-company" style={{ color: '#9CA3AF' }}>{profile.companyName}</div>
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
                borderRadius: 6,
                border: '1px solid #374151',
                background: '#1F2937',
                color: '#9CA3AF',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#4B5563';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#374151';
                e.currentTarget.style.color = '#9CA3AF';
              }}
            >
              <Search style={{ width: 13, height: 13 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
              <kbd
                style={{
                  fontSize: 9,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  background: '#374151',
                  border: '1px solid #4B5563',
                  borderRadius: 4,
                  padding: '1px 5px',
                  color: '#FFFFFF',
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
          {filteredGroups.map((group) => (
            <div key={group.category} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!collapsed && (
                <div style={{
                  fontSize: 9, fontWeight: 950, textTransform: 'uppercase', color: '#6B7280',
                  padding: '0 20px', marginBottom: 4, letterSpacing: '0.05em'
                }}>
                  {group.category}
                </div>
              )}
              {group.items.map((item) => {
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
            </div>
          ))}
        </nav>

        {/* Bottom: user + settings + logout */}
        <div className="sidebar-bottom">
          {/* Settings link relocated here */}
          {isSettingsAllowed && (
            <Link
              href="/wholesaler/settings"
              className={`sidebar-nav-item ${pathname === '/wholesaler/settings' ? 'active' : ''}`}
              style={{
                marginBottom: 12,
                borderRadius: 6,
              }}
              data-label="Settings"
              onClick={() => logActivity('NAVIGATE', 'Clicked: Settings')}
            >
              <Settings className="nav-icon" />
              <span className="sidebar-nav-label">Settings</span>
            </Link>
          )}

          {/* Node badge */}
          {!collapsed && (
            <div
              style={{
                padding: '6px 10px',
                margin: '0 0 8px',
                background: '#1F2937',
                borderRadius: 6,
                border: '1px solid #374151',
                fontSize: 12,
                fontWeight: 700,
                color: '#9CA3AF',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
              }}
            >
              NODE: {profile.id.substring(0, 8).toUpperCase()}
            </div>
          )}

          <div className="sidebar-user" data-label={user.fullName || user.email.split('@')[0]}>
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
        <div className="animate-fadeIn" style={{ width: '100%' }}>
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
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                Access Restricted
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.6 }}>
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
              maxWidth: 540,
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
            {/* Theme & Font controls inside Search Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px', gap: 10 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('theme', 'light');
                    document.body.classList.remove('dark-mode');
                  }}
                  style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, border: '1px solid #CBD5E1', cursor: 'pointer', background: '#fff' }}
                >
                  ☀️ Light
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('theme', 'dark');
                    document.body.classList.add('dark-mode');
                  }}
                  style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, border: '1px solid #CBD5E1', cursor: 'pointer', background: '#0F172A', color: '#fff' }}
                >
                  🌙 Dark
                </button>
              </div>

              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Scale:</span>
                {([
                  { k: 'xs', l: 'XS' },
                  { k: 'sm', l: 'S' },
                  { k: 'md', l: 'M' },
                  { k: 'lg', l: 'L' },
                  { k: 'xl', l: 'XL' }
                ] as const).map(item => (
                  <button
                    key={item.k}
                    type="button"
                    onClick={() => {
                      localStorage.setItem('font_scale', item.k);
                      document.body.classList.remove('font-xs', 'font-sm', 'font-md', 'font-lg', 'font-xl');
                      document.body.classList.add(`font-${item.k}`);
                    }}
                    style={{ padding: '3px 6px', fontSize: 10, fontWeight: 700, borderRadius: 4, border: '1px solid #CBD5E1', cursor: 'pointer', background: '#fff' }}
                  >
                    {item.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="search-bar">
              <Search style={{ width: 16, height: 16, color: '#0EA5E9', flexShrink: 0 }} />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search medicines, orders, customers, pages..."
              />
              {loadingSearch && (
                <div style={{ width: 14, height: 14, border: '2px solid #0EA5E9', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginRight: 8 }} />
              )}
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                style={{
                  fontSize: 12,
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
            <div style={{ maxHeight: 350, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchQuery === '' ? (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Quick Jump
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {['pos', 'medicines', 'customers', 'settings', 'billing', 'orders'].map((tag) => (
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
              ) : flatResults.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
                  No results for &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Categorized Visual Results */}
                  {['page', 'medicine', 'transaction', 'customer'].map((groupType) => {
                    const groupItems = flatResults.filter(item => item.type === groupType);
                    if (groupItems.length === 0) return null;

                    return (
                      <div key={groupType} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.07em', paddingLeft: 6, marginBottom: 2 }}>
                          {groupType === 'page' ? 'Navigation Pages' : groupType === 'medicine' ? 'Inventory Products' : groupType === 'transaction' ? 'Ledger Invoices' : 'Retailer Customers'}
                        </div>
                        {groupItems.map((item) => {
                          const originalFlatIndex = flatResults.findIndex(f => f.url === item.url && f.title === item.title);
                          const isHighlighted = activeIndex === originalFlatIndex;
                          const Icon = item.icon;

                          return (
                            <button
                              key={item.url + item.title}
                              onClick={() => {
                                setShowSearch(false);
                                setSearchQuery('');
                                logActivity('COMMAND_PALETTE', `Jumped to ${item.title}`);
                                router.push(item.url);
                              }}
                              onMouseEnter={() => setActiveIndex(originalFlatIndex)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '8px 10px',
                                borderRadius: 10,
                                border: '1.5px solid transparent',
                                background: isHighlighted ? 'rgba(14,165,233,0.08)' : 'transparent',
                                borderColor: isHighlighted ? '#BAE6FD' : 'transparent',
                                cursor: 'pointer',
                                textAlign: 'left',
                                width: '100%',
                                transition: 'all 0.15s',
                                fontFamily: 'inherit',
                              }}
                            >
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  background: isHighlighted ? '#E0F2FE' : '#F8FAFC',
                                  border: '1px solid var(--card-border)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <Icon style={{ width: 15, height: 15, color: '#0EA5E9' }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtitle}</div>
                              </div>
                              <ChevronRight style={{ width: 14, height: 14, color: isHighlighted ? '#0EA5E9' : '#E2E8F0', flexShrink: 0 }} />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
