'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Package, Database, ShieldAlert, ArrowRight, Activity, Receipt, 
  Settings, CheckSquare, Square, AlertTriangle, Users, MapPin, Truck,
  LayoutDashboard, TrendingUp, Zap
} from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  user: {
    email: string;
    fullName?: string | null;
  } | null;
}

interface DashboardClientProps {
  metrics: {
    productCount: number;
    activeBatches: number;
    pendingOrders: number;
    dispatchedOrders: number;
    nearExpiryCount: number;
    totalRevenue: number;
    estimatedProfit: number;
    staffCount: number;
    latitude: number | null;
    longitude: number | null;
    companyName: string;
  };
  auditLogs: AuditLog[];
}

export default function DashboardClient({ metrics, auditLogs }: DashboardClientProps) {
  const [widgets, setWidgets] = useState({
    medicinesRegistered: true,
    activeBatches: true,
    pendingOrders: true,
    inTransitDeliveries: true,
    nearExpiryAlerts: true,
    financialLedger: true,
    recentActivity: true,
    terminalStatus: true,
    quickActions: true,
  });

  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('medhub_dashboard_widgets');
    if (saved) {
      try {
        setWidgets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse dashboard widgets config', e);
      }
    }
  }, []);

  const toggleWidget = (key: keyof typeof widgets) => {
    const updated = { ...widgets, [key]: !widgets[key] };
    setWidgets(updated);
    localStorage.setItem('medhub_dashboard_widgets', JSON.stringify(updated));
  };

  const statCards = [
    {
      key: 'medicinesRegistered',
      label: 'Medicines Registered',
      value: metrics.productCount,
      unit: 'SKUs',
      icon: Package,
      href: '/wholesaler/inventory',
      color: '#F97316',
      bg: '#FFF7ED',
    },
    {
      key: 'activeBatches',
      label: 'Active Batches',
      value: metrics.activeBatches,
      unit: 'batches',
      icon: Database,
      href: '/wholesaler/inventory',
      color: '#0EA5E9',
      bg: '#F0F9FF',
    },
    {
      key: 'pendingOrders',
      label: 'Pending Orders',
      value: metrics.pendingOrders,
      unit: 'orders',
      icon: ShieldAlert,
      href: '/wholesaler/orders',
      color: metrics.pendingOrders > 0 ? '#DC2626' : '#64748B',
      bg: metrics.pendingOrders > 0 ? '#FEF2F2' : '#F8FAFC',
    },
    {
      key: 'inTransitDeliveries',
      label: 'In-Transit',
      value: metrics.dispatchedOrders,
      unit: 'shipped',
      icon: Truck,
      href: '/wholesaler/orders',
      color: '#10B981',
      bg: '#ECFDF5',
    },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(186,230,253,0.5)',
          borderRadius: 20,
          padding: '20px 24px',
          boxShadow: '0 2px 12px rgba(14,165,233,0.07)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#1E293B',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <LayoutDashboard style={{ width: 22, height: 22, color: '#F97316' }} />
            Operations Overview
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            Real-time summary of your wholesale supply chain — {metrics.companyName}
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Settings style={{ width: 14, height: 14, color: '#F97316' }} />
            Customize Widgets
          </button>
          {showConfig && (
            <div
              className="animate-scaleIn"
              style={{
                position: 'absolute',
                right: 0,
                marginTop: 8,
                zIndex: 20,
                width: 260,
                background: 'rgba(255,255,255,0.98)',
                border: '1.5px solid #E0F2FE',
                borderRadius: 14,
                padding: '16px',
                boxShadow: '0 12px 40px rgba(14,165,233,0.15)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#94A3B8',
                  paddingBottom: 10,
                  marginBottom: 10,
                  borderBottom: '1px solid #F1F5F9',
                }}
              >
                Toggle Widgets
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { key: 'medicinesRegistered', label: 'Medicines Stat' },
                  { key: 'activeBatches', label: 'Active Batches' },
                  { key: 'pendingOrders', label: 'Pending Orders' },
                  { key: 'inTransitDeliveries', label: 'In-Transit' },
                  { key: 'nearExpiryAlerts', label: 'Near-Expiry Alerts' },
                  { key: 'financialLedger', label: 'Revenue & Profits' },
                  { key: 'recentActivity', label: 'Activity Logs' },
                  { key: 'terminalStatus', label: 'Terminal Status' },
                  { key: 'quickActions', label: 'Quick Actions' },
                ].map((w) => {
                  const isActive = widgets[w.key as keyof typeof widgets];
                  return (
                    <button
                      key={w.key}
                      onClick={() => toggleWidget(w.key as keyof typeof widgets)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 8px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: isActive ? '#1E293B' : '#94A3B8',
                        fontFamily: 'inherit',
                      }}
                    >
                      {isActive ? (
                        <CheckSquare style={{ width: 14, height: 14, color: '#F97316', flexShrink: 0 }} />
                      ) : (
                        <Square style={{ width: 14, height: 14, color: '#CBD5E1', flexShrink: 0 }} />
                      )}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: isActive ? 'none' : 'line-through',
                        }}
                      >
                        {w.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Near-Expiry Alert Banner */}
      {widgets.nearExpiryAlerts && metrics.nearExpiryCount > 0 && (
        <div className="alert alert-warning animate-scaleIn" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                padding: 8,
                background: 'rgba(251,191,36,0.15)',
                borderRadius: 10,
                flexShrink: 0,
              }}
            >
              <AlertTriangle style={{ width: 18, height: 18, color: '#92400E' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Stock Expiry Warning
              </div>
              <p style={{ fontSize: 12, marginTop: 2 }}>
                <strong style={{ fontFamily: 'monospace' }}>{metrics.nearExpiryCount}</strong> batches expiring within 30 days. Review and clear before B2B allocation.
              </p>
            </div>
          </div>
          <Link href="/wholesaler/inventory" className="btn-ghost" style={{ whiteSpace: 'nowrap', fontSize: 11, padding: '6px 14px' }}>
            Review Stock
          </Link>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          if (!widgets[card.key as keyof typeof widgets]) return null;
          return (
            <Link key={card.key} href={card.href} className="stat-card" style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div
                  className="stat-card-icon"
                  style={{ background: card.bg, color: card.color }}
                >
                  <Icon style={{ width: 20, height: 20 }} />
                </div>
                <ArrowRight style={{ width: 14, height: 14, color: '#CBD5E1' }} />
              </div>
              <div>
                <div className="stat-card-label">{card.label}</div>
                <div className="stat-card-value" style={{ color: card.color }}>
                  {card.value}
                  <span className="stat-card-unit">{card.unit}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Financial Ledger Card */}
      {widgets.financialLedger && (
        <div className="finance-card">
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'rgba(255,255,255,0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 20,
                }}
              >
                <TrendingUp style={{ width: 14, height: 14, color: '#FB923C' }} />
                Financial Ledger Analysis
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 24,
                }}
              >
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Revenue</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: 4 }}>
                    Rs. {metrics.totalRevenue.toLocaleString()}
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Cumulative sales</p>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Est. Profit</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#FB923C', fontFamily: 'monospace', marginTop: 4 }}>
                    Rs. {metrics.estimatedProfit.toLocaleString()}
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Net on delivered</p>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Staff Accounts</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: '#FCD34D', fontFamily: 'monospace', marginTop: 4 }}>
                    {metrics.staffCount}
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginLeft: 6 }}>active</span>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Employee roster</p>
                </div>
              </div>
            </div>
            <div>
              <span
                style={{
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  color: '#FCA5A5',
                  fontFamily: 'monospace',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Verifier Active
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Activity Logs + Sidebar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 16,
        }}
      >
        {/* Activity Log Table */}
        {widgets.recentActivity && (
          <div
            className="card"
            style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #F1F5F9',
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: '#1E293B',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#F97316',
                    display: 'inline-block',
                  }}
                />
                Recent Operations Log
              </h3>
              <Link
                href="/wholesaler/logs"
                className="btn-ghost"
                style={{ padding: '4px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                View All <ArrowRight style={{ width: 11, height: 11 }} />
              </Link>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Details</th>
                    <th>Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>
                        No recent activity recorded.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748B', whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              fontFamily: 'monospace',
                              color: '#C2410C',
                              background: '#FFF7ED',
                              border: '1px solid #FED7AA',
                              padding: '2px 8px',
                              borderRadius: 6,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td
                          style={{ fontSize: 11, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={log.details}
                        >
                          {log.details}
                        </td>
                        <td style={{ fontSize: 10, color: '#64748B', fontFamily: 'monospace' }}>
                          {log.user ? (log.user.fullName || log.user.email.split('@')[0]) : 'System'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Terminal Status */}
          {widgets.terminalStatus && (
            <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 20 }}>
              <div
                style={{
                  borderBottom: '1px solid #F1F5F9',
                  paddingBottom: 12,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Activity style={{ width: 14, height: 14, color: '#F97316' }} />
                <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B' }}>
                  Terminal Node Info
                </h3>
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <MapPin style={{ width: 16, height: 16, color: '#F97316', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.06em' }}>GPS Node Location</div>
                  <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: '#1E293B', marginTop: 2 }}>
                    {metrics.latitude && metrics.longitude
                      ? `${metrics.latitude.toFixed(4)}N, ${metrics.longitude.toFixed(4)}E`
                      : 'UNCONFIGURED'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'System Monitor', value: <span className="status-pill status-pill-active">Stable</span> },
                  { label: 'Dispatch Queue', value: <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: '#1E293B' }}>FIFO ALGO</span> },
                  { label: 'Company Node', value: <span style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }} title={metrics.companyName}>{metrics.companyName}</span> },
                ].map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: i < 2 ? 8 : 0,
                      borderBottom: i < 2 ? '1px solid #F8FAFC' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{row.label}</span>
                    {row.value}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {widgets.quickActions && (
            <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 20 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#94A3B8',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Zap style={{ width: 12, height: 12, color: '#F97316' }} />
                Quick Actions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link href="/wholesaler/pos" className="btn-primary" style={{ justifyContent: 'center', width: '100%', textAlign: 'center' }}>
                  Launch POS Terminal
                </Link>
                <Link href="/wholesaler/inventory" className="btn-ghost" style={{ justifyContent: 'center', width: '100%', textAlign: 'center' }}>
                  Manage Stock Registry
                </Link>
                <Link href="/wholesaler/orders" className="btn-ghost" style={{ justifyContent: 'center', width: '100%', textAlign: 'center' }}>
                  View Pending Orders
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
