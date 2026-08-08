'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { formatDateNPT, formatDateTimeNPT } from '@/lib/timezone';
import {
  Users, Building, ShieldAlert, ShieldCheck,
  Activity, Search, Eye, Edit3, Key,
  CheckCircle, AlertCircle, X, Check, FileText,
  Sliders, FileCheck, ClipboardList, AlertTriangle,
  Package, ChevronRight, MoreHorizontal, Plus, ToggleLeft, ToggleRight, Sparkles, Trash2,
  Filter, Calendar, ChevronDown, ArrowUpDown,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────── */
interface Profile {
  id: string; companyName?: string; taxId?: string; pharmacyName?: string;
  registrationNumber?: string; clinicName?: string; licenseNumber?: string;
  address?: string; phone?: string; latitude?: number | null; longitude?: number | null;
  customFieldsJson?: string | null; products?: any[]; orders?: any[];
  inventories?: any[]; staff?: any[];
}

interface User {
  id: string; email: string; passwordHash: string; role: string;
  subscriptionStart: string; subscriptionEnd: string; isActive: boolean;
  createdAt: string; wholesalerProfile?: Profile | null; retailerProfile?: Profile | null;
  clinicProfile?: Profile | null; fullName?: string | null; wholesalerId?: string | null;
  allowedFeatures: string; packageName: string; packagePrice: number;
  plainPassword?: string | null; isVerified?: boolean; verificationStatus?: string;
  verificationRejectReason?: string | null; registrationImagesJson?: string; auditLogs?: any[];
}

interface AuditLog {
  id: string; action: string; userId: string | null; details: string; timestamp: string;
  user?: {
    email: string;
    fullName?: string | null;
    role: string;
    wholesalerProfile?: { companyName: string } | null;
    retailerProfile?: { pharmacyName: string } | null;
    clinicProfile?: { clinicName: string } | null;
  } | null;
}

interface SubscriptionPkg {
  id: string; name: string; price: number; description?: string | null;
  features: string; isActive: boolean; createdAt: string;
}

interface Props {
  initialUsers: User[];
  initialLogs: AuditLog[];
  initialPackages?: SubscriptionPkg[];
}

/* ─── Design Tokens ─────────────────────────────────────── */
const C = {
  bg:           '#F8FAFC',
  surface:      '#FFFFFF',
  border:       '#E2E8F0',
  text:         '#0F172A',
  textMid:      '#475569',
  textMuted:    '#94A3B8',
  accent:       '#2563EB',
  accentBg:     '#EFF6FF',
  accentBorder: '#BFDBFE',
  success:      '#16A34A',
  successBg:    '#F0FDF4',
  successBorder:'#BBF7D0',
  warn:         '#D97706',
  warnBg:       '#FFFBEB',
  warnBorder:   '#FDE68A',
  danger:       '#DC2626',
  dangerBg:     '#FEF2F2',
  dangerBorder: '#FECACA',
  purple:       '#7C3AED',
  purpleBg:     '#F5F3FF',
  purpleBorder: '#DDD6FE',
};

/* ─── Micro Components ──────────────────────────────────── */
const Badge = ({ label, bg, color, border }: { label: string; bg: string; color: string; border: string }) => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color, border: `1px solid ${border}`, whiteSpace: 'nowrap' }}>{label}</span>
);

const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 40, height: 40, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon style={{ width: 18, height: 18, color }} />
    </div>
    <div>
      <div style={{ fontSize: 24, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{sub}</div>
    </div>
  </div>
);

const SideNavItem = ({ label, icon: Icon, badge, active, onClick }: any) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none',
    background: active ? C.accentBg : 'transparent',
    color: active ? C.accent : C.textMid,
    fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer',
    transition: 'all 0.12s', textAlign: 'left',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <Icon style={{ width: 15, height: 15, color: active ? C.accent : C.textMuted, flexShrink: 0 }} />
      {label}
    </div>
    {badge !== null && badge !== undefined && (
      <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 20, background: typeof badge === 'number' && badge > 0 ? '#EF4444' : C.border, color: typeof badge === 'number' && badge > 0 ? '#fff' : C.textMuted, fontFamily: 'monospace' }}>
        {badge}
      </span>
    )}
  </button>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: 20 }}>
    <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
    {subtitle && <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0' }}>{subtitle}</p>}
  </div>
);

