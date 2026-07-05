'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package, ShoppingBag, ShieldAlert, TrendingUp,
  Receipt, Clock, SlidersHorizontal, Activity,
  X, Bell, Zap, Users, AlertTriangle, CheckCircle,
  BarChart2, ArrowUpRight, RefreshCw, Maximize2, Minimize2
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
      <div style={{ background: '#FFFFFF', border: '1.5px solid #FDE68A', padding: '12px 16px', borderRadius: 12, boxShadow: '0 10px 25px rgba(245,158,11,0.12)' }}>
        <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ fontSize: 12, fontWeight: 700, color: p.color }}>
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
  const [showQuickOrderModal, setShowQuickOrderModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [activeChart, setActiveChart] = useState<'bar' | 'area'>('area');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [widgets, setWidgets] = useState({
    stats: true,
    charts: true,
    quickActions: true,
    logs: true,
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Keep fullscreen state in sync
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('alert') === 'true') {
        setShowAlertModal(true);
      }
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
    {
      title: 'Active Medicine Catalog',
      value: metrics.productCount.toLocaleString(),
      unit: 'SKUs',
      delta: `${metrics.totalStockQty.toLocaleString()} base units`,
      icon: Package,
      color: '#3B82F6',
      bg: 'rgba(59, 130, 246, 0.06)',
      borderColor: 'rgba(59,130,246,0.2)',
      link: '/retailer/inventory',
      trend: 'up',
    },
    {
      title: 'Pending B2B Orders',
      value: metrics.pendingPurchases.toLocaleString(),
      unit: 'Orders',
      delta: 'Transit & awaiting delivery',
      icon: Clock,
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.06)',
      borderColor: 'rgba(245,158,11,0.2)',
      link: '/retailer/orders',
      trend: 'neutral',
    },
    {
      title: 'B2C Sales Revenue',
      value: `Rs. ${metrics.totalSalesRevenue.toLocaleString()}`,
      unit: '',
      delta: `Margin ≈ ${marginPct}%`,
      icon: TrendingUp,
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.06)',
      borderColor: 'rgba(16,185,129,0.2)',
      link: '/retailer/billing',
      trend: Number(marginPct) > 0 ? 'up' : 'down',
    },
    {
      title: 'B2C Online Orders',
      value: ((metrics.consumerOrderPending || 0) + (metrics.consumerOrderShipped || 0)).toLocaleString(),
      unit: 'Active',
      delta: `${metrics.consumerOrderDelivered || 0} delivered · ${metrics.consumerOrderShipped || 0} shipped · ${metrics.consumerOrderPending || 0} pending`,
      icon: ShoppingBag,
      color: '#EC4899',
      bg: 'rgba(236,72,153,0.06)',
      borderColor: 'rgba(236,72,153,0.2)',
      link: '/retailer/orders',
      trend: 'neutral',
    },
    {
      title: 'Near Expiry Batches',
      value: metrics.nearExpiryCount.toLocaleString(),
      unit: 'Batches',
      delta: 'Expiring within 30 days',
      icon: ShieldAlert,
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.06)',
      borderColor: 'rgba(239,68,68,0.2)',
      link: '/retailer/inventory',
      trend: metrics.nearExpiryCount > 0 ? 'down' : 'up',
    },
    {
      title: 'Lifetime Procurement',
      value: `Rs. ${metrics.lifetimeSpend.toLocaleString()}`,
      unit: '',
      delta: `Credit ceiling: Rs. ${metrics.creditLimit.toLocaleString()}`,
      icon: ShoppingBag,
      color: '#8B5CF6',
      bg: 'rgba(139, 92, 246, 0.06)',
      borderColor: 'rgba(139,92,246,0.2)',
      link: '/retailer/orders',
      trend: 'neutral',
    },
  ];

  const quickActions = [
    {
      label: 'Open POS Counter',
      desc: 'Start B2C retail billing',
      icon: Receipt,
      href: '/retailer/pos',
      color: '#F59E0B',
      bg: '#F59E0B',
    },
    {
      label: 'Place B2B Order',
      desc: 'Order from wholesaler',
      icon: ShoppingBag,
      href: '/retailer/orders?new=true',
      color: '#3B82F6',
      bg: '#3B82F6',
    },
    {
      label: 'Intake Delivery',
      desc: 'Scan package barcode',
      icon: Package,
      href: '/retailer/orders',
      color: '#10B981',
      bg: '#10B981',
    },
    {
      label: 'View Expiry Alerts',
      desc: `${metrics.nearExpiryCount} batches expiring`,
      icon: AlertTriangle,
      href: '#',
      color: '#EF4444',
      bg: '#EF4444',
      onClick: () => setShowAlertModal(true),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '24px 0' }}>

      {/* ── Pending Return Verification Alerts Panel ── */}
      {returnAlerts.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(217,119,6,0.04))',
            border: '1.5px solid rgba(245,158,11,0.4)',
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock style={{ width: 16, height: 16, color: '#D97706' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#92400E' }}>
                Pending Return Verification Request
              </div>
              <div style={{ fontSize: 11, color: '#D97706', marginTop: 1 }}>
                Wholesaler(s) have requested returns on {returnAlerts.length} delivered order{returnAlerts.length !== 1 ? 's' : ''}. Please verify to sync stock.
              </div>
            </div>
            <div style={{ marginLeft: 'auto', background: '#D97706', color: 'white', fontSize: 11, fontWeight: 900, borderRadius: 20, padding: '2px 10px' }}>
              Action Required
            </div>
          </div>

          {/* Return Request Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {returnAlerts.map((r: any, idx: number) => (
              <div
                key={r.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: idx < returnAlerts.length - 1 ? '1px solid rgba(245,158,11,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package style={{ width: 16, height: 16, color: '#D97706' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B' }}>
                      {r.wholesaler?.companyName}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Order Ref: #{r.orderId.substring(0, 8).toUpperCase()}
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 200, fontSize: 12, color: '#475569' }}>
                  <strong>Reason:</strong> {r.reason || 'None specified'}<br/>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Submitted on: {new Date(r.createdAt).toLocaleDateString()}</span>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    disabled={!!returnVerifyLoading}
                    onClick={() => handleVerifyReturn(r.id, 'APPROVED')}
                    style={{
                      padding: '8px 14px', borderRadius: 8, background: '#10B981', color: 'white', border: 'none',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                    }}
                  >
                    {returnVerifyLoading === r.id ? 'Processing...' : 'Verify return'}
                  </button>
                  <button
                    disabled={!!returnVerifyLoading}
                    onClick={() => handleVerifyReturn(r.id, 'REJECTED')}
                    style={{
                      padding: '8px 14px', borderRadius: 8, background: 'none', color: '#EF4444', border: '1.5px solid #EF4444',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer'
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rejected Settlement Alerts Panel ── */}
      {rejectedSettlements.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.07), rgba(244,63,94,0.04))',
            border: '1.5px solid rgba(239,68,68,0.4)',
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle style={{ width: 16, height: 16, color: '#DC2626' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#991B1B' }}>
                Payment Settlement Rejected by Wholesaler
              </div>
              <div style={{ fontSize: 11, color: '#DC2626', marginTop: 1 }}>
                {rejectedSettlements.length} settlement request{rejectedSettlements.length !== 1 ? 's' : ''} rejected. Please re-submit payment or settle immediately.
              </div>
            </div>
            <div style={{ marginLeft: 'auto', background: '#DC2626', color: 'white', fontSize: 11, fontWeight: 900, borderRadius: 20, padding: '2px 10px' }}>
              Action Required
            </div>
          </div>

          {/* Settlement Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {rejectedSettlements.map((s: any, idx: number) => (
              <div
                key={s.id}
                style={{
                  padding: '16px 20px',
                  borderBottom: idx < rejectedSettlements.length - 1 ? '1px solid rgba(239,68,68,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                {/* Wholesaler Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users style={{ width: 16, height: 16, color: '#DC2626' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B' }}>
                      {s.wholesaler?.companyName || 'Wholesaler'}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                      Order #{s.id.substring(0, 8).toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Amount & Method */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Rejected Amount</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#DC2626', fontFamily: 'monospace', marginTop: 2 }}>
                      Rs. {s.settleAmount?.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Method Attempted</div>
                    <div style={{ fontSize: 12, fontWeight: 850, color: '#475569', marginTop: 2 }}>{s.settleMethod || 'CASH'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Total Invoice Amount</div>
                    <div style={{ fontSize: 13, fontWeight: 850, color: '#1E293B', marginTop: 2 }}>Rs. {s.netAmount?.toLocaleString()}</div>
                  </div>
                </div>

                {/* Settle manually button */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link
                    href="/retailer/billing"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', color: 'white', fontSize: 11, fontWeight: 850, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Go to Billing & Settle
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 900, fontSize: 20 }}>
              R
            </div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1E293B', margin: 0 }}>
                {metrics.pharmacyName}
              </h1>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Retail Pharmacy Dashboard · Node Overview</p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {metrics.nearExpiryCount > 0 && (
            <button
              onClick={() => setShowAlertModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              <Bell style={{ width: 14, height: 14 }} />
              {metrics.nearExpiryCount} Expiry Alert{metrics.nearExpiryCount > 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: isFullscreen ? '#1E293B' : '#FFFFFF', color: isFullscreen ? '#F59E0B' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {isFullscreen ? <Minimize2 style={{ width: 14, height: 14 }} /> : <Maximize2 style={{ width: 14, height: 14 }} />}
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            <SlidersHorizontal style={{ width: 14, height: 14 }} />
            Configure
          </button>
          <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))', border: '1.5px solid rgba(245,158,11,0.25)', padding: '8px 16px', borderRadius: 10, textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase' }}>B2B Credit Ceiling</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#F59E0B' }}>Rs. {metrics.creditLimit.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Widget Configure */}
      {showConfig && (
        <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: '14px 20px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', alignSelf: 'center' }}>Panels:</span>
          {Object.keys(widgets).map((key) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(widgets as any)[key]}
                onChange={() => setWidgets({ ...widgets, [key]: !(widgets as any)[key] })}
                style={{ width: 14, height: 14, accentColor: '#F59E0B' }}
              />
              {key.toUpperCase()}
            </label>
          ))}
        </div>
      )}

      {/* ── KPI Cards ── */}
      {widgets.stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.link}
                onClick={card.title === 'Near Expiry Batches' && metrics.nearExpiryCount > 0 ? (e) => { e.preventDefault(); setShowAlertModal(true); } : undefined}
                style={{
                  background: '#FFFFFF',
                  border: `1.5px solid ${card.borderColor}`,
                  borderRadius: 16,
                  padding: 22,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${card.color}20`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.3 }}>
                    {card.title}
                  </span>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 18, height: 18, color: card.color }} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#1E293B', lineHeight: 1 }}>
                    {card.value}
                    {card.unit && <span style={{ fontSize: 13, color: '#94A3B8', marginLeft: 4, fontWeight: 600 }}>{card.unit}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {card.trend === 'up' && <ArrowUpRight style={{ width: 12, height: 12, color: '#10B981' }} />}
                    {card.delta}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Charts Section ── */}
      {widgets.charts && (
        <div style={{ background: '#FFFFFF', borderRadius: 18, border: '1.5px solid #F1F5F9', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0 }}>Revenue vs. Procurement Ledger</h3>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>6-month B2C sales income against B2B wholesale spend</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['area', 'bar'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveChart(type)}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: activeChart === type ? '#F59E0B' : '#FFFFFF', color: activeChart === type ? '#FFFFFF' : '#475569', transition: 'all 0.15s' }}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              {activeChart === 'area' ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#475569" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#475569" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="Sales" stroke="#F59E0B" strokeWidth={2.5} fill="url(#gSales)" dot={{ fill: '#F59E0B', r: 4 }} />
                  <Area type="monotone" dataKey="Spend" stroke="#475569" strokeWidth={2.5} fill="url(#gSpend)" dot={{ fill: '#475569', r: 4 }} />
                </AreaChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="Sales" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Spend" fill="#475569" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {/* Margin summary */}
          <div style={{ display: 'flex', gap: 16, paddingTop: 12, borderTop: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Revenue', val: `Rs. ${metrics.totalSalesRevenue.toLocaleString()}`, color: '#F59E0B' },
              { label: 'Total Spend', val: `Rs. ${metrics.lifetimeSpend.toLocaleString()}`, color: '#475569' },
              { label: 'Net Margin', val: `Rs. ${margin.toLocaleString()} (${marginPct}%)`, color: margin >= 0 ? '#10B981' : '#EF4444' },
            ].map((s) => (
              <div key={s.label} style={{ flex: 1, minWidth: 120, background: '#F8FAFC', padding: '12px 16px', borderRadius: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{s.label}</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: s.color, marginTop: 4 }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Actions + Audit Logs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: 24, alignItems: 'start' }}>

        {/* Quick Actions */}
        {widgets.quickActions && (
          <div style={{ background: '#FFFFFF', borderRadius: 18, border: '1.5px solid #F1F5F9', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0 }}>Quick Launchpad</h3>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>Frequently used operations and shortcuts</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    onClick={action.onClick ? (e) => { e.preventDefault(); action.onClick!(); } : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '16px 18px',
                      borderRadius: 14,
                      background: `${action.color}08`,
                      border: `1.5px solid ${action.color}20`,
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = `${action.color}15`;
                      (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = `${action.color}08`;
                      (e.currentTarget as HTMLElement).style.transform = 'none';
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon style={{ width: 18, height: 18, color: '#FFFFFF' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>{action.label}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{action.desc}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Stats mini-bar */}
            <div style={{ display: 'flex', gap: 1, overflow: 'hidden', borderRadius: 8, marginTop: 4 }}>
              {[
                { label: 'SKUs', val: metrics.productCount, color: '#3B82F6' },
                { label: 'Pending', val: metrics.pendingPurchases, color: '#F59E0B' },
                { label: 'Expiry', val: metrics.nearExpiryCount, color: '#EF4444' },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{ flex: 1, background: `${s.color}10`, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Logs Panel */}
        {widgets.logs && (
          <div style={{ background: '#FFFFFF', borderRadius: 18, border: '1.5px solid #F1F5F9', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0 }}>Activity Log</h3>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>Audit trail for this node</p>
              </div>
              <Activity style={{ width: 16, height: 16, color: '#94A3B8' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 340, overflowY: 'auto' }}>
              {auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', fontSize: 12, color: '#94A3B8' }}>No activity logs yet</div>
              ) : (
                auditLogs.slice(0, 12).map((log, idx) => (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #F8FAFC', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
                      {idx < auditLogs.length - 1 && <div style={{ flex: 1, width: 1, background: '#F1F5F9', marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#334155', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.action}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.details}</div>
                      <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2 }}>{new Date(log.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Expiry Alerts Modal ── */}
      {showAlertModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 480, background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #FEE2E2', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle style={{ width: 20, height: 20, color: '#EF4444' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0 }}>Expiry Alerts</h3>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{metrics.nearExpiryCount} batch(es) expiring in 30 days</p>
                </div>
              </div>
              <button onClick={() => setShowAlertModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div style={{ padding: '16px', background: 'rgba(239,68,68,0.04)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.12)', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
              <strong>{metrics.nearExpiryCount}</strong> inventory batches are expiring within the next <strong>30 days</strong>. Please review your inventory to take action — issue discounts, return to supplier, or expedite sales for near-expiry stock.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowAlertModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                Dismiss
              </button>
              <Link
                href="/retailer/inventory"
                onClick={() => setShowAlertModal(false)}
                style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: '#EF4444', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}
              >
                <ShieldAlert style={{ width: 15, height: 15 }} />
                View Inventory
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Log Detail Modal ── */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 420, background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity style={{ width: 18, height: 18, color: '#F59E0B' }} />
                Activity Detail
              </h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Action</span>
                <span style={{ fontWeight: 800, color: '#1E293B' }}>{selectedLog.action}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Details</span>
                <span style={{ color: '#475569', lineHeight: 1.5 }}>{selectedLog.details}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Timestamp</span>
                <span style={{ color: '#475569', fontFamily: 'monospace' }}>{new Date(selectedLog.timestamp).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Log ID</span>
                <span style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: 11 }}>{selectedLog.id}</span>
              </div>
            </div>
            <button onClick={() => setSelectedLog(null)} style={{ padding: '12px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', marginTop: 8 }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
