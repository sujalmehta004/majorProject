'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt, DollarSign, Clock, ArrowUpRight, ArrowDownRight,
  Printer, Send, Bell, Check, AlertCircle, CheckCircle, TrendingUp,
  SlidersHorizontal, X, ChevronDown, BarChart2, Calendar, FileText, Eye
} from 'lucide-react';
import { logActivity } from '@/components/WholesalerLayout';
import { useSSEListener } from '@/hooks/useRealtimeData';
import { BarChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

interface Retailer {
  id: string;
  pharmacyName: string;
  creditLimit: number;
  lifetimeSpend: number;
  registrationNumber: string;
  address: string;
  phone: string;
}

interface Product { id: string; name: string; sku: string; tabletsPerStrip: number; stripsPerBox: number; }
interface Batch { id: string; batchNumber: string; manufacturingCost: number; purchasePricePerBox: number; }
interface OrderAllocation { id: string; quantity: number; batch: Batch; }
interface OrderItem { id: string; productId: string; product: Product; quantity: number; pricePerUnit: number; allocations: OrderAllocation[]; }

interface Order {
  id: string;
  retailer: Retailer;
  status: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  overrideJustification?: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface BillingClientProps {
  profileId: string;
  initialOrders: Order[];
}

type TabType = 'transactions' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'fiscal';

const COLUMN_LABELS: Record<string, string> = {
  date: 'Billing Date',
  invoiceId: 'Invoice ID',
  customer: 'Customer',
  status: 'Status',
  net: 'Net Payable',
  profit: 'Profit',
  discount: 'Discount',
  actions: 'Actions',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.97)', border: '1.5px solid #E0F2FE', padding: '12px 16px', borderRadius: 12, boxShadow: '0 10px 25px rgba(14,165,233,0.1)' }}>
        <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ fontSize: 12, fontWeight: 700, color: p.color }}>
            {p.name}: Rs. {Number(p.value).toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function BillingClient({ profileId, initialOrders }: BillingClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('transactions');

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
    date: true, invoiceId: true, customer: true, status: true,
    net: true, profit: true, discount: true, actions: true
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // Fiscal year selector
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());

  // Invoice builder
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  const [customInvoiceTitle, setCustomInvoiceTitle] = useState('TAX INVOICE');
  const [customTerms, setCustomTerms] = useState('1. Goods once sold will not be taken back.\n2. Payment terms: Due on delivery.\n3. All disputes are subject to local jurisdiction.');
  const [customNotes, setCustomNotes] = useState('Thank you for your business! We appreciate your partnership.');

  // Period chart data
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Transaction trace panel
  const [traceOrder, setTraceOrder] = useState<Order | null>(null);

  // Partial payment settlements
  const [settlements, setSettlements] = useState<Record<string, number>>({});
  const [settleAmount, setSettleAmount] = useState('');
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('medhub_order_payments');
    if (stored) setSettlements(JSON.parse(stored));
  }, []);

  const handleSettleSubmit = (orderId: string, totalAmount: number) => {
    const currentPaid = settlements[orderId] || 0;
    const inputPaid = parseFloat(settleAmount) || 0;
    const finalPaid = Math.min(currentPaid + inputPaid, totalAmount);
    
    const updated = { ...settlements, [orderId]: finalPaid };
    setSettlements(updated);
    localStorage.setItem('medhub_order_payments', JSON.stringify(updated));
    setSettleAmount('');
    setSettlingOrderId(null);
    logActivity('SETTLE_PAYMENT', `Recorded payment of Rs.${inputPaid} for Order ${orderId}`);
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orders?wholesalerId=${profileId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bills');
      setOrders(data.orders);
    } catch (err: any) {
      setError(err.message || 'Failed to sync billing data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async (period: string) => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/wholesaler/analytics?period=${period}`);
      const data = await res.json();
      if (res.ok && data.data) setAnalyticsData(data.data);
    } catch (e) {}
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => {
    if (['daily', 'weekly', 'monthly', 'yearly'].includes(activeTab)) {
      fetchAnalytics(activeTab);
    }
  }, [activeTab]);

  // SSE live sync
  useSSEListener(profileId, (type) => {
    if (type === 'ORDER_CREATED' || type === 'ORDER_STATUS_CHANGED') {
      fetchOrders();
    }
  });

  const calculateMetrics = () => {
    let totalSales = 0, totalCogs = 0, pendingSales = 0;
    orders.forEach(order => {
      if (order.status === 'DELIVERED') {
        totalSales += order.netAmount;
        order.items.forEach(item => item.allocations.forEach(al => { totalCogs += al.quantity * al.batch.manufacturingCost; }));
      } else {
        pendingSales += order.netAmount;
      }
    });
    const grossProfit = totalSales - totalCogs;
    const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
    return { totalSales, totalCogs, grossProfit, profitMargin, pendingSales };
  };

  const { totalSales, totalCogs, grossProfit, profitMargin, pendingSales } = calculateMetrics();

  const getOrderProfit = (order: Order) => {
    if (order.status !== 'DELIVERED') return 0;
    let cost = 0;
    order.items.forEach(item => item.allocations.forEach(al => { cost += al.quantity * al.batch.manufacturingCost; }));
    return order.netAmount - cost;
  };

  const handleSendInvoice = async (order: Order) => {
    setError(''); setSuccessMsg('');
    await logActivity('SEND_INVOICE', `Dispatched digital tax invoice for Order ${order.id.substring(0, 8)} to ${order.retailer.pharmacyName}`);
    setSuccessMsg(`Digital Invoice dispatched to ${order.retailer.pharmacyName} successfully.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleSendReminder = async (order: Order) => {
    setError(''); setSuccessMsg('');
    await logActivity('SEND_REMINDER', `Dispatched payment reminder for Order ${order.id.substring(0, 8)} (Rs. ${order.netAmount.toFixed(2)}) to ${order.retailer.pharmacyName}`);
    setSuccessMsg(`Payment reminder dispatched to ${order.retailer.pharmacyName}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handlePrint = async () => {
    if (!selectedOrderForPrint) return;
    await logActivity('PRINT_INVOICE', `Printed custom invoice for order: ${selectedOrderForPrint.id}`);
    window.print();
  };

  const fiscalOrders = orders.filter(o => new Date(o.createdAt).getFullYear() === fiscalYear);
  const fiscalRevenue = fiscalOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.netAmount, 0);
  const fiscalProfit = fiscalOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + getOrderProfit(o), 0);

  const TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'transactions', label: 'Transactions', icon: <FileText style={{ width: 12, height: 12 }} /> },
    { key: 'daily', label: 'Daily', icon: <BarChart2 style={{ width: 12, height: 12 }} /> },
    { key: 'weekly', label: 'Weekly', icon: <BarChart2 style={{ width: 12, height: 12 }} /> },
    { key: 'monthly', label: 'Monthly', icon: <BarChart2 style={{ width: 12, height: 12 }} /> },
    { key: 'yearly', label: 'Yearly', icon: <BarChart2 style={{ width: 12, height: 12 }} /> },
    { key: 'fiscal', label: 'Fiscal Audit', icon: <Calendar style={{ width: 12, height: 12 }} /> },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(186,230,253,0.5)', borderRadius: 20, padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.07)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt style={{ width: 22, height: 22, color: '#F97316' }} />
            Billing &amp; Profit Analyzer
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Track distributor revenue, gross profits, margins, and print custom tax invoices.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#059669' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s infinite', boxShadow: '0 0 0 2px rgba(16,185,129,0.25)' }} />
          LIVE
        </div>
      </div>

      {error && <div className="alert alert-error animate-scaleIn"><AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} /><span>{error}</span></div>}
      {successMsg && <div className="alert alert-success animate-scaleIn"><CheckCircle style={{ width: 16, height: 16, flexShrink: 0 }} /><span>{successMsg}</span></div>}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-icon" style={{ background: '#ECFDF5', color: '#059669' }}><DollarSign style={{ width: 20, height: 20 }} /></div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: 20 }}>PAID</span>
          </div>
          <div><div className="stat-card-label">Completed Sales</div><div className="stat-card-value" style={{ color: '#059669' }}>Rs. {totalSales.toLocaleString()}</div></div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-icon" style={{ background: '#FFF7ED', color: '#EA580C' }}><Clock style={{ width: 20, height: 20 }} /></div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '3px 10px', borderRadius: 20 }}>UNPAID</span>
          </div>
          <div><div className="stat-card-label">Pending Payments</div><div className="stat-card-value" style={{ color: '#EA580C' }}>Rs. {pendingSales.toLocaleString()}</div></div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-icon" style={{ background: '#F0F9FF', color: '#0284C7' }}><TrendingUp style={{ width: 20, height: 20 }} /></div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', padding: '3px 10px', borderRadius: 20 }}>MARGIN</span>
          </div>
          <div><div className="stat-card-label">Profit Margin</div><div className="stat-card-value" style={{ color: '#0284C7' }}>{profitMargin.toFixed(1)}%</div></div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-icon" style={{ background: '#FFF7ED', color: '#F97316' }}><ArrowUpRight style={{ width: 20, height: 20 }} /></div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '3px 10px', borderRadius: 20 }}>PROFIT</span>
          </div>
          <div><div className="stat-card-label">Gross Profit</div><div className="stat-card-value" style={{ color: '#F97316' }}>Rs. {grossProfit.toLocaleString()}</div></div>
        </div>
      </div>

      {/* Finance Card */}
      <div className="finance-card">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
              <TrendingUp style={{ width: 14, height: 14, color: '#FB923C' }} /> Profitability Ledger
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gross Profits</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: 4 }}>Rs. {grossProfit.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profit Margin</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#FB923C', fontFamily: 'monospace', marginTop: 4 }}>{profitMargin.toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost of Goods</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#FCD34D', fontFamily: 'monospace', marginTop: 4 }}>Rs. {totalCogs.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <span style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#FCA5A5', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Verifier Active
          </span>
        </div>
      </div>

      {/* TAB BAR */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 4, borderRadius: 14, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: activeTab === tab.key ? 'white' : 'transparent',
              color: activeTab === tab.key ? '#F97316' : '#64748B',
              boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
            }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'transactions' && (
        <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} /> Invoices &amp; Bills Ledger
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace', textTransform: 'uppercase', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: 8 }}>Double-Entry Verified</span>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowColPicker(!showColPicker)} className="btn-ghost" style={{ height: 30, padding: '0 10px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <SlidersHorizontal style={{ width: 12, height: 12 }} /> Columns
                </button>
                {showColPicker && (
                  <div style={{ position: 'absolute', right: 0, marginTop: 6, zIndex: 20, background: 'white', border: '1.5px solid #BAE6FD', borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(14,165,233,0.12)', minWidth: 180 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>Toggle Columns</div>
                    {Object.entries(COLUMN_LABELS).map(([col, label]) => (
                      <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: '#334155', cursor: 'pointer', marginBottom: 6 }}>
                        <input type="checkbox" checked={visibleCols[col]} onChange={() => setVisibleCols({ ...visibleCols, [col]: !visibleCols[col] })} style={{ accentColor: '#F97316' }} />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {visibleCols.date && <th>Billing Date</th>}
                  {visibleCols.invoiceId && <th>Invoice ID</th>}
                  {visibleCols.customer && <th>Customer Pharmacy</th>}
                  {visibleCols.status && <th>Status</th>}
                  {visibleCols.discount && <th>Discount</th>}
                  {visibleCols.net && <th>Net Payable</th>}
                  {visibleCols.profit && <th>Profit</th>}
                  {visibleCols.actions && <th style={{ textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>No bills detected in ledger.</td></tr>
                ) : (
                  orders.map((order) => {
                    const orderProfit = getOrderProfit(order);
                    return (
                      <tr key={order.id}>
                        {visibleCols.date && <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(order.createdAt).toLocaleDateString()}</td>}
                        {visibleCols.invoiceId && (
                          <td>
                            <button onClick={() => setTraceOrder(order)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 800, color: '#0EA5E9', fontSize: 12, padding: 0, textDecoration: 'underline dotted' }}>
                              INV-{order.id.substring(0, 8).toUpperCase()}
                            </button>
                          </td>
                        )}
                        {visibleCols.customer && <td style={{ fontWeight: 700, color: '#1E293B' }}>{order.retailer.pharmacyName}</td>}
                        {visibleCols.status && (
                          <td>
                            <span className={`status-pill ${order.status === 'DELIVERED' ? 'status-pill-active' : order.status === 'DISPATCHED' ? 'status-pill-pending' : 'status-pill-inactive'}`}>{order.status}</span>
                            {order.status !== 'DELIVERED' && (
                              <button onClick={() => setSelectedOrderForPrint(order)} style={{ display: 'block', marginTop: 4, fontSize: 9, color: '#0EA5E9', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Re-enter / Edit ›</button>
                            )}
                          </td>
                        )}
                        {visibleCols.discount && <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8' }}>- Rs. {order.discountAmount.toFixed(2)}</td>}
                        {visibleCols.net && (
                          <td style={{ fontFamily: 'monospace' }}>
                            <div style={{ fontWeight: 800, color: '#1E293B' }}>Rs. {order.netAmount.toFixed(2)}</div>
                            <div style={{ fontSize: 10, color: '#059669' }}>Paid: Rs. {(settlements[order.id] || 0).toLocaleString()}</div>
                            <div style={{ fontSize: 10, color: '#DC2626' }}>Due: Rs. {Math.max(order.netAmount - (settlements[order.id] || 0), 0).toLocaleString()}</div>
                          </td>
                        )}
                        {visibleCols.profit && (
                          <td style={{ fontFamily: 'monospace' }}>
                            {order.status === 'DELIVERED' ? (
                              <span style={{ color: '#059669', fontWeight: 700 }}>Rs. {orderProfit.toFixed(2)}</span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: 11 }}>Awaiting delivery</span>
                            )}
                          </td>
                        )}
                        {visibleCols.actions && (
                          <td>
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', alignItems: 'center' }}>
                              <button onClick={() => { setSelectedOrderForPrint(order); logActivity('PREVIEW_INVOICE', `Opened custom print preview for order: ${order.id}`); }} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 10, gap: 3 }}>
                                <Printer style={{ width: 12, height: 12, color: '#F97316' }} /> Print
                              </button>
                              <button onClick={() => handleSendInvoice(order)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 10, gap: 3 }}>
                                Send
                              </button>
                              {Math.max(order.netAmount - (settlements[order.id] || 0), 0) > 0 ? (
                                <div>
                                  {settlingOrderId === order.id ? (
                                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                                      <input 
                                        type="number" placeholder="Amt" value={settleAmount} 
                                        onChange={e => setSettleAmount(e.target.value)} 
                                        style={{ width: 60, fontSize: 10, padding: '2px 4px', border: '1px solid #E2E8F0', borderRadius: 4 }} 
                                      />
                                      <button 
                                        onClick={() => handleSettleSubmit(order.id, order.netAmount)}
                                        style={{ padding: '3px 6px', fontSize: 9, background: '#10B981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        ✓
                                      </button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setSettlingOrderId(order.id)} className="btn-primary" style={{ padding: '4px 8px', fontSize: 10, background: '#0EA5E9' }}>
                                      Settle
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>✓ Paid</span>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Period Chart Tabs */}
      {(['daily', 'weekly', 'monthly', 'yearly'] as TabType[]).includes(activeTab) && (
        <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
          <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart2 style={{ width: 14, height: 14, color: '#F97316' }} /> {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Revenue &amp; Profit
          </h3>
          {analyticsLoading ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12 }}>Loading chart data...</div>
          ) : analyticsData.length === 0 ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12 }}>No data for this period yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={analyticsData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => `Rs.${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#F97316" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="revenue" stroke="#0EA5E9" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Fiscal Audit Tab */}
      {activeTab === 'fiscal' && (
        <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar style={{ width: 14, height: 14, color: '#F97316' }} /> Fiscal Year Audit Report — {fiscalYear}
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={fiscalYear} onChange={e => setFiscalYear(parseInt(e.target.value))} className="input-crisp" style={{ fontSize: 11, padding: '4px 10px', width: 'auto' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={() => window.print()} className="btn-ghost" style={{ fontSize: 10, padding: '5px 12px', gap: 4 }}>
                <Printer style={{ width: 12, height: 12 }} /> Print Audit
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#0284C7', textTransform: 'uppercase' }}>Fiscal Revenue</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#0369A1', fontFamily: 'monospace', marginTop: 4 }}>Rs. {fiscalRevenue.toLocaleString()}</div>
            </div>
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Fiscal Profit</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#047857', fontFamily: 'monospace', marginTop: 4 }}>Rs. {fiscalProfit.toLocaleString()}</div>
            </div>
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#C2410C', textTransform: 'uppercase' }}>Total Invoices</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#C2410C', fontFamily: 'monospace', marginTop: 4 }}>{fiscalOrders.length}</div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Invoice</th><th>Customer</th><th>Status</th>
                  <th>Gross Amount</th><th>Discount</th><th>Net Payable</th><th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {fiscalOrders.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>No orders for fiscal year {fiscalYear}.</td></tr>
                ) : (
                  <>
                    {fiscalOrders.map(o => (
                      <tr key={o.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>INV-{o.id.substring(0, 8).toUpperCase()}</td>
                        <td style={{ fontWeight: 700 }}>{o.retailer.pharmacyName}</td>
                        <td><span className={`status-pill ${o.status === 'DELIVERED' ? 'status-pill-active' : 'status-pill-inactive'}`}>{o.status}</span></td>
                        <td style={{ fontFamily: 'monospace' }}>Rs. {o.totalAmount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'monospace', color: '#EA580C' }}>- Rs. {o.discountAmount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 800 }}>Rs. {o.netAmount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'monospace', color: o.status === 'DELIVERED' ? '#059669' : '#94A3B8', fontWeight: 700 }}>{o.status === 'DELIVERED' ? `Rs. ${getOrderProfit(o).toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#1E293B' }}>
                      <td colSpan={4} style={{ fontSize: 11, fontWeight: 800, color: 'white', padding: '12px 16px' }}>FISCAL YEAR TOTALS</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#FCD34D' }}>Rs. {fiscalOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#FCA5A5' }}>- Rs. {fiscalOrders.reduce((s, o) => s + o.discountAmount, 0).toFixed(2)}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#6EE7B7' }}>Rs. {fiscalRevenue.toFixed(2)}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#6EE7B7' }}>Rs. {fiscalProfit.toFixed(2)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Trace Side Panel */}
      {traceOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'white', height: '100%', overflowY: 'auto', padding: 24, boxShadow: '-20px 0 60px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #F1F5F9', paddingBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B' }}>Transaction Trace</h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, fontFamily: 'monospace' }}>INV-{traceOrder.id.substring(0, 12).toUpperCase()}</p>
              </div>
              <button onClick={() => setTraceOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X style={{ width: 20, height: 20 }} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Customer', value: traceOrder.retailer.pharmacyName },
                { label: 'Status', value: traceOrder.status },
                { label: 'Date', value: new Date(traceOrder.createdAt).toLocaleDateString() },
                { label: 'Net Payable', value: `Rs. ${traceOrder.netAmount.toFixed(2)}` },
                { label: 'Discount', value: `- Rs. ${traceOrder.discountAmount.toFixed(2)}` },
                { label: 'Profit', value: traceOrder.status === 'DELIVERED' ? `Rs. ${getOrderProfit(traceOrder).toFixed(2)}` : 'Pending' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#F8FAFC', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748B', marginBottom: 12 }}>Item Allocations &amp; Batch Trace</div>
            {traceOrder.items.map(item => (
              <div key={item.id} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ fontWeight: 800, color: '#1E293B', fontSize: 12, marginBottom: 8 }}>{item.product.name} <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>{item.product.sku}</span></div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>Qty: {item.quantity} units @ Rs. {item.pricePerUnit.toFixed(4)}/unit</div>
                {item.allocations && item.allocations.map((al, i) => (
                  <div key={al.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'monospace', color: '#64748B', background: '#F8FAFC', padding: '4px 8px', borderRadius: 6, marginBottom: 4 }}>
                    <span>Batch #{al.batch.batchNumber}</span>
                    <span>{al.quantity} units</span>
                    <span>Cost: Rs. {al.batch.manufacturingCost.toFixed(2)}/u</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INVOICE PRINT MODAL */}
      {selectedOrderForPrint && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto' }} className="no-print">
          <div style={{ background: 'rgba(255,255,255,0.97)', border: '1.5px solid rgba(186,230,253,0.6)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 900, boxShadow: '0 24px 64px rgba(14,165,233,0.18)', display: 'flex', flexDirection: 'row', gap: 24, maxHeight: '90vh' }}>
            <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid #F1F5F9', paddingRight: 24 }}>
              <div>
                <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 16 }}>
                  <Receipt style={{ width: 14, height: 14, color: '#F97316' }} /> Bill Customizer
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Invoice Title</label><input type="text" value={customInvoiceTitle} onChange={e => setCustomInvoiceTitle(e.target.value)} className="input-crisp" /></div>
                  <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Terms &amp; Conditions</label><textarea rows={4} value={customTerms} onChange={e => setCustomTerms(e.target.value)} className="input-crisp" style={{ resize: 'vertical' }} /></div>
                  <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Memo / Notes</label><textarea rows={3} value={customNotes} onChange={e => setCustomNotes(e.target.value)} className="input-crisp" style={{ resize: 'vertical' }} /></div>
                </div>
              </div>
              <div style={{ paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={handlePrint} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: 'linear-gradient(135deg, #F97316, #F59E0B)' }}>
                  <Printer style={{ width: 14, height: 14 }} /> Print Document
                </button>
                <button onClick={() => setSelectedOrderForPrint(null)} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>Close Preview</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 16, background: 'white', padding: 24 }}>
              <div id="print-area" style={{ color: '#1E293B', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1E293B', paddingBottom: 16, marginBottom: 20 }}>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase' }}>{customInvoiceTitle}</h1>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#475569', marginTop: 4 }}>INV-{selectedOrderForPrint.id.substring(0, 12).toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>Date: {new Date(selectedOrderForPrint.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>MedHub Distributor</h2>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>VAT ID: {profileId.substring(0, 8).toUpperCase()}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800, fontFamily: 'monospace', marginBottom: 6 }}>Billed To:</div>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{selectedOrderForPrint.retailer.pharmacyName}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{selectedOrderForPrint.retailer.address}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>Phone: {selectedOrderForPrint.retailer.phone}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800, fontFamily: 'monospace', marginBottom: 6 }}>Payment Summary:</div>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>Net Value: Rs. {selectedOrderForPrint.netAmount.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Status: <strong>{selectedOrderForPrint.status}</strong></div>
                  </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 20 }}>
                  <thead><tr style={{ borderBottom: '2px solid #1E293B', textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.08em', color: '#475569' }}>
                    <th style={{ padding: '8px 0', textAlign: 'left' }}>SKU</th>
                    <th style={{ padding: '8px 0', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Units</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Subtotal</th>
                  </tr></thead>
                  <tbody>{selectedOrderForPrint.items.map((item, i) => {
                    const totalPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
                    const qtyBoxes = item.quantity / totalPerBox;
                    const pricePerBox = item.pricePerUnit * totalPerBox;
                    return (<tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 0', fontFamily: 'monospace', fontWeight: 700 }}>{item.product.sku}</td>
                      <td style={{ padding: '10px 0', fontWeight: 600 }}>{item.product.name} ({qtyBoxes} boxes)</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace' }}>{item.quantity} tabs</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace' }}>Rs. {pricePerBox.toFixed(2)}/box</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>Rs. {(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                    </tr>);
                  })}</tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #1E293B', paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'monospace', fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}><span>Total:</span><span>Rs. {selectedOrderForPrint.totalAmount.toFixed(2)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}><span>Discount:</span><span>- Rs. {selectedOrderForPrint.discountAmount.toFixed(2)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 14, color: '#1E293B', borderTop: '1px solid #1E293B', paddingTop: 8, marginTop: 4 }}><span>NET DUE:</span><span>Rs. {selectedOrderForPrint.netAmount.toFixed(2)}</span></div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: '1px solid #E2E8F0', paddingTop: 16, fontSize: 9, color: '#94A3B8', marginBottom: 24 }}>
                  <div><div style={{ fontSize: 10, fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', marginBottom: 4 }}>Terms &amp; Conditions:</div><pre style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>{customTerms}</pre></div>
                  <div><div style={{ fontSize: 10, fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', marginBottom: 4 }}>Memo / Notes:</div><p>{customNotes}</p></div>
                </div>
                <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace' }}>
                  <span>MEDHUB SECURE BILLING MATRIX</span>
                  <div style={{ textAlign: 'right' }}><div style={{ width: 140, borderBottom: '1px solid #94A3B8', height: 40 }}></div><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginTop: 4 }}>Authorized Signature</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
