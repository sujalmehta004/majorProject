'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package, ShoppingBag, ShieldAlert, TrendingUp,
  Receipt, Clock, SlidersHorizontal, Activity,
  X, Bell, AlertTriangle,
  ArrowUpRight, Maximize2, Minimize2,
  ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

interface DashboardClientProps {
  profileId: string;
  metrics: {
    productCount: number;
    totalStockQty: number;
    pendingPurchases: number;
    nearExpiryCount: number;
    totalSalesRevenue: number;
    creditLimit: number;
    lifetimeSpend: number;
    pharmacyName: string;
    consumerOrderPending?: number;
    consumerOrderShipped?: number;
    consumerOrderDelivered?: number;
  };
  auditLogs: AuditLog[];
  rejectedSettlements?: any[];
  pendingReturns?: any[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4, textTransform: 'uppercase' as const }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ fontSize: 13, fontWeight: 600, color: p.color, margin: '2px 0' }}>
            {p.name}: Rs. {(p.value || 0).toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardClient({ profileId, metrics, auditLogs, rejectedSettlements = [], pendingReturns = [] }: DashboardClientProps) {
  const [returnAlerts, setReturnAlerts] = useState<any[]>(pendingReturns);
  const [returnVerifyLoading, setReturnVerifyLoading] = useState<string | null>(null);

  const handleVerifyReturn = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    setReturnVerifyLoading(requestId);
    try {
      const res = await fetch(`/api/retailer/returns/${requestId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setReturnAlerts(prev => prev.filter(r => r.id !== requestId));
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    } finally {
      setReturnVerifyLoading(null);
    }
  };

  const [showConfig, setShowConfig] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [activeChart, setActiveChart] = useState<'bar' | 'area'>('area');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [widgets, setWidgets] = useState({ stats: true, charts: true, quickActions: true, logs: true });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('alert') === 'true') setShowAlertModal(true);
    }
  }, []);

  const margin = metrics.totalSalesRevenue - metrics.lifetimeSpend;
  const marginPct = metrics.lifetimeSpend > 0 ? ((margin / metrics.lifetimeSpend) * 100).toFixed(1) : '0.0';

  const chartData = [
    { name: 'Jan', Sales: Math.round(metrics.totalSalesRevenue * 0.15), Spend: Math.round(metrics.lifetimeSpend * 0.12) },
    { name: 'Feb', Sales: Math.round(metrics.totalSalesRevenue * 0.28), Spend: Math.round(metrics.lifetimeSpend * 0.22) },
    { name: 'Mar', Sales: Math.round(metrics.totalSalesRevenue * 0.42), Spend: Math.round(metrics.lifetimeSpend * 0.35) },
    { name: 'Apr', Sales: Math.round(metrics.totalSalesRevenue * 0.58), Spend: Math.round(metrics.lifetimeSpend * 0.52) },
    { name: 'May', Sales: Math.round(metrics.totalSalesRevenue * 0.78), Spend: Math.round(metrics.lifetimeSpend * 0.73) },
    { name: 'Jun', Sales: Math.round(metrics.totalSalesRevenue), Spend: Math.round(metrics.lifetimeSpend) },
  ];

  const kpiCards = [
    { title: 'Medicine Catalog', value: metrics.productCount.toLocaleString(), unit: 'SKUs', sub: `${metrics.totalStockQty.toLocaleString()} base units`, icon: Package, color: '#3B82F6', link: '/retailer/inventory' },
    { title: 'Pending B2B Orders', value: metrics.pendingPurchases.toLocaleString(), unit: 'Orders', sub: 'Transit & awaiting delivery', icon: Clock, color: '#F59E0B', link: '/retailer/orders' },
    { title: 'B2C Sales Revenue', value: `Rs. ${metrics.totalSalesRevenue.toLocaleString()}`, unit: '', sub: `Margin ~ ${marginPct}%`, icon: TrendingUp, color: '#10B981', link: '/retailer/billing' },
    { title: 'B2C Online Orders', value: ((metrics.consumerOrderPending || 0) + (metrics.consumerOrderShipped || 0)).toLocaleString(), unit: 'Active', sub: `${metrics.consumerOrderDelivered || 0} delivered`, icon: ShoppingBag, color: '#EC4899', link: '/retailer/orders' },
    { title: 'Near Expiry Batches', value: metrics.nearExpiryCount.toLocaleString(), unit: 'Batches', sub: 'Expiring within 30 days', icon: ShieldAlert, color: '#EF4444', link: '/retailer/inventory' },
    { title: 'Lifetime Procurement', value: `Rs. ${metrics.lifetimeSpend.toLocaleString()}`, unit: '', sub: `Credit: Rs. ${metrics.creditLimit.toLocaleString()}`, icon: ShoppingBag, color: '#8B5CF6', link: '/retailer/orders' },
  ];

  const quickActions = [
    { label: 'Open POS Counter', desc: 'Start B2C retail billing', icon: Receipt, href: '/retailer/pos', color: '#F59E0B', onClick: null as any },
    { label: 'Place B2B Order', desc: 'Order from wholesaler', icon: ShoppingBag, href: '/retailer/orders?new=true', color: '#3B82F6', onClick: null as any },
    { label: 'Intake Delivery', desc: 'Scan package barcode', icon: Package, href: '/retailer/orders', color: '#10B981', onClick: null as any },
    { label: 'View Expiry Alerts', desc: `${metrics.nearExpiryCount} batches expiring`, icon: AlertTriangle, href: '#', color: '#EF4444', onClick: () => setShowAlertModal(true) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Pending Return Verification Alert */}
      {returnAlerts.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock style={{ width: 15, height: 15, color: '#D97706', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Pending Return Verification</span>
              <span style={{ fontSize: 13, color: '#B45309', marginLeft: 8 }}>
                {returnAlerts.length} request{returnAlerts.length !== 1 ? 's' : ''} need your action
              </span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 20, padding: '2px 10px' }}>Action Required</span>
          </div>
          <div>
            {returnAlerts.map((r: any, idx: number) => (
              <div key={r.id} style={{ padding: '14px 20px', borderBottom: idx < returnAlerts.length - 1 ? '1px solid #FEF3C7' : 'none', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{r.wholesaler?.companyName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Order #{r.orderId.substring(0, 8).toUpperCase()} &middot; {new Date(r.createdAt).toLocaleDateString()}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Reason: {r.reason || 'None specified'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={!!returnVerifyLoading} onClick={() => handleVerifyReturn(r.id, 'APPROVED')} style={{ padding: '7px 14px', borderRadius: 8, background: '#10B981', color: '#FFFFFF', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {returnVerifyLoading === r.id ? 'Processing...' : 'Approve'}
                  </button>
                  <button disabled={!!returnVerifyLoading} onClick={() => handleVerifyReturn(r.id, 'REJECTED')} style={{ padding: '7px 14px', borderRadius: 8, background: '#FFFFFF', color: '#EF4444', border: '1px solid #EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Settlement Alert */}
      {rejectedSettlements.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle style={{ width: 15, height: 15, color: '#DC2626', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>Payment Settlement Rejected</span>
              <span style={{ fontSize: 13, color: '#B91C1C', marginLeft: 8 }}>
                {rejectedSettlements.length} rejected by wholesaler
              </span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 20, padding: '2px 10px' }}>Action Required</span>
          </div>
          <div>
            {rejectedSettlements.map((s: any, idx: number) => (
              <div key={s.id} style={{ padding: '14px 20px', borderBottom: idx < rejectedSettlements.length - 1 ? '1px solid #FEE2E2' : 'none', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
                <div style={{ minWidth: 180, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{s.wholesaler?.companyName || 'Wholesaler'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Order #{s.id.substring(0, 8).toUpperCase()}</div>
                </div>
                <div style={{ display: 'flex', gap: 24, flex: 1, flexWrap: 'wrap' as const }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Rejected Amt</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#DC2626', marginTop: 2 }}>Rs. {s.settleAmount?.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Method</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>{s.settleMethod || 'CASH'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Invoice Total</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>Rs. {s.netAmount?.toLocaleString()}</div>
                  </div>
                </div>
                <Link href="/retailer/billing" style={{ padding: '7px 14px', borderRadius: 8, background: '#FFFFFF', color: '#7C3AED', border: '1px solid #C4B5FD', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                  Go to Billing
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' as const, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{metrics.pharmacyName}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Retail Pharmacy Dashboard &middot; Node Overview</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
          {metrics.nearExpiryCount > 0 && (
            <button onClick={() => setShowAlertModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Bell style={{ width: 14, height: 14 }} />
              {metrics.nearExpiryCount} Expiry Alert{metrics.nearExpiryCount > 1 ? 's' : ''}
            </button>
          )}
          <button onClick={toggleFullscreen} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {isFullscreen ? <Minimize2 style={{ width: 14, height: 14 }} /> : <Maximize2 style={{ width: 14, height: 14 }} />}
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>
          <button onClick={() => setShowConfig(!showConfig)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <SlidersHorizontal style={{ width: 14, height: 14 }} />
            Configure
          </button>
          <div style={{ border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: '7px 14px', borderRadius: 8, textAlign: 'right' as const }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const }}>B2B Credit</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F59E0B' }}>Rs. {metrics.creditLimit.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Widget Configure */}
      {showConfig && (
        <div style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 18px', display: 'flex', gap: 20, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>Show Panels:</span>
          {Object.keys(widgets).map((key) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={(widgets as any)[key]} onChange={() => setWidgets({ ...widgets, [key]: !(widgets as any)[key] })} style={{ width: 14, height: 14, accentColor: '#F59E0B' }} />
              {key.toUpperCase()}
            </label>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      {widgets.stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.link}
                onClick={card.title === 'Near Expiry Batches' && metrics.nearExpiryCount > 0 ? (e) => { e.preventDefault(); setShowAlertModal(true); } : undefined}
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column' as const, gap: 10, cursor: 'pointer', textDecoration: 'none', transition: 'border-color 0.15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = card.color; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--card-border)'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{card.title}</span>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${card.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 15, height: 15, color: card.color }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {card.value}
                    {card.unit && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 500 }}>{card.unit}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{card.sub}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Charts */}
      {widgets.charts && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' as const, gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Revenue vs. Procurement</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>6-month B2C sales vs B2B spend</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['area', 'bar'] as const).map((type) => (
                <button key={type} onClick={() => setActiveChart(type)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--card-border)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: activeChart === type ? '#F59E0B' : 'var(--card-bg)', color: activeChart === type ? '#FFFFFF' : 'var(--text-secondary)' }}>
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              {activeChart === 'area' ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gSales2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSpend2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748B" stopOpacity={0.07} />
                      <stop offset="95%" stopColor="#64748B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="Sales" stroke="#F59E0B" strokeWidth={2} fill="url(#gSales2)" dot={{ fill: '#F59E0B', r: 3 }} />
                  <Area type="monotone" dataKey="Spend" stroke="#64748B" strokeWidth={2} fill="url(#gSpend2)" dot={{ fill: '#64748B', r: 3 }} />
                </AreaChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Sales" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Spend" fill="#64748B" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '1px solid var(--card-border)', marginTop: 14, flexWrap: 'wrap' as const }}>
            {[
              { label: 'Total Revenue', val: `Rs. ${metrics.totalSalesRevenue.toLocaleString()}`, color: '#F59E0B' },
              { label: 'Total Spend', val: `Rs. ${metrics.lifetimeSpend.toLocaleString()}`, color: 'var(--text-secondary)' },
              { label: 'Net Margin', val: `Rs. ${margin.toLocaleString()} (${marginPct}%)`, color: margin >= 0 ? '#10B981' : '#EF4444' },
            ].map((s) => (
              <div key={s.label} style={{ flex: 1, minWidth: 110, background: 'var(--table-header-bg)', padding: '10px 14px', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions + Audit Logs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, alignItems: 'start' }}>

        {widgets.quickActions && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', padding: '20px 24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 14px' }}>Quick Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    onClick={action.onClick ? (e) => { e.preventDefault(); action.onClick(); } : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', textDecoration: 'none', cursor: 'pointer', transition: 'border-color 0.15s' }}
                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = action.color; }}
                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--card-border)'; }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${action.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 15, height: 15, color: action.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{action.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{action.desc}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--card-border)' }}>
              {[
                { label: 'SKUs', val: metrics.productCount, color: '#3B82F6' },
                { label: 'Pending', val: metrics.pendingPurchases, color: '#F59E0B' },
                { label: 'Expiry', val: metrics.nearExpiryCount, color: '#EF4444' },
              ].map((s) => (
                <div key={s.label} style={{ flex: 1, background: 'var(--table-header-bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {widgets.logs && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Activity Log</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>Audit trail for this node</p>
              </div>
              <Activity style={{ width: 15, height: 15, color: 'var(--text-muted)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, maxHeight: 300, overflowY: 'auto' as const }}>
              {auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center' as const, padding: '24px', fontSize: 13, color: 'var(--text-muted)' }}>No activity logs yet</div>
              ) : (
                auditLogs.slice(0, 12).map((log, idx) => (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: idx < Math.min(auditLogs.length, 12) - 1 ? '1px solid var(--card-border)' : 'none', background: 'none', textAlign: 'left' as const, cursor: 'pointer', width: '100%' }}
                  >
                    <div style={{ paddingTop: 4, flexShrink: 0 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#F59E0B' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.action}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.details}</div>
                      <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 1 }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
            {auditLogs.length > 12 && (
              <Link href="/retailer/settings?tab=logs" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 12, fontWeight: 600, color: '#F59E0B', textDecoration: 'none' }}>
                View all {auditLogs.length} logs <ChevronRight style={{ width: 13, height: 13 }} />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Expiry Alerts Modal */}
      {showAlertModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 440, background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', padding: '22px 26px', display: 'flex', flexDirection: 'column' as const, gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle style={{ width: 16, height: 16, color: '#EF4444' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Expiry Alerts</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>{metrics.nearExpiryCount} batch(es) expiring in 30 days</p>
                </div>
              </div>
              <button onClick={() => setShowAlertModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ padding: '12px 14px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>{metrics.nearExpiryCount}</strong> inventory batches are expiring within the next <strong>30 days</strong>. Review your inventory, issue discounts, return to supplier, or expedite sales.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAlertModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>
                Dismiss
              </button>
              <Link href="/retailer/inventory" onClick={() => setShowAlertModal(false)} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#EF4444', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}>
                <ShieldAlert style={{ width: 14, height: 14 }} />
                View Inventory
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Activity Log Detail Modal */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 400, background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', padding: '22px 26px', display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity style={{ width: 15, height: 15, color: '#F59E0B' }} />
                Activity Detail
              </h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {[
                { label: 'Action', val: selectedLog.action, mono: false },
                { label: 'Details', val: selectedLog.details, mono: false },
                { label: 'Timestamp', val: new Date(selectedLog.timestamp).toLocaleString(), mono: true },
                { label: 'Log ID', val: selectedLog.id, mono: true },
              ].map(({ label, val, mono }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: mono ? 'monospace' : 'inherit', lineHeight: 1.5 }}>{val}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedLog(null)} style={{ padding: '10px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', marginTop: 2 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
