'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt, DollarSign, Clock, ArrowUpRight,
  Printer, Send, Bell, Check, AlertCircle, CheckCircle, TrendingUp,
  SlidersHorizontal, X, ChevronDown, BarChart2, Calendar, FileText, Eye,
  CreditCard, History, Package
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

// Settle log entry persisted per payment
interface SettleEntry {
  amount: number;
  date: string; // ISO string
}

interface BillingClientProps {
  profileId: string;
  initialOrders: Order[];
  profile?: {
    companyName: string;
    taxId: string;
    address: string;
    phone: string;
  };
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

export default function BillingClient({ profileId, initialOrders, profile }: BillingClientProps) {
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

  // Transaction detail modal (replaces old side panel)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // Partial payment settlements — amount totals
  const [settlements, setSettlements] = useState<Record<string, number>>({});
  // Settle log — detailed entries per order: orderId → [{amount, date}]
  const [settleLogs, setSettleLogs] = useState<Record<string, SettleEntry[]>>({});
  const [settleAmount, setSettleAmount] = useState('');
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('medhub_order_payments');
    if (stored) setSettlements(JSON.parse(stored));
    const storedLogs = localStorage.getItem('medhub_settle_logs');
    if (storedLogs) setSettleLogs(JSON.parse(storedLogs));
  }, []);

  const handleSettleSubmit = (orderId: string, totalAmount: number) => {
    const currentPaid = settlements[orderId] || 0;
    const inputPaid = parseFloat(settleAmount) || 0;
    if (inputPaid <= 0) return;
    const finalPaid = Math.min(currentPaid + inputPaid, totalAmount);

    const updatedSettlements = { ...settlements, [orderId]: finalPaid };
    setSettlements(updatedSettlements);
    localStorage.setItem('medhub_order_payments', JSON.stringify(updatedSettlements));

    // Log this payment entry with date
    const newEntry: SettleEntry = { amount: inputPaid, date: new Date().toISOString() };
    const existingLog = settleLogs[orderId] || [];
    const updatedLogs = { ...settleLogs, [orderId]: [...existingLog, newEntry] };
    setSettleLogs(updatedLogs);
    localStorage.setItem('medhub_settle_logs', JSON.stringify(updatedLogs));

    setSettleAmount('');
    setSettlingOrderId(null);
    setSuccessMsg(`Payment of Rs. ${inputPaid.toLocaleString()} recorded.`);
    setTimeout(() => setSuccessMsg(''), 3000);
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

  useSSEListener(profileId, (type) => {
    if (type === 'ORDER_CREATED' || type === 'ORDER_STATUS_CHANGED') {
      fetchOrders();
    }
  });

  const calculateMetrics = () => {
    let totalSales = 0, totalCogs = 0;
    let pendingSales = 0;
    orders.forEach(order => {
      if (order.status === 'DELIVERED') {
        totalSales += order.netAmount;
        order.items.forEach(item => item.allocations.forEach(al => {
          totalCogs += al.quantity * al.batch.manufacturingCost;
        }));
      }
      // Count remaining unpaid for ALL orders regardless of delivery status
      const paid = settlements[order.id] || 0;
      const remaining = Math.max(order.netAmount - paid, 0);
      pendingSales += remaining;
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

  const handlePrint = async () => {
    if (!selectedOrderForPrint) return;
    await logActivity('PRINT_INVOICE', `Printed custom invoice for order: ${selectedOrderForPrint.id}`);
    window.print();
  };

  const fiscalOrders = orders.filter(o => new Date(o.createdAt).getFullYear() === fiscalYear);
  const fiscalRevenue = fiscalOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.netAmount, 0);
  const fiscalProfit = fiscalOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + getOrderProfit(o), 0);

  // Filtered orders for transaction table
  const filteredOrders = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch = !filterSearch ||
      o.retailer.pharmacyName.toLowerCase().includes(filterSearch.toLowerCase()) ||
      o.id.toLowerCase().includes(filterSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'transactions', label: 'Transactions', icon: <FileText style={{ width: 12, height: 12 }} /> },
    { key: 'daily', label: 'Daily', icon: <BarChart2 style={{ width: 12, height: 12 }} /> },
    { key: 'weekly', label: 'Weekly', icon: <BarChart2 style={{ width: 12, height: 12 }} /> },
    { key: 'monthly', label: 'Monthly', icon: <BarChart2 style={{ width: 12, height: 12 }} /> },
    { key: 'yearly', label: 'Yearly', icon: <BarChart2 style={{ width: 12, height: 12 }} /> },
    { key: 'fiscal', label: 'Fiscal Audit', icon: <Calendar style={{ width: 12, height: 12 }} /> },
  ];

  const statusPillStyle = (status: string): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      DELIVERED: { background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' },
      DISPATCHED: { background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' },
      PENDING:    { background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' },
      RETURNED:   { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
      PICKING:    { background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' },
    };
    return { fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace', ...(map[status] || { background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }) };
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(249,115,22,0.18)', borderRadius: 20, padding: '20px 24px', boxShadow: '0 2px 16px rgba(249,115,22,0.07)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt style={{ width: 22, height: 22, color: '#F97316' }} />
            Billing &amp; Profit Analyzer
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Track distributor revenue, gross profits, margins, and print custom tax invoices.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#059669' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            LIVE
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} /><span>{error}</span></div>}
      {successMsg && <div className="alert alert-success animate-scaleIn"><CheckCircle style={{ width: 16, height: 16, flexShrink: 0 }} /><span>{successMsg}</span></div>}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
        {[
          { label: 'Completed Sales', value: `Rs. ${totalSales.toLocaleString()}`, badge: 'PAID', icon: <DollarSign style={{ width: 20, height: 20 }} />, badgeBg: '#ECFDF5', badgeColor: '#059669', badgeBorder: '#A7F3D0', iconBg: '#ECFDF5', shadow: '0 4px 20px rgba(16,185,129,0.12)' },
          { label: 'Unpaid Due', value: `Rs. ${pendingSales.toLocaleString()}`, badge: 'UNPAID', icon: <Clock style={{ width: 20, height: 20 }} />, badgeBg: '#FFF7ED', badgeColor: '#C2410C', badgeBorder: '#FED7AA', iconBg: '#FFF7ED', shadow: '0 4px 20px rgba(249,115,22,0.1)' },
          { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, badge: 'MARGIN', icon: <TrendingUp style={{ width: 20, height: 20 }} />, badgeBg: '#F0F9FF', badgeColor: '#0284C7', badgeBorder: '#BAE6FD', iconBg: '#F0F9FF', shadow: '0 4px 20px rgba(14,165,233,0.1)' },
          { label: 'Gross Profit', value: `Rs. ${grossProfit.toLocaleString()}`, badge: 'PROFIT', icon: <ArrowUpRight style={{ width: 20, height: 20 }} />, badgeBg: '#FFF7ED', badgeColor: '#C2410C', badgeBorder: '#FED7AA', iconBg: '#FFF7ED', shadow: '0 4px 20px rgba(249,115,22,0.1)' },
        ].map((card) => (
          <div key={card.label} className="stat-card" style={{ boxShadow: card.shadow, gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="stat-card-icon" style={{ background: card.iconBg }}>{card.icon}</div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', background: card.badgeBg, color: card.badgeColor, border: `1px solid ${card.badgeBorder}`, padding: '3px 10px', borderRadius: 20 }}>{card.badge}</span>
            </div>
            <div><div className="stat-card-label">{card.label}</div><div className="stat-card-value" style={{ color: card.badgeColor }}>{card.value}</div></div>
          </div>
        ))}
      </div>

      {/* Finance Card */}
      <div className="finance-card">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
              <TrendingUp style={{ width: 14, height: 14, color: '#FB923C' }} /> Profitability Ledger
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 24 }}>
              <div><div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gross Profits</div><div style={{ fontSize: 24, fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: 4 }}>Rs. {grossProfit.toLocaleString()}</div></div>
              <div><div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profit Margin</div><div style={{ fontSize: 24, fontWeight: 900, color: '#FB923C', fontFamily: 'monospace', marginTop: 4 }}>{profitMargin.toFixed(1)}%</div></div>
              <div><div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost of Goods</div><div style={{ fontSize: 24, fontWeight: 900, color: '#FCD34D', fontFamily: 'monospace', marginTop: 4 }}>Rs. {totalCogs.toLocaleString()}</div></div>
            </div>
          </div>
          <span style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#FCA5A5', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Verifier Active</span>
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

      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
          {/* Table header with filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} /> Invoices &amp; Bills Ledger
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Search filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '4px 10px' }}>
                <FileText style={{ width: 12, height: 12, color: '#94A3B8' }} />
                <input type="text" placeholder="Search invoice / pharmacy..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: 11, width: 160, color: '#1E293B' }} />
              </div>
              {/* Status filter */}
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, color: '#475569', background: 'white', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                <option value="all">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="DISPATCHED">Dispatched</option>
                <option value="DELIVERED">Delivered</option>
                <option value="RETURNED">Returned</option>
              </select>
              {/* Column picker — proper modal button */}
              <button onClick={() => setShowColPicker(true)} className="btn-ghost" style={{ height: 32, padding: '0 10px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <SlidersHorizontal style={{ width: 12, height: 12 }} /> Columns
              </button>
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
                  {visibleCols.net && <th>Net / Paid / Due</th>}
                  {visibleCols.profit && <th>Profit</th>}
                  {visibleCols.actions && <th style={{ textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>No bills found matching filters.</td></tr>
                ) : (
                  filteredOrders.map((order) => {
                    const orderProfit = getOrderProfit(order);
                    const paid = settlements[order.id] || 0;
                    const due = Math.max(order.netAmount - paid, 0);
                    return (
                      <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => setDetailOrder(order)}>
                        {visibleCols.date && <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{new Date(order.createdAt).toLocaleDateString()}</td>}
                        {visibleCols.invoiceId && (
                          <td onClick={e => e.stopPropagation()}>
                            <button onClick={() => setDetailOrder(order)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 800, color: '#F97316', fontSize: 12, padding: 0, textDecoration: 'underline dotted' }}>
                              INV-{order.id.substring(0, 8).toUpperCase()}
                            </button>
                          </td>
                        )}
                        {visibleCols.customer && <td style={{ fontWeight: 700, color: '#1E293B' }}>{order.retailer.pharmacyName}</td>}
                        {visibleCols.status && (
                          <td><span style={statusPillStyle(order.status)}>{order.status}</span></td>
                        )}
                        {visibleCols.discount && <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8' }}>- Rs. {order.discountAmount.toFixed(2)}</td>}
                        {visibleCols.net && (
                          <td style={{ fontFamily: 'monospace' }}>
                            <div style={{ fontWeight: 800, color: '#1E293B', fontSize: 12 }}>Rs. {order.netAmount.toFixed(2)}</div>
                            <div style={{ fontSize: 10, color: '#059669', marginTop: 2 }}>✓ Paid: Rs. {paid.toLocaleString()}</div>
                            {due > 0 && <div style={{ fontSize: 10, color: '#DC2626' }}>⚠ Due: Rs. {due.toLocaleString()}</div>}
                          </td>
                        )}
                        {visibleCols.profit && (
                          <td style={{ fontFamily: 'monospace' }}>
                            {order.status === 'DELIVERED'
                              ? <span style={{ color: '#059669', fontWeight: 700 }}>Rs. {orderProfit.toFixed(2)}</span>
                              : <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: 11 }}>Pending</span>}
                          </td>
                        )}
                        {visibleCols.actions && (
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', alignItems: 'center' }}>
                              <button onClick={() => setDetailOrder(order)} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 10, gap: 3 }}>
                                <Eye style={{ width: 12, height: 12, color: '#0EA5E9' }} /> View
                              </button>
                              <button onClick={() => { setSelectedOrderForPrint(order); logActivity('PREVIEW_INVOICE', `Opened custom print preview for order: ${order.id}`); }} className="btn-ghost" style={{ padding: '4px 8px', fontSize: 10, gap: 3 }}>
                                <Printer style={{ width: 12, height: 12, color: '#F97316' }} /> Print
                              </button>
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
              <thead><tr>
                <th>Date</th><th>Invoice</th><th>Customer</th><th>Status</th>
                <th>Gross Amount</th><th>Discount</th><th>Net Payable</th><th>Profit</th>
              </tr></thead>
              <tbody>
                {fiscalOrders.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>No orders for fiscal year {fiscalYear}.</td></tr>
                ) : (
                  <>
                    {fiscalOrders.map(o => (
                      <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setDetailOrder(o)}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#F97316' }}>INV-{o.id.substring(0, 8).toUpperCase()}</td>
                        <td style={{ fontWeight: 700 }}>{o.retailer.pharmacyName}</td>
                        <td><span style={statusPillStyle(o.status)}>{o.status}</span></td>
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

      {/* ─────────────────────────────────────────────────────────────────
          TRANSACTION DETAIL MODAL — Centered, 100vh, z-index 9999
      ───────────────────────────────────────────────────────────────── */}
      {detailOrder && (
        <div className="modal-overlay" onClick={() => setDetailOrder(null)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '760px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt style={{ width: 18, height: 18, color: '#F97316' }} />
                  Invoice: INV-{detailOrder.id.substring(0, 12).toUpperCase()}
                </h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{detailOrder.retailer.pharmacyName} · {new Date(detailOrder.createdAt).toLocaleString()}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={statusPillStyle(detailOrder.status)}>{detailOrder.status}</span>
                <button onClick={() => setDetailOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 8, display: 'flex' }}>
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Summary grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Gross Amount', val: `Rs. ${detailOrder.totalAmount.toFixed(2)}`, color: '#1E293B' },
                  { label: 'Discount', val: `- Rs. ${detailOrder.discountAmount.toFixed(2)}`, color: '#EA580C' },
                  { label: 'Net Payable', val: `Rs. ${detailOrder.netAmount.toFixed(2)}`, color: '#0EA5E9' },
                  { label: 'Total Paid', val: `Rs. ${(settlements[detailOrder.id] || 0).toLocaleString()}`, color: '#059669' },
                  { label: 'Remaining Due', val: `Rs. ${Math.max(detailOrder.netAmount - (settlements[detailOrder.id] || 0), 0).toLocaleString()}`, color: '#DC2626' },
                  { label: 'Profit', val: detailOrder.status === 'DELIVERED' ? `Rs. ${getOrderProfit(detailOrder).toFixed(2)}` : 'Pending', color: '#059669' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'monospace' }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Items */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Package style={{ width: 12, height: 12 }} /> Itemized Order Lines
                </div>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead style={{ background: '#F8FAFC' }}>
                      <tr>
                        {['Product', 'SKU', 'Qty', 'Unit Price', 'Subtotal'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Product' || h === 'SKU' ? 'left' : 'right', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailOrder.items.map(item => {
                        const boxQty = Math.floor(item.quantity / (item.product.tabletsPerStrip * item.product.stripsPerBox));
                        return (
                          <tr key={item.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1E293B' }}>{item.product.name}</td>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10, color: '#64748B' }}>{item.product.sku}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{boxQty} boxes</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>Rs. {(item.pricePerUnit * item.product.tabletsPerStrip * item.product.stripsPerBox).toFixed(2)}/box</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>Rs. {(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Settle History */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History style={{ width: 12, height: 12 }} /> Payment History
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {(settleLogs[detailOrder.id] || []).length === 0 ? (
                      <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', padding: '12px 0' }}>No payments recorded yet.</div>
                    ) : (
                      (settleLogs[detailOrder.id] || []).map((entry, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: '#475569' }}>{new Date(entry.date).toLocaleString()}</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>+ Rs. {entry.amount.toLocaleString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Settle input */}
                <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 14, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#C2410C', marginBottom: 10 }}>
                    <CreditCard style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                    Settle Outstanding
                  </div>
                  {Math.max(detailOrder.netAmount - (settlements[detailOrder.id] || 0), 0) > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 11, color: '#7C2D12' }}>
                        Remaining: <strong style={{ fontFamily: 'monospace' }}>Rs. {Math.max(detailOrder.netAmount - (settlements[detailOrder.id] || 0), 0).toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="number"
                          placeholder="Enter amount..."
                          value={settleAmount}
                          onChange={e => setSettleAmount(e.target.value)}
                          className="input-crisp"
                          style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}
                        />
                        <button
                          onClick={() => handleSettleSubmit(detailOrder.id, detailOrder.netAmount)}
                          className="btn-primary"
                          style={{ padding: '8px 14px', fontSize: 11, background: '#10B981', whiteSpace: 'nowrap' }}
                        >
                          Record
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
                      <Check style={{ width: 16, height: 16 }} /> Fully Settled
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setSelectedOrderForPrint(detailOrder); setDetailOrder(null); }} className="btn-ghost" style={{ gap: 6 }}>
                <Printer style={{ width: 14, height: 14 }} /> Print Invoice
              </button>
              <button onClick={() => handleSendInvoice(detailOrder)} className="btn-ghost" style={{ gap: 6 }}>
                <Send style={{ width: 14, height: 14 }} /> Send Invoice
              </button>
              <button onClick={() => setDetailOrder(null)} className="btn-primary" style={{ background: '#475569' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Picker Modal */}
      {showColPicker && (
        <div className="modal-overlay" onClick={() => setShowColPicker(false)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '360px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>Toggle Columns</h3>
              <button onClick={() => setShowColPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(COLUMN_LABELS).map(([col, label]) => (
                <label key={col} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer', padding: '8px 12px', borderRadius: 10, background: visibleCols[col] ? '#F0F9FF' : '#F8FAFC', border: `1.5px solid ${visibleCols[col] ? '#BAE6FD' : '#E2E8F0'}`, transition: 'all 0.15s' }}>
                  <input type="checkbox" checked={visibleCols[col]} onChange={() => setVisibleCols({ ...visibleCols, [col]: !visibleCols[col] })} style={{ accentColor: '#F97316', width: 14, height: 14 }} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* INVOICE PRINT MODAL */}
      {selectedOrderForPrint && (
        <div className="modal-overlay no-print" onClick={() => setSelectedOrderForPrint(null)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '900px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Receipt style={{ width: 16, height: 16, color: '#F97316' }} /> Invoice Print Preview
              </h3>
              <button onClick={() => setSelectedOrderForPrint(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Customizer row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, background: '#F8FAFC', padding: 16, borderRadius: 12 }}>
                <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Invoice Title</label><input type="text" value={customInvoiceTitle} onChange={e => setCustomInvoiceTitle(e.target.value)} className="input-crisp" /></div>
                <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Terms &amp; Conditions</label><textarea rows={2} value={customTerms} onChange={e => setCustomTerms(e.target.value)} className="input-crisp" style={{ resize: 'vertical' }} /></div>
                <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Memo / Notes</label><textarea rows={2} value={customNotes} onChange={e => setCustomNotes(e.target.value)} className="input-crisp" style={{ resize: 'vertical' }} /></div>
              </div>
              {/* Print area */}
              <div id="print-area" style={{ color: '#1E293B', fontSize: 12, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1E293B', paddingBottom: 16, marginBottom: 20 }}>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase' }}>{customInvoiceTitle}</h1>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#475569', marginTop: 4 }}>INV-{selectedOrderForPrint.id.substring(0, 12).toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>Date: {new Date(selectedOrderForPrint.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <h2 style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>{profile?.companyName || 'MedHub Distributor'}</h2>
                    <div style={{ fontSize: 10, color: '#475569' }}>{profile?.address || 'Warehouse Location'}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>Phone: {profile?.phone || 'N/A'}</div>
                    <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, marginTop: 4 }}>VAT / PAN ID: {profile?.taxId || profileId.substring(0, 8).toUpperCase()}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800, marginBottom: 6 }}>Billed To:</div>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{selectedOrderForPrint.retailer.pharmacyName}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{selectedOrderForPrint.retailer.address}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>Phone: {selectedOrderForPrint.retailer.phone}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800, marginBottom: 6 }}>Payment Summary:</div>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>Net Value: Rs. {selectedOrderForPrint.netAmount.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>Paid: Rs. {(settlements[selectedOrderForPrint.id] || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#DC2626', marginTop: 1 }}>Remaining: Rs. {Math.max(selectedOrderForPrint.netAmount - (settlements[selectedOrderForPrint.id] || 0), 0).toLocaleString()}</div>
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
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #1E293B', paddingTop: 16, marginBottom: 16 }}>
                  <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'monospace', fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}><span>Total:</span><span>Rs. {selectedOrderForPrint.totalAmount.toFixed(2)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}><span>Discount:</span><span>- Rs. {selectedOrderForPrint.discountAmount.toFixed(2)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 14, color: '#1E293B', borderTop: '1px solid #1E293B', paddingTop: 8, marginTop: 4 }}><span>NET DUE:</span><span>Rs. {selectedOrderForPrint.netAmount.toFixed(2)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}><span>Paid:</span><span>Rs. {(settlements[selectedOrderForPrint.id] || 0).toLocaleString()}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626', fontWeight: 700 }}><span>Remaining:</span><span>Rs. {Math.max(selectedOrderForPrint.netAmount - (settlements[selectedOrderForPrint.id] || 0), 0).toLocaleString()}</span></div>
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace' }}>
                  <span>MEDHUB SECURE BILLING MATRIX</span>
                  <div style={{ textAlign: 'right' }}><div style={{ width: 140, borderBottom: '1px solid #94A3B8', height: 40 }}></div><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginTop: 4 }}>Authorized Signature</span></div>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={handlePrint} className="btn-primary" style={{ background: 'linear-gradient(135deg, #F97316, #F59E0B)', gap: 6 }}>
                <Printer style={{ width: 14, height: 14 }} /> Print Document
              </button>
              <button onClick={() => setSelectedOrderForPrint(null)} className="btn-ghost">Close Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
