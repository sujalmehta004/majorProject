'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Boxes, ClipboardList, Briefcase, Calculator, TrendingUp, LogOut,
  ChevronRight, Search, Settings, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: any;
  desc: string;
  tags: string;
}

interface RetailerLayoutProps {
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
    pharmacyName: string;
    registrationNumber: string;
  };
}

export async function logActivity(action: string, details: string) {
  try {
    await fetch('/api/retailer/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details }),
    });
  } catch (err) {
    console.error('Failed to log audit activity:', err);
  }
}

export default function RetailerLayout({ children, user, profile }: RetailerLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    pages: any[];
    medicines: any[];
    transactions: any[];
    suppliers: any[];
  }>({ pages: [], medicines: [], transactions: [], suppliers: [] });
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/retailer/dashboard',
      icon: Home,
      desc: 'Overview stats and widgets',
      tags: 'home, main, analytics, widgets, stats',
    },
    {
      name: 'Inventory',
      href: '/retailer/inventory',
      icon: Boxes,
      desc: 'View and manage retail stock',
      tags: 'stock, batch, medicines, inventory',
    },
    {
      name: 'Orders',
      href: '/retailer/orders',
      icon: ClipboardList,
      desc: 'Order history and tracking',
      tags: 'buy, order, wholesaler, pending, track',
    },
    {
      name: 'Suppliers',
      href: '/retailer/suppliers',
      icon: Briefcase,
      desc: 'Wholesaler catalog & ordering',
      tags: 'wholesaler, supplier, order, catalog',
    },
    {
      name: 'POS Billing',
      href: '/retailer/pos',
      icon: Calculator,
      desc: 'Sell to physical customer',
      tags: 'cash, pos, point of sale, checkout, manual, walkin',
    },
    {
      name: 'Billing History',
      href: '/retailer/billing',
      icon: TrendingUp,
      desc: 'Sales history, margins and billing',
      tags: 'money, revenue, statement, invoice, profit, margins',
    },
  ];

  const groupedNavItems = [
    {
      category: 'Store Operations',
      items: [
        {
          name: 'Dashboard',
          href: '/retailer/dashboard',
          icon: Home,
          desc: 'Overview stats and widgets',
          tags: 'home, main, analytics, widgets, stats',
        },
        {
          name: 'Inventory',
          href: '/retailer/inventory',
          icon: Boxes,
          desc: 'View and manage retail stock',
          tags: 'stock, batch, medicines, inventory',
        },
        {
          name: 'POS Billing',
          href: '/retailer/pos',
          icon: Calculator,
          desc: 'Sell to physical customer',
          tags: 'cash, pos, point of sale, checkout, manual, walkin',
        },
      ]
    },
    {
      category: 'B2B & Accounting',
      items: [
        {
          name: 'Orders',
          href: '/retailer/orders',
          icon: ClipboardList,
          desc: 'Order history and tracking',
          tags: 'buy, order, wholesaler, pending, track',
        },
        {
          name: 'Suppliers',
          href: '/retailer/suppliers',
          icon: Briefcase,
          desc: 'Wholesaler catalog & ordering',
          tags: 'wholesaler, supplier, order, catalog',
        },
        {
          name: 'Billing History',
          href: '/retailer/billing',
          icon: TrendingUp,
          desc: 'Sales history, margins and billing',
          tags: 'money, revenue, statement, invoice, profit, margins',
        },
      ]
    }
  ];

  const allowedList = user.allowedFeatures
    ? user.allowedFeatures.split(',').map(f => f.trim())
    : ['Dashboard', 'Inventory', 'Orders', 'Suppliers', 'POS', 'Billing', 'Settings'];

  const filteredNavItems = navItems.filter(item => {
    if (user.role === 'RETAILER') return true;
    return allowedList.includes(item.name);
  });

  const filteredGroups = groupedNavItems.map(group => {
    const items = group.items.filter(item => {
      if (user.role === 'RETAILER') return true;
      return allowedList.includes(item.name);
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  const isSettingsAllowed = user.role === 'RETAILER' || allowedList.includes('Settings');

  const flatResults: any[] = [];
  searchResults.pages.forEach(p => {
    flatResults.push({ type: 'page', title: p.name, subtitle: p.desc, url: p.href, icon: p.icon });
  });
  searchResults.medicines.forEach(m => {
    flatResults.push({ type: 'medicine', title: m.name, subtitle: `SKU: ${m.sku}`, url: `/retailer/inventory?search=${encodeURIComponent(m.sku || m.name)}`, icon: Boxes });
  });
  searchResults.transactions.forEach(t => {
    flatResults.push({ type: 'transaction', title: `Invoice: ${t.id.substring(0, 8).toUpperCase()}`, subtitle: `Amt: Rs. ${t.netAmount.toLocaleString()}`, url: `/retailer/billing?search=${encodeURIComponent(t.id)}`, icon: Calculator });
  });
  searchResults.suppliers.forEach(s => {
    flatResults.push({ type: 'supplier', title: s.companyName, subtitle: `Phone: ${s.phone}`, url: `/retailer/suppliers?search=${encodeURIComponent(s.companyName)}`, icon: Briefcase });
  });

  useEffect(() => {
    setMounted(true);
    const savedCollapsed = localStorage.getItem('retailer_sidebar_collapsed');
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
    document.body.classList.remove('font-sm', 'font-md', 'font-lg');
    document.body.classList.add(`font-${savedFontScale}`);

    // Restore fullscreen if it was active before navigation
    const wantsFullscreen = localStorage.getItem('app_fullscreen') === 'true';
    if (wantsFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    
    logActivity('VIEW_PAGE', `Opened retailer page: ${pathname}`);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem('retailer_sidebar_collapsed', String(next));
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
            router.push(target.url);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, flatResults, activeIndex, router]);

  // Sync fullscreen state: if user exits via Esc or browser chrome, clear the stored preference
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        localStorage.setItem('app_fullscreen', 'false');
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const settingsFunctions = [
    {
      name: 'Activity Logs',
      href: '/retailer/settings?tab=logs',
      icon: Settings,
      desc: 'System logs and operator activities',
      tags: 'logs, audit, history, actions, operator, activity, log',
    },
    {
      name: 'Expiry Alerts',
      href: '/retailer/dashboard?alert=true',
      icon: Settings,
      desc: 'Dashboard medicine near expiry alerts',
      tags: 'alerts, expiry, warning, warning alert, near expiry',
    },
    {
      name: 'Manage Staff',
      href: '/retailer/settings?tab=features',
      icon: Settings,
      desc: 'Configure staff access & allowed features',
      tags: 'staff, user, features, permission, admin',
    },
    {
      name: 'Company Profile',
      href: '/retailer/settings?tab=profile',
      icon: Settings,
      desc: 'Pharmacy profile information & details',
      tags: 'profile, company, register, number, pharmacy',
    }
  ];

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ pages: [], medicines: [], transactions: [], suppliers: [] });
      setActiveIndex(0);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const q = searchQuery.toLowerCase();
        const matchedPages = filteredNavItems.filter((item) =>
          item.name.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          item.tags.toLowerCase().includes(q)
        );

        const matchedSettings = settingsFunctions.filter((item) =>
          item.name.toLowerCase().includes(q) ||
          item.desc.toLowerCase().includes(q) ||
          item.tags.toLowerCase().includes(q)
        );

        const res = await fetch(`/api/retailer/search?q=${encodeURIComponent(searchQuery)}&retailerId=${profile.id}`);
        const data = await res.json();

        setSearchResults({
          pages: [...matchedPages, ...matchedSettings],
          medicines: data.medicines || [],
          transactions: data.transactions || [],
          suppliers: data.suppliers || [],
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

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('retailer_sidebar_collapsed', String(next));
  };

  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    await logActivity('LOGOUT', 'Retailer logged out.');
    window.location.href = '/api/auth/logout';
  };

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>Loading workspace…</span>
      </div>
    );
  }

  const userInitials = user.fullName
    ? user.fullName.substring(0, 2).toUpperCase()
    : user.email.substring(0, 2).toUpperCase();

  return (
    <div className="app-shell no-print">
      {/* SIDEBAR */}
      <aside className={`sidebar no-print ${collapsed ? 'collapsed' : ''}`}>
        <div className={`sidebar-header ${collapsed ? 'justify-center px-2 py-4' : ''}`}>
          {!collapsed && (
            <Link href="/" className="sidebar-logo">
              <div className="sidebar-logo-icon" style={{ background: '#F59E0B' }}>R</div>
              <div className="sidebar-logo-text">
                <div className="sidebar-logo-name">Med<span style={{ color: '#F59E0B' }}>Hub</span></div>
                <div className="sidebar-logo-company">{profile.pharmacyName}</div>
              </div>
            </Link>
          )}
          <button className="sidebar-toggle" onClick={toggleCollapse}>
            {collapsed ? <PanelLeftOpen style={{ width: 14, height: 14 }} /> : <PanelLeftClose style={{ width: 14, height: 14 }} />}
          </button>
        </div>

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
                cursor: 'pointer',
              }}
            >
              <Search style={{ width: 13, height: 13 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>Search (⌘K)</span>
            </button>
          </div>
        )}

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
                    style={isActive && !collapsed ? { borderLeft: '3px solid #2563EB' } : {}}
                    data-label={item.name}
                  >
                    <Icon className="nav-icon" style={isActive ? { color: '#FFFFFF' } : {}} />
                    <span className="sidebar-nav-label">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {isSettingsAllowed && (
            <Link
              href="/retailer/settings"
              className={`sidebar-nav-item ${pathname === '/retailer/settings' ? 'active' : ''}`}
              style={{
                marginBottom: 12,
                borderRadius: 6,
                ...(pathname === '/retailer/settings' && !collapsed ? { borderLeft: '3px solid #2563EB' } : {})
              }}
              data-label="Settings"
            >
              <Settings className="nav-icon" style={pathname === '/retailer/settings' ? { color: '#FFFFFF' } : {}} />
              <span className="sidebar-nav-label">Settings</span>
            </Link>
          )}

          <div className="sidebar-user" data-label={user.fullName || user.email.split('@')[0]}>
            <div className="sidebar-user-avatar" style={{ background: '#374151' }}>{userInitials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.fullName || user.email.split('@')[0]}</div>
              <div className="sidebar-user-role">{user.role === 'RETAILER_STAFF' ? 'Retail Staff' : 'Retail Owner'}</div>
            </div>
          </div>
          <form onSubmit={handleLogout}>
            <button type="submit" className="sidebar-logout" data-label="Sign Out">
              <LogOut style={{ width: 16, height: 16 }} />
              <span className="sidebar-nav-label">Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      <main className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div style={{ width: '100%' }} className="animate-fadeIn">{children}</div>
      </main>

      {/* COMMAND PALETTE */}
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
          }}
          onClick={() => { setShowSearch(false); setSearchQuery(''); }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 540,
              background: 'var(--card-bg)',
              borderRadius: 16,
              padding: 20,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              border: '1.5px solid #FDE68A',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Theme & Scale Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--card-border)', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Theme:</span>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('theme', 'light');
                    document.body.classList.remove('dark-mode');
                  }}
                  style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4, border: '1px solid #CBD5E1', cursor: 'pointer', background: '#fff', color: '#000' }}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
              <Search style={{ width: 18, height: 18, color: '#F59E0B' }} />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search catalog, invoices, suppliers, settings..."
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: 14 }}
              />
              {loadingSearch && <div style={{ width: 14, height: 14, border: '2px solid #F59E0B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
            </div>

            <div style={{ maxHeight: 340, overflowY: 'auto', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {flatResults.length === 0 ? (
                <div style={{ padding: '20px 10px', fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Type to search medicines, invoices, or setting tags...
                </div>
              ) : (
                flatResults.map((item, index) => {
                  const isHighlighted = activeIndex === index;
                  const ResultIcon = item.icon || Search;
                  return (
                    <button
                      key={item.url + item.title + index}
                      onClick={() => { setShowSearch(false); setSearchQuery(''); router.push(item.url); }}
                      onMouseEnter={() => setActiveIndex(index)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: isHighlighted ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isHighlighted ? '#FEF3C7' : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isHighlighted ? '#D97706' : '#64748B' }}>
                        <ResultIcon style={{ width: 16, height: 16 }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--text-primary)' }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.subtitle}</div>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: item.type === 'page' ? '#E0F2FE' : item.type === 'medicine' ? '#ECFDF5' : item.type === 'transaction' ? '#FEF2F2' : '#F5F3FF', color: item.type === 'page' ? '#0369A1' : item.type === 'medicine' ? '#047857' : item.type === 'transaction' ? '#B91C1C' : '#6D28D9', textTransform: 'uppercase' }}>
                        {item.type}
                      </span>
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