const Btn = ({ children, onClick, variant = 'default', disabled, small, style: extra, type = 'button' }: any) => {
  const v: any = {
    default: { background: C.surface, color: C.textMid, border: `1px solid ${C.border}` },
    primary: { background: C.accent, color: '#fff', border: 'none' },
    success: { background: C.successBg, color: C.success, border: `1px solid ${C.successBorder}` },
    danger:  { background: C.dangerBg, color: C.danger, border: `1px solid ${C.dangerBorder}` },
    purple:  { background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBorder}` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...v[variant], padding: small ? '4px 10px' : '7px 14px', borderRadius: 7,
      fontWeight: 600, fontSize: small ? 12 : 13, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 5, opacity: disabled ? 0.6 : 1,
      whiteSpace: 'nowrap', transition: 'opacity 0.15s', ...extra,
    }}>
      {children}
    </button>
  );
};

/* ─── Main Component ────────────────────────────────────── */
export default function SuperadminClient({ initialUsers, initialLogs, initialPackages = [] }: Props) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [logs] = useState<AuditLog[]>(initialLogs);
  const [packages, setPackages] = useState<SubscriptionPkg[]>(initialPackages);

  const [activeTab, setActiveTab] = useState<'overview' | 'verification' | 'packages' | 'users' | 'control' | 'logs'>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search input state per page
  const [verifInput, setVerifInput] = useState('');
  const [verifQuery, setVerifQuery] = useState('');
  const [verifSortOrder, setVerifSortOrder] = useState<'desc' | 'asc'>('desc');
  const [verificationFilter, setVerificationFilter] = useState('ALL');

  const [userInput, setUserInput] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userSortOrder, setUserSortOrder] = useState<'desc' | 'asc'>('desc');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modals
  const [verifyModal, setVerifyModal] = useState<User | null>(null);
  const [rejectCommentModal, setRejectCommentModal] = useState<User | null>(null);
  const [controlModal, setControlModal] = useState<User | null>(null);
  const [planModal, setPlanModal] = useState<User | null>(null);
  const [addPackageModal, setAddPackageModal] = useState(false);
  const [tempPass, setTempPass] = useState<{ email: string; pass: string } | null>(null);
  const [docViewer, setDocViewer] = useState<{ images: string[]; index: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [duplicatePanWarning, setDuplicatePanWarning] = useState('');

  // Plan edit form
  const [selectedPkgName, setSelectedPkgName] = useState('');
  const [packagePrice, setPackagePrice] = useState('0');
  const [subscriptionEnd, setSubscriptionEnd] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>([]);
  const availableFeatures = ['Dashboard', 'Medicines', 'Orders', 'Billing', 'POS', 'Profile', 'Logs'];

  // Add package form
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('0');
  const [newPkgDesc, setNewPkgDesc] = useState('');
  const [newPkgIsActive, setNewPkgIsActive] = useState(false);

  // Audit log search & filters
  const [logInput, setLogInput] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logCommitted, setLogCommitted] = useState(false);
  const [logActionFilter, setLogActionFilter] = useState('ALL');
  const [logRoleFilter, setLogRoleFilter] = useState('ALL');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logShowFilters, setLogShowFilters] = useState(false);

  const now = new Date();
  const pending = users.filter(u => (u.verificationStatus || 'PENDING') === 'PENDING' && u.role !== 'SUPERADMIN');

  // ── SSE Live Connection (Superadmin channel) ──────────────────────────────
  const [sseConnected, setSseConnected] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'info' | 'warning' }[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin/users');
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      es = new EventSource('/api/events?superadmin=true');

      es.onmessage = (e) => {
        try {
          const { type, payload } = JSON.parse(e.data);
          if (type === 'CONNECTED') { setSseConnected(true); return; }

          if (type === 'VERIFICATION_UPDATE') {
            refreshUsers();
            const action = payload?.action === 'verify' ? 'verified' : 'rejected';
            addToast(`✅ Partner ${payload?.email || ''} was ${action}.`, action === 'verified' ? 'success' : 'warning');
          } else if (type === 'USER_PLAN_UPDATE') {
            refreshUsers();
            addToast(`📋 Plan updated for user ${payload?.userId || ''}.`, 'info');
          } else if (type === 'CONSUMER_ORDER_NEW') {
            addToast(`🛒 New online order placed at a pharmacy.`, 'success');
          }
        } catch {}
      };

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        retryTimer = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => { es?.close(); clearTimeout(retryTimer); };
  }, [refreshUsers, addToast]);
  // ─────────────────────────────────────────────────────────────────────────

  /* ── Filtered Verification Requests ── */
  const filteredVerifications = useMemo(() => {
    let result = users.filter(u => u.role !== 'SUPERADMIN');
    if (verificationFilter !== 'ALL') {
      result = result.filter(u => (u.verificationStatus || 'PENDING') === verificationFilter);
    }
    if (verifQuery.trim()) {
      const q = verifQuery.toLowerCase().trim();
      result = result.filter(u => {
        const p = u.wholesalerProfile || u.retailerProfile || u.clinicProfile;
        const storeName = p?.companyName || p?.pharmacyName || p?.clinicName || '';
        return [storeName, u.email, u.role, p?.taxId, p?.registrationNumber, p?.phone, p?.address]
          .some(v => v?.toLowerCase().includes(q));
      });
    }
    result.sort((a, b) => {
      const tA = new Date(a.createdAt).getTime();
      const tB = new Date(b.createdAt).getTime();
      return verifSortOrder === 'desc' ? tB - tA : tA - tB;
    });
    return result;
  }, [users, verificationFilter, verifQuery, verifSortOrder]);

  /* ── Filtered Users & Plans ── */
  const filteredUsersList = useMemo(() => {
    let result = [...users];
    if (roleFilter !== 'ALL') {
      result = result.filter(u => u.role === roleFilter);
    }
    if (userQuery.trim()) {
      const q = userQuery.toLowerCase().trim();
      result = result.filter(u => {
        const p = u.wholesalerProfile || u.retailerProfile || u.clinicProfile;
        const storeName = p?.companyName || p?.pharmacyName || p?.clinicName || '';
        return [storeName, u.email, u.fullName, u.role, u.packageName, p?.taxId, p?.address, p?.phone]
          .some(v => v?.toLowerCase().includes(q));
      });
    }
    result.sort((a, b) => {
      const tA = new Date(a.createdAt).getTime();
      const tB = new Date(b.createdAt).getTime();
      return userSortOrder === 'desc' ? tB - tA : tA - tB;
    });
    return result;
  }, [users, roleFilter, userQuery, userSortOrder]);

  // Unique audit actions & roles for filter dropdowns
  const uniqueActions = useMemo(() => {
    const set = new Set(logs.map(l => l.action));
    return ['ALL', ...Array.from(set).sort()];
  }, [logs]);

  const uniqueRoles = useMemo(() => {
    const set = new Set(logs.map(l => l.user?.role).filter(Boolean) as string[]);
    return ['ALL', ...Array.from(set).sort()];
  }, [logs]);

  /* ── Filtered Audit Logs (Includes Store Name Matching!) ── */
  const filteredLogs = useMemo(() => {
    if (!logCommitted && !logSearch.trim()) return [];
    return logs.filter(log => {
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase().trim();
        const storeName = log.user?.wholesalerProfile?.companyName ||
                          log.user?.retailerProfile?.pharmacyName ||
                          log.user?.clinicProfile?.clinicName || '';
        const matchText = [
          log.action,
          log.details,
          log.user?.email,
          log.user?.fullName,
          log.userId,
          storeName,
        ].some(v => v?.toLowerCase().includes(q));
        if (!matchText) return false;
      }
      if (logActionFilter !== 'ALL' && log.action !== logActionFilter) return false;
      if (logRoleFilter !== 'ALL' && log.user?.role !== logRoleFilter) return false;
      if (logDateFrom) {
        const from = new Date(logDateFrom);
        if (new Date(log.timestamp) < from) return false;
      }
      if (logDateTo) {
        const to = new Date(logDateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(log.timestamp) > to) return false;
      }
      return true;
    });
  }, [logs, logSearch, logCommitted, logActionFilter, logRoleFilter, logDateFrom, logDateTo]);

  /* ── API Helpers ── */
  const apiCall = async (url: string, method: string, body: any) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  };

  const handleVerify = async (userId: string, forceApprove: boolean = false) => {
    setLoading(true); setError(''); setSuccessMsg(''); setDuplicatePanWarning('');
    try {
      const res = await fetch(`/api/superadmin/user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', forceApprove })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.duplicatePan) {
          setDuplicatePanWarning(data.message);
          return;
        }
        throw new Error(data.error || data.message || 'Request failed.');
      }
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified: true, verificationStatus: 'VERIFIED', verificationRejectReason: null } : u));
      setSuccessMsg('Partner account verified successfully.');
      setVerifyModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleReject = async (userId: string, reason: string) => {
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      await apiCall(`/api/superadmin/user/${userId}`, 'POST', { action: 'reject', rejectReason: reason });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified: false, verificationStatus: 'REJECTED', verificationRejectReason: reason } : u));
      setSuccessMsg('Application rejected with reason saved.');
      setRejectCommentModal(null); setVerifyModal(null); setRejectReason('');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Reset password for ${email}?`)) return;
    setLoading(true); setError('');
    try {
      const data = await apiCall(`/api/superadmin/user/${userId}`, 'POST', { action: 'reset-password' });
      setTempPass({ email, pass: data.tempPassword });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planModal) return;
    setLoading(true); setError('');
    try {
      await apiCall(`/api/superadmin/user/${planModal.id}`, 'PUT', { packageName: selectedPkgName, packagePrice, subscriptionEnd: new Date(subscriptionEnd).toISOString(), isActive, allowedFeatures });
      setUsers(prev => prev.map(u => u.id === planModal.id ? { ...u, packageName: selectedPkgName, packagePrice: parseFloat(packagePrice), subscriptionEnd: new Date(subscriptionEnd).toISOString(), isActive, allowedFeatures: allowedFeatures.join(',') } : u));
      setSuccessMsg('Plan updated successfully.'); setPlanModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPkgName.trim()) return;
    setLoading(true); setError('');
    try {
      const data = await apiCall('/api/superadmin/packages', 'POST', { name: newPkgName.trim(), price: parseFloat(newPkgPrice) || 0, description: newPkgDesc.trim(), isActive: newPkgIsActive });
      setPackages(prev => [...prev, data.package]);
      setSuccessMsg(`Package "${data.package.name}" created.`);
      setAddPackageModal(false);
      setNewPkgName(''); setNewPkgPrice('0'); setNewPkgDesc(''); setNewPkgIsActive(false);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleTogglePkg = async (pkg: SubscriptionPkg) => {
    setLoading(true); setError('');
    try {
      const data = await apiCall(`/api/superadmin/packages/${pkg.id}`, 'PUT', { isActive: !pkg.isActive });
      setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, isActive: data.package.isActive } : p));
      setSuccessMsg(`"${pkg.name}" is now ${data.package.isActive ? 'enabled' : 'disabled'}.`);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDeletePkg = async (pkg: SubscriptionPkg) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${pkg.name}"? This cannot be undone.`)) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/superadmin/packages?id=${pkg.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete package');
      setPackages(prev => prev.filter(p => p.id !== pkg.id));
      setSuccessMsg(`Package "${pkg.name}" has been deleted.`);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const openPlan = (u: User, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPlanModal(u);
    setSelectedPkgName(u.packageName || 'Free Plan');
    setPackagePrice(String(u.packagePrice || 0));
    setSubscriptionEnd(new Date(u.subscriptionEnd).toISOString().split('T')[0]);
    setIsActive(u.isActive);
    setAllowedFeatures(u.allowedFeatures ? u.allowedFeatures.split(',') : [...availableFeatures]);
  };

  const handlePkgSelect = (name: string) => {
    setSelectedPkgName(name);
    const found = packages.find(p => p.name === name);
    if (found) setPackagePrice(String(found.price));
  };

  const getVerifBadge = (status?: string) => {
    if (status === 'VERIFIED') return <Badge label="Verified" bg={C.successBg} color={C.success} border={C.successBorder} />;
    if (status === 'REJECTED') return <Badge label="Rejected" bg={C.dangerBg}  color={C.danger}  border={C.dangerBorder} />;
    return                           <Badge label="Pending"  bg={C.warnBg}    color={C.warn}    border={C.warnBorder} />;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${C.border}`, fontSize: 13, color: C.text,
    outline: 'none', boxSizing: 'border-box', background: C.surface,
  };

  const rowHover: React.CSSProperties = { cursor: 'pointer', transition: 'background 0.1s' };

  /* ── Nav Items ── */
  const navItems = [
    { id: 'overview',     label: 'Overview',          icon: Activity,     badge: null },
    { id: 'verification', label: 'Verification',       icon: FileCheck,    badge: pending.length || null },
    { id: 'packages',     label: 'Software Packages',  icon: Package,      badge: packages.length },
    { id: 'users',        label: 'Users & Plans',      icon: Users,        badge: users.length },
    { id: 'control',      label: 'Deep Control',       icon: Sliders,      badge: null },
    { id: 'logs',         label: 'Audit Logs',         icon: ClipboardList,badge: null },
  ];

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, padding: '24px 12px', display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
        <div style={{ padding: '0 4px 16px', marginBottom: 8, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: C.textMuted }}>Navigation</div>
        </div>
        {navItems.map(item => (
          <SideNavItem key={item.id} label={item.label} icon={item.icon} badge={item.badge}
            active={activeTab === item.id}
            onClick={() => { setActiveTab(item.id as any); setError(''); setSuccessMsg(''); }} />
        ))}
        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.textMuted, padding: '0 4px' }}>
            <div style={{ fontWeight: 600, color: C.textMid, marginBottom: 6 }}>System Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: sseConnected ? C.success : '#F59E0B',
                boxShadow: sseConnected ? `0 0 0 2px ${C.successBg}` : '0 0 0 2px #FFFBEB',
                animation: sseConnected ? 'pulse 2s infinite' : 'none',
              }} />
              <span style={{ color: sseConnected ? C.success : '#B45309', fontWeight: 600, fontSize: 11 }}>
                {sseConnected ? 'Live — All systems online' : 'Connecting…'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

        {/* Global alerts */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, borderRadius: 8, color: C.danger, fontSize: 13 }}>
            <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} /> {error}
            <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.danger }}><X style={{ width: 14, height: 14 }} /></button>
          </div>
        )}
        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.successBg, border: `1px solid ${C.successBorder}`, borderRadius: 8, color: C.success, fontSize: 13 }}>
            <CheckCircle style={{ width: 15, height: 15, flexShrink: 0 }} /> {successMsg}
            <button onClick={() => setSuccessMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.success }}><X style={{ width: 14, height: 14 }} /></button>
          </div>
        )}
        {tempPass && (
          <div style={{ padding: '12px 16px', background: C.purpleBg, border: `1px solid ${C.purpleBorder}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Key style={{ width: 16, height: 16, color: C.purple, flexShrink: 0 }} />
            <div style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Temp password for {tempPass.email}: </span>
              <code style={{ fontWeight: 800, color: C.purple, background: '#EDE9FE', padding: '2px 8px', borderRadius: 4 }}>{tempPass.pass}</code>
            </div>
            <button onClick={() => setTempPass(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}><X style={{ width: 14, height: 14 }} /></button>
          </div>
        )}

        {/* ══════════ OVERVIEW ══════════ */}
        {activeTab === 'overview' && (
          <>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Dashboard Overview</h1>
              <p style={{ fontSize: 13, color: C.textMuted, margin: '4px 0 0' }}>Platform health and quick-action summary</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <StatCard icon={Users}       label="Total Users"     value={users.length}                                sub={`${users.filter(u=>u.isActive).length} active`}  color="#2563EB" />
              <StatCard icon={Building}    label="Distributors"    value={users.filter(u=>u.role==='WHOLESALER').length} sub={`${users.filter(u=>u.role==='WHOLESALER'&&u.isVerified).length} verified`} color="#7C3AED" />
              <StatCard icon={ShieldCheck} label="Pharmacies"      value={users.filter(u=>u.role==='RETAILER').length}  sub={`${users.filter(u=>u.role==='RETAILER'&&u.isVerified).length} verified`}  color="#16A34A" />
              <StatCard icon={ShieldAlert} label="Pending Verify"  value={pending.length}                              sub="Require review"                                  color="#D97706" />
            </div>
            {pending.length > 0 && (
              <div style={{ background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: C.warn, fontWeight: 600 }}>⚠ {pending.length} application{pending.length>1?'s':''} awaiting review</div>
                <Btn small onClick={() => setActiveTab('verification')}>Review <ChevronRight style={{ width: 13, height: 13 }} /></Btn>
              </div>
            )}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Software Packages ({packages.length})</span>
                <Btn small variant="primary" onClick={() => setActiveTab('packages')}>Manage</Btn>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {packages.map(p => (
                  <div key={p.id} style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                      <Badge label={p.isActive ? 'Active' : 'Off'} bg={p.isActive ? C.successBg : C.dangerBg} color={p.isActive ? C.success : C.danger} border={p.isActive ? C.successBorder : C.dangerBorder} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, marginTop: 4 }}>Rs. {p.price.toLocaleString()}/yr</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Recent System Activity</span>
                <Btn small onClick={() => setActiveTab('logs')}>View all <ChevronRight style={{ width: 12, height: 12 }} /></Btn>
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {logs.slice(0, 8).map(log => {
                  const storeName = log.user?.wholesalerProfile?.companyName || log.user?.retailerProfile?.pharmacyName || log.user?.clinicProfile?.clinicName;
                  return (
                    <div key={log.id} style={{ display: 'flex', gap: 10, padding: '9px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: log.action.includes('REJECT') ? C.dangerBg : C.accentBg, color: log.action.includes('REJECT') ? C.danger : C.accent, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1 }}>{log.action}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {storeName ? <strong>{storeName} — </strong> : null}{log.details}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{formatDateTimeNPT(log.timestamp)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ══════════ VERIFICATION ══════════ */}
        {activeTab === 'verification' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
              <SectionHeader title="Partner Verification" subtitle="Review store details and uploaded registration documents to approve or reject applications" />
              
              {/* Search & Sort & Filter controls */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <form onSubmit={e => { e.preventDefault(); setVerifQuery(verifInput); }} style={{ display: 'flex', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.surface, border: `1px solid ${C.border}`, padding: '6px 10px', borderRadius: 8 }}>
                    <Search style={{ width: 13, height: 13, color: C.textMuted }} />
                    <input type="text" placeholder="Search pharmacy/wholesaler name, email, tax ID…" value={verifInput} onChange={e => { setVerifInput(e.target.value); if (!e.target.value) setVerifQuery(''); }} style={{ border: 'none', outline: 'none', fontSize: 13, width: 220, background: 'transparent', color: C.text }} />
                    {verifInput && (
                      <button type="button" onClick={() => { setVerifInput(''); setVerifQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0 }}><X style={{ width: 12, height: 12 }} /></button>
                    )}
                  </div>
                  <Btn variant="primary" type="submit" small><Search style={{ width: 12, height: 12 }} /> Search</Btn>
                </form>

                {/* Sort by Request Time */}
                <Btn small onClick={() => setVerifSortOrder(o => o === 'desc' ? 'asc' : 'desc')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowUpDown style={{ width: 12, height: 12 }} />
                  Time: {verifSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                </Btn>

                {/* Status Tabs */}
                <div style={{ display: 'flex', gap: 4 }}>
                  {['ALL', 'PENDING', 'VERIFIED', 'REJECTED'].map(f => (
                    <button key={f} onClick={() => setVerificationFilter(f)} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${verificationFilter===f ? C.accent : C.border}`, background: verificationFilter===f ? C.accentBg : C.surface, color: verificationFilter===f ? C.accent : C.textMid, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {f==='ALL' ? 'All' : f.charAt(0)+f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th>Organization</th><th>Type</th><th>Tax / Reg ID</th><th>Request Date</th><th>Docs</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th></tr>
                </thead>
                <tbody>
                  {filteredVerifications.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>No verification requests match your search and filter criteria.</td></tr>
                  ) : filteredVerifications.map(user => {
                    const p = user.wholesalerProfile || user.retailerProfile || user.clinicProfile;
                    const storeName = p?.companyName || p?.pharmacyName || p?.clinicName || '—';
                    let images: string[] = [];
                    try { images = JSON.parse(user.registrationImagesJson || '[]'); } catch {}
                    return (
                      <tr key={user.id} onClick={() => setVerifyModal(user)} style={rowHover}
                        onMouseEnter={e => (e.currentTarget.style.background = C.accentBg)}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{storeName}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{user.email}</div>
                        </td>
                        <td><Badge label={user.role==='WHOLESALER' ? 'Distributor' : user.role==='RETAILER' ? 'Pharmacy' : 'Clinic'} bg={user.role==='WHOLESALER' ? C.purpleBg : C.successBg} color={user.role==='WHOLESALER' ? C.purple : C.success} border={user.role==='WHOLESALER' ? C.purpleBorder : C.successBorder} /></td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p?.taxId || p?.registrationNumber || p?.licenseNumber || '—'}</td>
                        <td style={{ fontSize: 12, color: C.textMid }}>{formatDateNPT(user.createdAt)}</td>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, color: images.length > 0 ? C.accent : C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileText style={{ width: 13, height: 13 }} /> {images.length} file{images.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>{getVerifBadge(user.verificationStatus)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Btn small variant="purple" onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              const pan = p?.taxId || p?.registrationNumber || '';
                              if (pan) navigator.clipboard.writeText(pan);
                              window.open('https://ird.gov.np/pan-search/', '_blank');
                            }}>
                              <FileCheck style={{ width: 11, height: 11 }} /> PAN
                            </Btn>
                            <Btn small onClick={(e: React.MouseEvent) => { e.stopPropagation(); setVerifyModal(user); }}><Eye style={{ width: 12, height: 12 }} /> Inspect</Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════════ SOFTWARE PACKAGES ══════════ */}
        {activeTab === 'packages' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
              <SectionHeader title="Software Package Management" subtitle="Add plans, set prices, and enable/disable them for the registration page" />
              <Btn variant="primary" onClick={() => setAddPackageModal(true)}><Plus style={{ width: 14, height: 14 }} /> Add Package</Btn>
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th>Package Name</th><th>Annual Price</th><th>Description</th><th>Status</th><th style={{ textAlign: 'right' }}>Toggle</th><th style={{ textAlign: 'right' }}>Delete</th></tr>
                </thead>
                <tbody>
                  {packages.map(pkg => (
                    <tr key={pkg.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {pkg.name === 'Free Plan' && <Sparkles style={{ width: 14, height: 14, color: C.warn }} />}
                          {pkg.name}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13 }}>Rs. {pkg.price.toLocaleString()} / year</td>
                      <td style={{ fontSize: 12, color: C.textMid }}>{pkg.description || '—'}</td>
                      <td><Badge label={pkg.isActive ? 'ACTIVE (Shown in Registration)' : 'DISABLED'} bg={pkg.isActive ? C.successBg : C.dangerBg} color={pkg.isActive ? C.success : C.danger} border={pkg.isActive ? C.successBorder : C.dangerBorder} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <Btn small variant={pkg.isActive ? 'danger' : 'success'} onClick={() => handleTogglePkg(pkg)} disabled={loading}>
                          {pkg.isActive ? <ToggleRight style={{ width: 14, height: 14 }} /> : <ToggleLeft style={{ width: 14, height: 14 }} />}
                          {pkg.isActive ? 'Disable' : 'Enable'}
                        </Btn>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Btn small variant="danger" onClick={() => handleDeletePkg(pkg)} disabled={loading} style={{ opacity: 0.85 }}>
                          <Trash2 style={{ width: 13, height: 13 }} />
                          Delete
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════════ USERS & PLANS ══════════ */}
        {activeTab === 'users' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
              <SectionHeader title="Users & Subscription Plans" subtitle="Click a row to edit plan or reset password. Search by pharmacy, distributor, or email." />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <form onSubmit={e => { e.preventDefault(); setUserQuery(userInput); }} style={{ display: 'flex', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.surface, border: `1px solid ${C.border}`, padding: '6px 10px', borderRadius: 8 }}>
                    <Search style={{ width: 13, height: 13, color: C.textMuted }} />
                    <input type="text" placeholder="Search store name, email, plan…" value={userInput} onChange={e => { setUserInput(e.target.value); if (!e.target.value) setUserQuery(''); }} style={{ border: 'none', outline: 'none', fontSize: 13, width: 220, background: 'transparent', color: C.text }} />
                    {userInput && (
                      <button type="button" onClick={() => { setUserInput(''); setUserQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0 }}><X style={{ width: 12, height: 12 }} /></button>
                    )}
                  </div>
                  <Btn variant="primary" type="submit" small><Search style={{ width: 12, height: 12 }} /> Search</Btn>
                </form>

                {/* Sort by Created Time */}
                <Btn small onClick={() => setUserSortOrder(o => o === 'desc' ? 'asc' : 'desc')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowUpDown style={{ width: 12, height: 12 }} />
                  Time: {userSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
                </Btn>

                <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, background: C.surface, color: C.text }}>
                  <option value="ALL">All Roles</option>
                  <option value="WHOLESALER">Distributors</option>
                  <option value="RETAILER">Pharmacies</option>
                </select>
              </div>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th>Account / Store</th><th>Role</th><th>Package</th><th>Annual Fee</th><th>Expiry</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredUsersList.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>No users match your search and filter criteria.</td></tr>
                  ) : filteredUsersList.map(user => {
                    const p = user.wholesalerProfile || user.retailerProfile || user.clinicProfile;
                    const storeName = p?.companyName || p?.pharmacyName || p?.clinicName;
                    const days = Math.ceil((new Date(user.subscriptionEnd).getTime() - now.getTime()) / 86400000);
                    const expired = days <= 0;
                    return (
                      <tr key={user.id} onClick={() => openPlan(user)} style={rowHover}
                        onMouseEnter={e => (e.currentTarget.style.background = C.accentBg)}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{storeName ? `${storeName}` : (user.fullName || user.email)}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{user.email}</div>
                        </td>
                        <td><Badge label={user.role} bg={C.bg} color={C.textMid} border={C.border} /></td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.packageName}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{Math.max(0, days)}d left</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>Rs. {user.packagePrice.toLocaleString()}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: expired ? C.danger : C.textMid }}>{formatDateNPT(user.subscriptionEnd)}</td>
                        <td><Badge label={user.isActive ? 'Active' : 'Inactive'} bg={user.isActive ? C.successBg : C.dangerBg} color={user.isActive ? C.success : C.danger} border={user.isActive ? C.successBorder : C.dangerBorder} /></td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Btn small variant="purple" onClick={(e: React.MouseEvent) => openPlan(user, e)}><Edit3 style={{ width: 11, height: 11 }} /> Plan</Btn>
                            <Btn small variant="danger" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleResetPassword(user.id, user.email); }}><Key style={{ width: 11, height: 11 }} /> Reset</Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════════ DEEP CONTROL ══════════ */}
        {activeTab === 'control' && (
          <>
            <SectionHeader title="Partner Deep Control" subtitle="Click any row to inspect catalogue, transactions, staff, and activity logs" />
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th>Partner Account</th><th>Role</th><th>Products</th><th>Orders</th><th>Staff</th><th>Verification</th><th style={{ textAlign: 'right' }}>Inspect</th></tr>
                </thead>
                <tbody>
                  {users.filter(u => u.role !== 'SUPERADMIN').map(user => {
                    const p = user.wholesalerProfile || user.retailerProfile;
                    return (
                      <tr key={user.id} onClick={() => setControlModal(user)} style={rowHover}
                        onMouseEnter={e => (e.currentTarget.style.background = C.accentBg)}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p?.companyName || p?.pharmacyName || user.email}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{user.email}</div>
                        </td>
                        <td><Badge label={user.role} bg={C.bg} color={C.textMid} border={C.border} /></td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{p?.products?.length || p?.inventories?.length || 0}</td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{p?.orders?.length || 0}</td>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{p?.staff?.length || 0}</td>
                        <td>{getVerifBadge(user.verificationStatus)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <Btn small><MoreHorizontal style={{ width: 13, height: 13 }} /> Details</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══════════ AUDIT LOGS ══════════ */}
        {activeTab === 'logs' && (
          <>
            <SectionHeader title="System Audit Logs" subtitle="Search by pharmacy name, distributor name, email, or action keyword. All logs for that partner will be listed." />

            {/* ── Search Bar ── */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
              <form onSubmit={e => { e.preventDefault(); setLogSearch(logInput); setLogCommitted(true); }} style={{ display: 'flex', gap: 8, marginBottom: logShowFilters ? 14 : 0 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: C.bg, border: `1px solid ${C.border}`, padding: '9px 12px', borderRadius: 8 }}>
                  <Search style={{ width: 15, height: 15, color: C.textMuted, flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search pharmacy name, distributor name, email, or action keyword…"
                    value={logInput}
                    onChange={e => { setLogInput(e.target.value); if (!e.target.value.trim()) { setLogSearch(''); setLogCommitted(false); } }}
                    style={{ border: 'none', outline: 'none', fontSize: 13, flex: 1, background: 'transparent', color: C.text }}
                  />
                  {logInput && (
                    <button type="button" onClick={() => { setLogInput(''); setLogSearch(''); setLogCommitted(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 0, display: 'flex' }}>
                      <X style={{ width: 13, height: 13 }} />
                    </button>
                  )}
                </div>
                <Btn variant="primary" type="submit">
                  <Search style={{ width: 13, height: 13 }} /> Search Audits
                </Btn>
                <Btn onClick={() => setLogShowFilters(f => !f)}>
                  <Filter style={{ width: 13, height: 13 }} /> Filters
                  <ChevronDown style={{ width: 12, height: 12, transform: logShowFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </Btn>
              </form>

              {/* ── Advanced Filters ── */}
              {logShowFilters && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action Type</label>
                    <select value={logActionFilter} onChange={e => setLogActionFilter(e.target.value)} style={{ ...inputStyle, padding: '7px 10px' }}>
                      {uniqueActions.map(a => <option key={a} value={a}>{a === 'ALL' ? 'All Actions' : a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>User Role</label>
                    <select value={logRoleFilter} onChange={e => setLogRoleFilter(e.target.value)} style={{ ...inputStyle, padding: '7px 10px' }}>
                      {uniqueRoles.map(r => <option key={r} value={r}>{r === 'ALL' ? 'All Roles' : r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date From</label>
                    <input type="date" value={logDateFrom} onChange={e => setLogDateFrom(e.target.value)} style={{ ...inputStyle, padding: '7px 10px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date To</label>
                    <input type="date" value={logDateTo} onChange={e => setLogDateTo(e.target.value)} style={{ ...inputStyle, padding: '7px 10px' }} />
                  </div>
                  <div style={{ gridColumn: 'span 4', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Btn small onClick={() => { setLogActionFilter('ALL'); setLogRoleFilter('ALL'); setLogDateFrom(''); setLogDateTo(''); }}>Clear Filters</Btn>
                    <Btn small variant="primary" onClick={() => { setLogSearch(logInput); setLogCommitted(true); }}>Apply & Search</Btn>
                  </div>
                </div>
              )}
            </div>

            {/* ── Empty State (before search) ── */}
            {!logCommitted && !logSearch.trim() && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '60px 20px', textAlign: 'center' }}>
                <ClipboardList style={{ width: 36, height: 36, color: C.textMuted, margin: '0 auto 12px' }} />
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>Search by Pharmacy or Wholesaler Name</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>Type the store name, pharmacy name, email, or action keyword above and click Search to view all associated audit logs.</div>
              </div>
            )}

            {/* ── Results ── */}
            {(logCommitted || logSearch.trim()) && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: C.textMuted }}>{filteredLogs.length} audit log{filteredLogs.length !== 1 ? 's' : ''} found</span>
                  {filteredLogs.length > 0 && <span style={{ fontSize: 12, color: C.textMuted }}>Showing newest first</span>}
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {filteredLogs.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>No audit logs match your search criteria.</div>
                  ) : filteredLogs.map((log, i) => {
                    const storeName = log.user?.wholesalerProfile?.companyName || log.user?.retailerProfile?.pharmacyName || log.user?.clinicProfile?.clinicName;
                    return (
                      <div key={log.id} style={{ display: 'flex', gap: 12, padding: '11px 16px', borderBottom: i < filteredLogs.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: log.action.includes('REJECT') || log.action.includes('ERR') ? C.dangerBg : C.accentBg, color: log.action.includes('REJECT') || log.action.includes('ERR') ? C.danger : C.accent, whiteSpace: 'nowrap', marginTop: 2, flexShrink: 0 }}>
                          {log.action}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: C.text }}>{log.details}</div>
                          {log.user && (
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                              {storeName && <span style={{ fontWeight: 700, color: C.accent }}>🏪 {storeName}</span>}
                              <span>{log.user.fullName || log.user.email} ({log.user.role})</span>
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap', marginTop: 2, flexShrink: 0 }}>{formatDateTimeNPT(log.timestamp)}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* ═══════════ MODALS ═══════════ */}

      {/* Verification Inspect */}
      {verifyModal && (() => {
        const u = verifyModal;
        const p = u.wholesalerProfile || u.retailerProfile || u.clinicProfile;
        const storeName = p?.companyName || p?.pharmacyName || p?.clinicName || '—';
        let images: string[] = [];
        try { images = JSON.parse(u.registrationImagesJson || '[]'); } catch {}
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 680, background: C.surface, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Verification Request</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{u.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getVerifBadge(u.verificationStatus)}
                  <button onClick={() => setVerifyModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}><X style={{ width: 18, height: 18 }} /></button>
                </div>
              </div>
              <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[['Organization', storeName], ['Tax / Reg ID', p?.taxId || p?.registrationNumber || p?.licenseNumber || '—'], ['Email', u.email], ['Phone', p?.phone || '—'], ['Type', u.role === 'WHOLESALER' ? 'Distributor' : u.role === 'RETAILER' ? 'Pharmacy' : 'Clinic'], ['Address', p?.address || '—']].map(([k, v]) => (
                    <div key={k} style={{ background: C.bg, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Registration Documents ({images.length})</div>
                  {images.length === 0 ? (
                    <div style={{ padding: 14, background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 8, color: C.warn, fontSize: 13, textAlign: 'center' }}>No documents uploaded</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                      {images.map((img, idx) => (
                        <div key={idx} onClick={() => setDocViewer({ images, index: idx })} style={{ height: 90, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', cursor: 'pointer', position: 'relative', background: '#F1F5F9' }}>
                          <img src={img} alt={`Doc ${idx+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 10, textAlign: 'center', padding: '3px 0', fontWeight: 600 }}>Doc #{idx+1}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {u.verificationRejectReason && (
                  <div style={{ padding: 12, background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, borderRadius: 8, fontSize: 13, color: C.danger }}>
                    <strong>Previous rejection:</strong> {u.verificationRejectReason}
                  </div>
                )}
                {duplicatePanWarning && (
                  <div style={{ padding: 14, background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 10, color: '#991B1B', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, color: '#DC2626' }}>
                      <AlertTriangle style={{ width: 18, height: 18, flexShrink: 0 }} />
                      Duplicate PAN / Reg ID Warning
                    </div>
                    <div>{duplicatePanWarning}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <Btn variant="danger" onClick={() => handleVerify(u.id, true)} disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
                        <CheckCircle style={{ width: 14, height: 14 }} /> {loading ? 'Approving…' : 'Force Approve Anyway'}
                      </Btn>
                      <Btn variant="ghost" onClick={() => setDuplicatePanWarning('')} style={{ flex: 1, justifyContent: 'center' }}>
                        Cancel
                      </Btn>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  {/* External Government Verification Quick Links */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn small variant="purple" onClick={() => {
                      const pan = p?.taxId || p?.registrationNumber || '';
                      if (pan) navigator.clipboard.writeText(pan);
                      window.open('https://ird.gov.np/pan-search/', '_blank');
                    }} style={{ flex: 1, justifyContent: 'center' }}>
                      <FileCheck style={{ width: 13, height: 13 }} /> Verify PAN (IRD)
                    </Btn>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <Btn variant="danger" onClick={() => { setRejectCommentModal(u); setVerifyModal(null); }} style={{ flex: 1 }}>
                      <X style={{ width: 14, height: 14 }} /> Reject
                    </Btn>
                    <Btn variant="success" onClick={() => handleVerify(u.id, false)} disabled={loading} style={{ flex: 2 }}>
                      <Check style={{ width: 14, height: 14 }} /> {loading ? 'Approving…' : 'Approve & Verify'}
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Rejection Reason */}
      {rejectCommentModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 440, background: C.surface, borderRadius: 12, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: C.danger }} /> Rejection Feedback
              </div>
              <button onClick={() => setRejectCommentModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
              This note will be displayed on <strong>{rejectCommentModal.email}</strong>'s profile so they know what to fix.
            </p>
            <textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. DDA license photo is blurry, please re-upload." style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => setRejectCommentModal(null)} style={{ flex: 1 }}>Cancel</Btn>
              <Btn variant="danger" onClick={() => handleReject(rejectCommentModal.id, rejectReason)} disabled={loading || !rejectReason.trim()} style={{ flex: 2 }}>
                {loading ? 'Submitting…' : 'Confirm Rejection'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Add Package */}
      {addPackageModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 460, background: C.surface, borderRadius: 12, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Add Software Package</div>
              <button onClick={() => setAddPackageModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <form onSubmit={handleAddPackage} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>Package Name</label>
                <input type="text" placeholder="e.g. Platinum Tier" value={newPkgName} onChange={e => setNewPkgName(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>Annual Price (Rs.)</label>
                <input type="number" value={newPkgPrice} onChange={e => setNewPkgPrice(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>Description</label>
                <input type="text" placeholder="e.g. Priority support & analytics" value={newPkgDesc} onChange={e => setNewPkgDesc(e.target.value)} style={inputStyle} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={newPkgIsActive} onChange={e => setNewPkgIsActive(e.target.checked)} style={{ width: 15, height: 15 }} />
                Enable in Registration Page
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Btn onClick={() => setAddPackageModal(false)} style={{ flex: 1 }}>Cancel</Btn>
                <Btn variant="primary" type="submit" disabled={loading} style={{ flex: 2 }}>{loading ? 'Creating…' : 'Create Package'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Plan — package from DB */}
      {planModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 460, background: C.surface, borderRadius: 12, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Edit Subscription Plan</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{planModal.email}</div>
              </div>
              <button onClick={() => setPlanModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <form onSubmit={handleUpdatePlan} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>Package (from Database)</label>
                <select value={selectedPkgName} onChange={e => handlePkgSelect(e.target.value)} style={inputStyle}>
                  {packages.map(pkg => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name} — Rs. {pkg.price.toLocaleString()}/yr{!pkg.isActive ? ' [Disabled in Reg]' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>Override Annual Fee (Rs.)</label>
                <input type="number" value={packagePrice} onChange={e => setPackagePrice(e.target.value)} required style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>Subscription Expiry</label>
                <input type="date" value={subscriptionEnd} onChange={e => setSubscriptionEnd(e.target.value)} required style={inputStyle} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ width: 15, height: 15 }} />
                Account Active
              </label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Btn onClick={() => setPlanModal(null)} style={{ flex: 1 }}>Cancel</Btn>
                <Btn variant="primary" type="submit" disabled={loading} style={{ flex: 2 }}>{loading ? 'Saving…' : 'Save Changes'}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deep Control */}
      {controlModal && (() => {
        const u = controlModal;
        const p = u.wholesalerProfile || u.retailerProfile;
        const products = p?.products || p?.inventories || [];
        const orders = p?.orders || [];
        const uLogs = u.auditLogs || [];
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 780, background: C.surface, borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p?.companyName || p?.pharmacyName || u.email}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{u.email} · {u.role} · {u.packageName}</div>
                </div>
                <button onClick={() => setControlModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}><X style={{ width: 18, height: 18 }} /></button>
              </div>
              <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[['Products', products.length], ['Orders', orders.length], ['Staff', p?.staff?.length || 0], ['Logs', uLogs.length]].map(([label, val]) => (
                    <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{val}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                {/* Catalogue */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Catalogue Items</div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: 150, overflowY: 'auto' }}>
                    {products.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>No items</div>
                      : products.map((item: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: i < products.length-1 ? `1px solid ${C.border}` : 'none', fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>{item.name || item.product?.name}</span>
                          <span style={{ color: C.textMuted, fontFamily: 'monospace' }}>{item.sku || item.product?.sku}</span>
                        </div>
                      ))}
                  </div>
                </div>
                {/* Orders */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Recent Orders</div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: 150, overflowY: 'auto' }}>
                    {orders.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>No orders</div>
                      : orders.map((ord: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: i < orders.length-1 ? `1px solid ${C.border}` : 'none', fontSize: 12 }}>
                          <span style={{ color: C.textMid }}>{ord.status}</span>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>Rs. {ord.netAmount?.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
                {/* Audit Logs */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Activity Logs</div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, maxHeight: 130, overflowY: 'auto' }}>
                    {uLogs.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>No logs</div>
                      : uLogs.map((log: any, i: number) => (
                        <div key={i} style={{ padding: '7px 12px', borderBottom: i < uLogs.length-1 ? `1px solid ${C.border}` : 'none', fontSize: 11 }}>
                          <span style={{ fontWeight: 700, color: C.accent }}>[{log.action}]</span> <span style={{ color: C.textMid }}>{log.details}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Document Lightbox */}
      {docViewer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setDocViewer(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
          <img src={docViewer.images[docViewer.index]} alt="Document" style={{ maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }} />
          {docViewer.images.length > 1 && (
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
              {docViewer.images.map((_, i) => (
                <button key={i} onClick={() => setDocViewer({ ...docViewer, index: i })} style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === docViewer.index ? '#fff' : 'rgba(255,255,255,0.35)', padding: 0 }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Real-time Toast Notifications ── */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          display: 'flex', flexDirection: 'column', gap: 10,
          zIndex: 9999, maxWidth: 380,
        }}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 16px', borderRadius: 10,
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                background: toast.type === 'success' ? '#ECFDF5' : toast.type === 'warning' ? '#FFFBEB' : '#EFF6FF',
                border: `1.5px solid ${toast.type === 'success' ? '#A7F3D0' : toast.type === 'warning' ? '#FDE68A' : '#BFDBFE'}`,
                color: toast.type === 'success' ? '#065F46' : toast.type === 'warning' ? '#92400E' : '#1E40AF',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                animation: 'slideInRight 0.3s ease',
              }}
            >
              <span style={{ flex: 1, lineHeight: 1.5 }}>{toast.message}</span>
              <span style={{ fontSize: 14, opacity: 0.45, flexShrink: 0 }}>✕</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
