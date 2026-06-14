'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Receipt, Search, Printer, Eye, TrendingUp, TrendingDown,
  X, Package, User, Phone, Building, Calendar, Hash,
  ArrowUpRight, BarChart2, ChevronDown, Layers, DollarSign,
  CheckCircle, Clock, AlertTriangle, CreditCard, Banknote,
  Wallet, Send, ShieldCheck, BookOpen, RefreshCw, ArrowDownLeft,
  ArrowUpLeft, Repeat, ChevronRight, Info, FileText, Activity,
  PiggyBank, Minus, Plus, Download, Filter, ArrowLeft, ArrowRight
} from 'lucide-react';
import { useRealtimeEvent } from '@/lib/events';
import { settleB2CDueAction } from '@/app/actions/retailerActions';

/* ─── Types ─── */
interface OrderItem {
  id: string;
  quantity: number;
  pricePerUnit: number;
  product: { name: string; sku: string; };
}

interface Order {
  id: string;
  wholesaler?: { companyName: string; address?: string; phone?: string; } | null;
  status: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  advanceApplied: number;
  overrideJustification?: string | null;
  createdAt: string;
  items: OrderItem[];
  settleStatus?: string;
  settleAmount?: number;
  settleMethod?: string;
}

interface WholesalerRelation {
  id: string;
  wholesalerId: string;
  retailerId: string;
  advanceBalance: number;
  creditLimit: number;
  wholesaler: { companyName: string; phone?: string; };
}

interface LedgerEntry {
  id: string;
  partyType: string;
  partyId: string;
  oppositePartyName: string;
  orderId?: string | null;
  type: string;
  debit: number;
  credit: number;
  balance: number;
  description: string;
  createdAt: string;
}

interface ReturnRequestItem {
  orderItemId: string;
  quantity: number;
  reason: string;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  status: string;
  reason?: string | null;
  adjustBilling: boolean;
  createdAt: string;
  itemsJson: string;
  order: Order & {
    wholesaler: { companyName: string } | null;
  };
}

interface BillingClientProps {
  initialSales: Order[];
  initialPurchases: Order[];
  initialRelations: WholesalerRelation[];
  initialLedgers: LedgerEntry[];
  initialReturnRequests: ReturnRequest[];
  profileId: string;
}

/* ─── Constants ─── */
const SETTLE_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  UNPAID:               { label: 'Due',        color: '#EF4444', bg: 'rgba(239,68,68,0.08)',    icon: AlertTriangle },
  PENDING_VERIFICATION: { label: 'Pending',    color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',    icon: Clock },
  VERIFIED:             { label: 'Paid',       color: '#10B981', bg: 'rgba(16,185,129,0.08)',    icon: CheckCircle },
  REJECTED:             { label: 'Rejected',   color: '#EF4444', bg: 'rgba(239,68,68,0.12)',    icon: AlertTriangle },
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  DELIVERED:  { color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  PENDING:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  PICKING:    { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  DISPATCHED: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
  RETURNED:   { color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
};

const LEDGER_TYPE_META: Record<string, { label: string; color: string; bg: string; icon: any; isDr: boolean }> = {
  SALE:             { label: 'Sale',           color: '#EF4444', bg: 'rgba(239,68,68,0.08)',    icon: ArrowUpLeft,    isDr: true  },
  RETURN:           { label: 'Return',         color: '#10B981', bg: 'rgba(16,185,129,0.08)',   icon: ArrowDownLeft,  isDr: false },
  PAYMENT:          { label: 'Payment',        color: '#10B981', bg: 'rgba(16,185,129,0.08)',   icon: CheckCircle,    isDr: false },
  ADVANCE_APPLIED:  { label: 'Advance Used',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',   icon: PiggyBank,      isDr: false },
  ADVANCE_REFUND:   { label: 'Advance Add',    color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',   icon: Plus,           isDr: false },
};

const PAYMENT_METHODS = [
  { id: 'CASH',     label: 'Cash',          icon: Banknote,   enabled: true  },
  { id: 'COD',      label: 'COD',           icon: Package,    enabled: true  },
  { id: 'UPI',      label: 'UPI / QR',      icon: Wallet,     enabled: false },
  { id: 'BANK',     label: 'Bank Transfer', icon: CreditCard, enabled: false },
];

/* ─── Helpers ─── */
const getB2CDetails = (justification?: string | null) => {
  if (!justification) return { name: 'Walk-in Customer', phone: 'N/A', method: 'CASH', due: 0, paid: 0 };
  const nameMatch   = justification.match(/B2C POS:\s*([^,|]+)/);
  const phoneMatch  = justification.match(/Phone:\s*([^|]+)/);
  const methodMatch = justification.match(/Method:\s*([^|]+)/);
  const dueMatch    = justification.match(/Due:\s*Rs\.\s*([\d.]+)/);
  const paidMatch   = justification.match(/Paid:\s*Rs\.\s*([\d.]+)/);
  return {
    name:   nameMatch   ? nameMatch[1].trim()   : 'Walk-in Customer',
    phone:  phoneMatch  ? phoneMatch[1].trim()  : 'N/A',
    method: methodMatch ? methodMatch[1].trim() : 'CASH',
    due:    dueMatch    ? parseFloat(dueMatch[1])  : 0,
    paid:   paidMatch   ? parseFloat(paidMatch[1]) : 0,
  };
};

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fmtRs = (n: number) => `Rs. ${fmt(n)}`;

/* ─── Main Component ─── */
export default function BillingClient({
  initialSales,
  initialPurchases,
  initialRelations,
  initialLedgers,
  initialReturnRequests,
}: BillingClientProps) {
  const [sales, setSales]               = useState<Order[]>(initialSales);
  const [purchases, setPurchases]       = useState<Order[]>(initialPurchases);
  const [relations, setRelations]       = useState<WholesalerRelation[]>(initialRelations);
  const [ledgers, setLedgers]           = useState<LedgerEntry[]>(initialLedgers);
  const [returns, setReturns]           = useState<ReturnRequest[]>(initialReturnRequests);

  const [activeTab, setActiveTab] = useState<'overview' | 'purchases' | 'sales' | 'ledger' | 'returns'>('overview');
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSettle, setFilterSettle] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSaleModal, setIsSaleModal]   = useState(false);

  // Settle modal
  const [settleOrder, setSettleOrder]     = useState<Order | null>(null);
  const [settleIsB2C, setSettleIsB2C]     = useState(false);
  const [settleAmount, setSettleAmountVal] = useState('');
  const [settleMethod, setSettleMethod]   = useState('CASH');
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError]     = useState('');

  const searchRef = useRef<HTMLInputElement>(null);

  useRealtimeEvent('BILLING_UPDATE', () => { fetchBillingData(); });

  const fetchBillingData = async () => {
    try {
      const res = await fetch('/api/retailer/billing');
      const data = await res.json();
      if (data.success) {
        setSales(data.sales || []);
        setPurchases(data.purchases || []);
        setRelations(data.relations || []);
        setLedgers(data.ledgers || []);
        setReturns(data.returnRequests || []);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setSelectedOrder(null); setSettleOrder(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ── Derived Metrics ── */
  // Advance balances aggregated across all wholesaler relations
  const totalAdvanceBalance = relations.reduce((s, r) => s + r.advanceBalance, 0);

  // Outstanding due from B2B purchases (actual per-order)
  const totalOutstandingDue = purchases.reduce((s, p) => {
    const st = p.settleStatus || 'UNPAID';
    if (st === 'UNPAID' || st === 'REJECTED') return s + p.netAmount - (p.advanceApplied || 0);
    if (st === 'PENDING_VERIFICATION') return s + Math.max(p.netAmount - (p.advanceApplied || 0) - (p.settleAmount || 0), 0);
    return s;
  }, 0);

  const totalVerifiedPayments = purchases
    .filter(p => p.settleStatus === 'VERIFIED')
    .reduce((s, p) => s + (p.settleAmount || 0), 0);

  const totalPendingVerification = purchases
    .filter(p => p.settleStatus === 'PENDING_VERIFICATION')
    .reduce((s, p) => s + (p.settleAmount || 0), 0);

  const totalSalesRevenue = sales.reduce((s, o) => s + o.netAmount, 0);
  const totalPurchaseCost = purchases.reduce((s, o) => s + o.netAmount, 0);
  const totalAdvanceApplied = purchases.reduce((s, o) => s + (o.advanceApplied || 0), 0);

  // Ledger running balance (last entry = current balance)
  const ledgerBalance = ledgers.length > 0 ? ledgers[ledgers.length - 1].balance : 0;

  /* ── Filtered Lists ── */
  const filteredPurchases = purchases.filter(p => {
    const matchSettle = filterSettle === 'all' || (p.settleStatus || 'UNPAID') === filterSettle;
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.id.toLowerCase().includes(q) ||
      (p.wholesaler?.companyName || '').toLowerCase().includes(q);
    return matchSettle && matchStatus && matchSearch;
  });

  const filteredSales = sales.filter(s => {
    const d = getB2CDetails(s.overrideJustification);
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || s.id.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) || d.phone.includes(q);
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  /* ── Settle Handlers ── */
  const handleOpenSettle = (order: Order, isB2C: boolean) => {
    const d = isB2C ? getB2CDetails(order.overrideJustification) : null;
    setSettleOrder(order);
    setSettleIsB2C(isB2C);
    setSettleAmountVal(String(d ? d.due : Math.max(order.netAmount - (order.advanceApplied || 0) - (order.settleAmount || 0), 0)));
    setSettleMethod(d ? d.method : 'CASH');
    setSettleError('');
  };

  const handleSubmitSettlement = async () => {
    if (!settleOrder) return;
    const amt = parseFloat(settleAmount);
    if (!settleAmount || isNaN(amt) || amt <= 0) { setSettleError('Enter a valid amount.'); return; }
    setSettleLoading(true);
    setSettleError('');
    try {
      if (settleIsB2C) {
        const res = await settleB2CDueAction(settleOrder.id, amt);
        if (!res.success || !res.order) throw new Error('Failed to settle B2C due');
        setSales(prev => prev.map(s => s.id === settleOrder.id ? { ...s, overrideJustification: res.order.overrideJustification } : s));
      } else {
        const res = await fetch('/api/retailer/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: settleOrder.id, amount: amt, method: settleMethod }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit settlement');
        setPurchases(prev => prev.map(p =>
          p.id === settleOrder.id
            ? { ...p, settleStatus: 'PENDING_VERIFICATION', settleAmount: amt, settleMethod }
            : p
        ));
      }
      setSettleOrder(null);
    } catch (err: any) {
      setSettleError(err.message || 'Error submitting settlement');
    } finally {
      setSettleLoading(false);
    }
  };

  /* ── Print Invoice ── */
  const printInvoice = (order: Order, isSale: boolean) => {
    const d = isSale ? getB2CDetails(order.overrideJustification) : null;
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    const rows = order.items.map(i =>
      `<tr><td>${i.product.name}</td><td>${i.product.sku}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">Rs. ${i.pricePerUnit.toLocaleString()}</td><td style="text-align:right">Rs. ${(i.quantity * i.pricePerUnit).toLocaleString()}</td></tr>`
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Invoice</title><style>
      body{font-family:'Courier New',monospace;max-width:600px;margin:30px auto;color:#000;font-size:13px}
      h1{text-align:center;font-size:18px;margin:0}p{text-align:center;margin:4px 0;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{border-bottom:2px solid #000;padding:6px 8px;text-align:left;font-size:11px}
      td{padding:6px 8px;border-bottom:1px solid #ddd;font-size:12px}
      .total{font-weight:bold;font-size:14px;text-align:right;margin-top:10px}
      .meta{border-top:1px dashed #000;border-bottom:1px dashed #000;padding:8px 0;margin:10px 0;font-size:12px}
    </style></head><body>
      <h1>MEDHUB PHARMACY NODE</h1>
      <p>${isSale ? 'RETAIL INVOICE STATEMENT' : 'WHOLESALE PURCHASE BILL'}</p>
      <div class="meta">
        <div><strong>Ref #:</strong> ${order.id.toUpperCase()}</div>
        <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</div>
        ${isSale ? `<div><strong>Patient:</strong> ${d?.name} | Phone: ${d?.phone}</div><div><strong>Payment:</strong> ${d?.method}</div>` : `<div><strong>Supplier:</strong> ${order.wholesaler?.companyName || '—'}</div>`}
        <div><strong>Status:</strong> ${order.status}</div>
      </div>
      <table><thead><tr><th>Medicine</th><th>SKU</th><th style="text-align:right">Qty</th><th style="text-align:right">Price/Unit</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="total">Gross: Rs. ${order.totalAmount.toLocaleString()}</div>
      ${order.discountAmount > 0 ? `<div class="total" style="color:red">Discount: -Rs. ${order.discountAmount.toLocaleString()}</div>` : ''}
      ${order.advanceApplied > 0 ? `<div class="total" style="color:#8B5CF6">Advance Applied: -Rs. ${order.advanceApplied.toLocaleString()}</div>` : ''}
      <div class="total" style="font-size:16px;border-top:2px solid #000;padding-top:6px">NET VALUE: Rs. ${order.netAmount.toLocaleString()}</div>
      <script>window.onload=function(){window.print();window.close();}</script>
    </body></html>`);
    win.document.close();
  };

  /* ── CSV Export ── */
  const exportLedgerCSV = () => {
    const headers = ['Date', 'Type', 'Description', 'Debit (Rs)', 'Credit (Rs)', 'Running Balance (Rs)'];
    const rows = [...ledgers].reverse().map(l => [
      new Date(l.createdAt).toLocaleString(),
      l.type,
      l.description,
      l.debit || '',
      l.credit || '',
      l.balance,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Ledger_Statement.csv'; a.click();
  };

  /* ─── Styles ─── */
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: '#FFFFFF',
    borderRadius: 18,
    border: '1.5px solid #F1F5F9',
    boxShadow: '0 2px 16px rgba(148,163,184,0.06)',
    overflow: 'hidden',
    ...extra,
  });

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 18px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    background: active ? '#FFFFFF' : 'transparent',
    color: active ? '#1E40AF' : '#64748B',
    boxShadow: active ? '0 2px 12px rgba(0,0,0,0.06)' : 'none',
    transition: 'all 0.2s ease',
  });

  /* ─── Sub-renders ─── */

  // Overview cards
  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Advance Balance Banner */}
      {relations.map(rel => (
        <div key={rel.id} style={{
          background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 50%, #60A5FA 100%)',
          borderRadius: 20, padding: '24px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
          boxShadow: '0 8px 32px rgba(30,64,175,0.2)',
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Advance Balance with {rel.wholesaler.companyName}
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#FFFFFF', marginTop: 6, fontFamily: 'monospace' }}>
              {fmtRs(rel.advanceBalance)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
              Auto-applied to your next order • Credit Limit: {fmtRs(rel.creditLimit)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 16px', backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>LEDGER BALANCE</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF', fontFamily: 'monospace' }}>
                {ledgerBalance >= 0 ? `You Owe: ${fmtRs(ledgerBalance)}` : `To Receive: ${fmtRs(Math.abs(ledgerBalance))}`}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Key Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {[
          { label: 'B2C Revenue (Sales)', val: totalSalesRevenue, color: '#10B981', icon: TrendingUp, sub: `${sales.length} transactions` },
          { label: 'B2B Procurement', val: totalPurchaseCost, color: '#F59E0B', icon: TrendingDown, sub: `${purchases.length} purchase orders` },
          { label: 'Outstanding Dues', val: Math.max(totalOutstandingDue, 0), color: '#EF4444', icon: AlertTriangle, sub: 'Unpaid B2B bills' },
          { label: 'Advance Balance', val: totalAdvanceBalance, color: '#3B82F6', icon: PiggyBank, sub: 'Across all wholesalers' },
          { label: 'Verified Payments', val: totalVerifiedPayments, color: '#8B5CF6', icon: ShieldCheck, sub: 'Confirmed by wholesaler' },
          { label: 'Pending Verification', val: totalPendingVerification, color: '#F97316', icon: Clock, sub: 'Awaiting wholesaler' },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} style={{ ...card(), padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 14, transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 16px rgba(148,163,184,0.06)'; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${c.color}15`, border: `1.5px solid ${c.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 22, height: 22, color: c.color }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#1E293B', marginTop: 3, fontFamily: 'monospace' }}>{fmtRs(c.val)}</div>
                <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2 }}>{c.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Purchases Summary */}
      <div style={card()}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package style={{ width: 16, height: 16, color: '#3B82F6' }} /> Recent B2B Purchases
          </h3>
          <button onClick={() => setActiveTab('purchases')} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            View All <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Invoice ID', 'Wholesaler', 'Amount', 'Advance Used', 'Status', 'Due'].map(h => (
                  <th key={h} style={{ padding: '12px 18px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.slice(0, 5).map(p => {
                const st = p.settleStatus || 'UNPAID';
                const meta = SETTLE_META[st] || SETTLE_META.UNPAID;
                const SIcon = meta.icon;
                const due = p.netAmount - (p.advanceApplied || 0) - (st === 'VERIFIED' ? (p.settleAmount || 0) : 0);
                return (
                  <tr key={p.id} onClick={() => { setSelectedOrder(p); setIsSaleModal(false); }}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '13px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#475569', fontSize: 12 }}>
                      #{p.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td style={{ padding: '13px 18px', fontWeight: 700, color: '#1E293B' }}>{p.wholesaler?.companyName || '—'}</td>
                    <td style={{ padding: '13px 18px', fontWeight: 800, color: '#1E293B', fontFamily: 'monospace' }}>{fmtRs(p.netAmount)}</td>
                    <td style={{ padding: '13px 18px', fontWeight: 700, color: '#8B5CF6', fontFamily: 'monospace' }}>
                      {p.advanceApplied > 0 ? fmtRs(p.advanceApplied) : '—'}
                    </td>
                    <td style={{ padding: '13px 18px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg }}>
                        <SIcon style={{ width: 11, height: 11 }} /> {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: '13px 18px', fontWeight: 800, color: due > 0 ? '#EF4444' : '#10B981', fontFamily: 'monospace' }}>
                      {due > 0 ? fmtRs(due) : '✓ Cleared'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Returns Summary */}
      {returns.length > 0 && (
        <div style={card()}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
              <RefreshCw style={{ width: 16, height: 16, color: '#F97316' }} /> Return Requests
            </h3>
            <button onClick={() => setActiveTab('returns')} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              View All <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <div style={{ padding: '12px 24px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Pending', count: returns.filter(r => r.status === 'PENDING').length, color: '#F59E0B' },
              { label: 'Approved', count: returns.filter(r => r.status === 'APPROVED').length, color: '#10B981' },
              { label: 'Rejected', count: returns.filter(r => r.status === 'REJECTED').length, color: '#EF4444' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${s.color}10`, borderRadius: 10, padding: '8px 14px', border: `1px solid ${s.color}25` }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'block' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>{s.label}:</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: s.color }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Purchase Table
  const renderPurchases = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter Bar */}
      <div style={{ ...card(), padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', borderRadius: 10, padding: '9px 14px', border: '1px solid #E2E8F0' }}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input ref={searchRef} type="text" placeholder="Search invoice, wholesaler…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: '#334155', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'UNPAID', 'PENDING_VERIFICATION', 'VERIFIED'] as const).map(s => {
            const m = s !== 'all' ? SETTLE_META[s] : null;
            return (
              <button key={s} onClick={() => setFilterSettle(s)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1.5px solid ${filterSettle === s ? (m?.color || '#3B82F6') : '#E2E8F0'}`,
                background: filterSettle === s ? (m?.bg || 'rgba(59,130,246,0.08)') : '#FFFFFF',
                color: filterSettle === s ? (m?.color || '#3B82F6') : '#64748B',
              }}>
                {s === 'all' ? 'All' : m?.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700, marginLeft: 'auto' }}>
          {filteredPurchases.length} orders
        </div>
      </div>

      <div style={card()}>
        {filteredPurchases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
            <Package style={{ width: 40, height: 40, color: '#E2E8F0', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>No purchase orders found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                  {['Invoice', 'Wholesaler', 'Order Date', 'Net Amount', 'Advance Used', 'Pay Status', 'Due Amount', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '14px 18px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map(p => {
                  const st = p.settleStatus || 'UNPAID';
                  const meta = SETTLE_META[st] || SETTLE_META.UNPAID;
                  const SIcon = meta.icon;
                  const effectivePaid = st === 'VERIFIED' ? (p.settleAmount || 0) : 0;
                  const due = Math.max(p.netAmount - (p.advanceApplied || 0) - effectivePaid, 0);
                  const canSettle = p.status === 'DELIVERED' && (st === 'UNPAID' || st === 'REJECTED');
                  return (
                    <tr key={p.id}
                      onClick={() => { setSelectedOrder(p); setIsSaleModal(false); }}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#475569', fontSize: 12 }}>
                        #{p.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#1E293B' }}>{p.wholesaler?.companyName || '—'}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{p.wholesaler?.address || ''}</div>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#64748B', fontSize: 12, whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{new Date(p.createdAt).toLocaleDateString()}</div>
                        <div style={{ fontSize: 10, color: '#CBD5E1' }}>{new Date(p.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 800, color: '#1E293B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {fmtRs(p.netAmount)}
                        {p.discountAmount > 0 && <div style={{ fontSize: 11, color: '#10B981' }}>-{fmtRs(p.discountAmount)} disc</div>}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#8B5CF6', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {(p.advanceApplied || 0) > 0 ? fmtRs(p.advanceApplied) : <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, width: 'fit-content' }}>
                            <SIcon style={{ width: 11, height: 11 }} /> {meta.label}
                          </span>
                          {st === 'PENDING_VERIFICATION' && p.settleAmount && (
                            <div style={{ fontSize: 10, color: '#94A3B8' }}>{fmtRs(p.settleAmount)} via {p.settleMethod}</div>
                          )}
                          {st === 'VERIFIED' && p.settleAmount && (
                            <div style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>✓ {fmtRs(p.settleAmount)} verified</div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 800, color: due > 0 ? '#EF4444' : '#10B981', whiteSpace: 'nowrap' }}>
                        {due > 0 ? fmtRs(due) : '✓ Cleared'}
                      </td>
                      <td style={{ padding: '14px 18px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button onClick={() => { setSelectedOrder(p); setIsSaleModal(false); }} title="View Details"
                            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, padding: '7px', color: '#475569', cursor: 'pointer' }}>
                            <Eye style={{ width: 13, height: 13 }} />
                          </button>
                          <button onClick={() => printInvoice(p, false)} title="Print"
                            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 7, padding: '7px', color: '#F59E0B', cursor: 'pointer' }}>
                            <Printer style={{ width: 13, height: 13 }} />
                          </button>
                          {canSettle && (
                            <button onClick={() => handleOpenSettle(p, false)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'linear-gradient(135deg, #3B82F6, #1E40AF)', border: 'none', borderRadius: 7, color: '#FFFFFF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              <DollarSign style={{ width: 11, height: 11 }} /> Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // Sales Table
  const renderSales = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card(), padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', borderRadius: 10, padding: '9px 14px', border: '1px solid #E2E8F0' }}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8' }} />
          <input type="text" placeholder="Search patient name, phone, invoice…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: '#334155', fontFamily: 'inherit' }} />
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 700, marginLeft: 'auto' }}>
          {filteredSales.length} sales
        </div>
      </div>

      <div style={card()}>
        {filteredSales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
            <Receipt style={{ width: 40, height: 40, color: '#E2E8F0', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>No B2C sales found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                  {['Invoice', 'Patient', 'Items', 'Net Amount', 'Paid', 'Due / Status', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '14px 18px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => {
                  const d = getB2CDetails(s.overrideJustification);
                  const canSettle = d.due > 0;
                  return (
                    <tr key={s.id}
                      onClick={() => { setSelectedOrder(s); setIsSaleModal(true); }}
                      style={{ cursor: 'pointer', borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#475569', fontSize: 12 }}>
                        #{s.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#1E293B' }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>📞 {d.phone}</div>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#475569', fontWeight: 600 }}>{s.items.length} item{s.items.length !== 1 ? 's' : ''}</td>
                      <td style={{ padding: '14px 18px', fontWeight: 800, color: '#1E293B', fontFamily: 'monospace' }}>
                        {fmtRs(s.netAmount)}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#10B981', fontFamily: 'monospace' }}>
                        {fmtRs(d.paid)} <div style={{ fontSize: 10, color: '#94A3B8' }}>{d.method}</div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {d.due > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}>
                            <AlertTriangle style={{ width: 11, height: 11 }} /> Due: {fmtRs(d.due)}
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.08)' }}>
                            <CheckCircle style={{ width: 11, height: 11 }} /> Fully Paid
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#64748B', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 18px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setSelectedOrder(s); setIsSaleModal(true); }}
                            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, padding: '7px', color: '#475569', cursor: 'pointer' }}>
                            <Eye style={{ width: 13, height: 13 }} />
                          </button>
                          <button onClick={() => printInvoice(s, true)}
                            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 7, padding: '7px', color: '#F59E0B', cursor: 'pointer' }}>
                            <Printer style={{ width: 13, height: 13 }} />
                          </button>
                          {canSettle && (
                            <button onClick={() => handleOpenSettle(s, true)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 7, color: '#FFFFFF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                              <DollarSign style={{ width: 11, height: 11 }} /> Collect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // Ledger Tab
  const renderLedger = () => {
    const reversedLedgers = [...ledgers].reverse();
    const totalDebit = ledgers.reduce((s, l) => s + l.debit, 0);
    const totalCredit = ledgers.reduce((s, l) => s + l.credit, 0);
    const currentBalance = ledgers.length > 0 ? ledgers[ledgers.length - 1].balance : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Ledger Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            { label: 'Total Debits (You Owe)', val: totalDebit, color: '#EF4444', icon: ArrowUpLeft },
            { label: 'Total Credits (Received)', val: totalCredit, color: '#10B981', icon: ArrowDownLeft },
            { label: 'Current Balance', val: Math.abs(currentBalance), color: currentBalance > 0 ? '#EF4444' : '#10B981', icon: BookOpen,
              sub: currentBalance > 0 ? 'You owe this amount' : currentBalance < 0 ? 'Wholesaler owes you' : 'Settled' },
            { label: 'Advance Balance', val: totalAdvanceBalance, color: '#3B82F6', icon: PiggyBank, sub: 'Available for next order' },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} style={{ ...card(), padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}12`, border: `1px solid ${c.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon style={{ width: 18, height: 18, color: c.color }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: c.color, fontFamily: 'monospace' }}>{fmtRs(c.val)}</div>
                {(c as any).sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{(c as any).sub}</div>}
              </div>
            );
          })}
        </div>

        {/* Ledger Table */}
        <div style={card()}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen style={{ width: 16, height: 16, color: '#3B82F6' }} /> Transaction Ledger
            </h3>
            <button onClick={exportLedgerCSV}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', borderRadius: 10, color: '#FFFFFF', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Download style={{ width: 13, height: 13 }} /> Export CSV
            </button>
          </div>

          {reversedLedgers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
              <BookOpen style={{ width: 40, height: 40, color: '#E2E8F0', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>No ledger entries yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Ledger entries will appear here as you make purchases and payments.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                    {['Date & Time', 'Type', 'Description', 'Party', 'Debit (Dr)', 'Credit (Cr)', 'Balance'].map(h => (
                      <th key={h} style={{ padding: '13px 18px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', textAlign: h === 'Debit (Dr)' || h === 'Credit (Cr)' || h === 'Balance' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reversedLedgers.map((entry, idx) => {
                    const meta = LEDGER_TYPE_META[entry.type] || { label: entry.type, color: '#64748B', bg: 'rgba(100,116,139,0.08)', icon: Activity, isDr: true };
                    const EntryIcon = meta.icon;
                    return (
                      <tr key={entry.id} style={{ borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '13px 18px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: '#475569', fontSize: 12 }}>{new Date(entry.createdAt).toLocaleDateString()}</div>
                          <div style={{ fontSize: 10, color: '#CBD5E1' }}>{new Date(entry.createdAt).toLocaleTimeString()}</div>
                        </td>
                        <td style={{ padding: '13px 18px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg }}>
                            <EntryIcon style={{ width: 11, height: 11 }} /> {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '13px 18px', color: '#475569', maxWidth: 280 }}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{entry.description}</div>
                          {entry.orderId && (
                            <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>
                              Order: #{entry.orderId.substring(0, 8).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '13px 18px', fontWeight: 600, color: '#64748B', fontSize: 12 }}>
                          {entry.oppositePartyName}
                        </td>
                        <td style={{ padding: '13px 18px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: entry.debit > 0 ? '#EF4444' : '#CBD5E1', whiteSpace: 'nowrap' }}>
                          {entry.debit > 0 ? fmtRs(entry.debit) : '—'}
                        </td>
                        <td style={{ padding: '13px 18px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: entry.credit > 0 ? '#10B981' : '#CBD5E1', whiteSpace: 'nowrap' }}>
                          {entry.credit > 0 ? fmtRs(entry.credit) : '—'}
                        </td>
                        <td style={{ padding: '13px 18px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: entry.balance > 0 ? '#EF4444' : entry.balance < 0 ? '#10B981' : '#64748B', whiteSpace: 'nowrap' }}>
                          {entry.balance === 0 ? '—' : entry.balance > 0 ? `${fmtRs(entry.balance)} Dr` : `${fmtRs(Math.abs(entry.balance))} Cr`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                    <td colSpan={4} style={{ padding: '14px 18px', fontWeight: 800, fontSize: 13, color: '#475569' }}>TOTALS</td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 900, color: '#EF4444', fontFamily: 'monospace' }}>{fmtRs(totalDebit)}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 900, color: '#10B981', fontFamily: 'monospace' }}>{fmtRs(totalCredit)}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 900, color: currentBalance > 0 ? '#EF4444' : '#10B981', fontFamily: 'monospace' }}>
                      {currentBalance === 0 ? 'Settled' : currentBalance > 0 ? `${fmtRs(currentBalance)} Dr` : `${fmtRs(Math.abs(currentBalance))} Cr`}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Returns Tab
  const renderReturns = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={card()}>
        {returns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
            <RefreshCw style={{ width: 40, height: 40, color: '#E2E8F0', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>No return requests</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                  {['Return ID', 'Order', 'Wholesaler', 'Items', 'Billing Adj.', 'Status', 'Requested', 'Reason'].map(h => (
                    <th key={h} style={{ padding: '13px 18px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {returns.map(r => {
                  let items: ReturnRequestItem[] = [];
                  try { items = JSON.parse(r.itemsJson); } catch {}
                  const statusColors: Record<string, { color: string; bg: string }> = {
                    PENDING:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
                    APPROVED: { color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
                    REJECTED: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
                  };
                  const sc = statusColors[r.status] || statusColors.PENDING;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 700, color: '#475569', fontSize: 12 }}>
                        #{r.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: 600, color: '#64748B', fontSize: 12 }}>
                        #{r.orderId.substring(0, 8).toUpperCase()}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#1E293B' }}>
                        {r.order?.wholesaler?.companyName || '—'}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#64748B', fontWeight: 600 }}>
                        {items.length} item{items.length !== 1 ? 's' : ''}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {r.adjustBilling ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#8B5CF6', background: 'rgba(139,92,246,0.08)' }}>
                            <CheckCircle style={{ width: 10, height: 10 }} /> Yes
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: 11 }}>No</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg }}>
                          {r.status === 'PENDING' && <Clock style={{ width: 11, height: 11 }} />}
                          {r.status === 'APPROVED' && <CheckCircle style={{ width: 11, height: 11 }} />}
                          {r.status === 'REJECTED' && <X style={{ width: 11, height: 11 }} />}
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#64748B', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#475569', fontSize: 12, maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.reason || '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  /* ─── Main Render ─── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0', maxWidth: 1280, margin: '0 auto' }}>

      {/* ─ Page Header ─ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #1E40AF, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt style={{ width: 20, height: 20, color: '#FFFFFF' }} />
            </div>
            Billing & Ledger
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '6px 0 0', paddingLeft: 50 }}>
            Comprehensive financial statements, ledger, returns & payment management
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchBillingData}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 10, color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Refresh
          </button>
        </div>
      </div>

      {/* ─ Tabs Navigation ─ */}
      <div style={{ background: '#F8FAFC', borderRadius: 14, padding: 5, border: '1px solid #E2E8F0', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {([
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'purchases', label: `B2B Purchases (${purchases.length})`, icon: Package },
          { id: 'sales', label: `B2C Sales (${sales.length})`, icon: Receipt },
          { id: 'ledger', label: 'Ledger Account', icon: BookOpen },
          { id: 'returns', label: `Returns (${returns.length})`, icon: RefreshCw },
        ] as const).map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(''); setFilterStatus('all'); setFilterSettle('all'); }}
              style={tabBtnStyle(isActive)}>
              <TabIcon style={{ width: 14, height: 14 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─ Tab Content ─ */}
      {activeTab === 'overview'   && renderOverview()}
      {activeTab === 'purchases'  && renderPurchases()}
      {activeTab === 'sales'      && renderSales()}
      {activeTab === 'ledger'     && renderLedger()}
      {activeTab === 'returns'    && renderReturns()}

      {/* ─ Order Detail Modal ─ */}
      {selectedOrder && (() => {
        const isSale = isSaleModal;
        const d = isSale ? getB2CDetails(selectedOrder.overrideJustification) : null;
        const sm = STATUS_COLORS[selectedOrder.status] || { color: '#64748B', bg: 'rgba(100,116,139,0.08)' };
        const settleKey = selectedOrder.settleStatus || 'UNPAID';
        const pm = SETTLE_META[settleKey] || SETTLE_META.UNPAID;
        const PayIcon = pm.icon;
        const effectivePaid = settleKey === 'VERIFIED' ? (selectedOrder.settleAmount || 0) : 0;
        const dueAmount = isSale ? (d?.due || 0) : Math.max(selectedOrder.netAmount - (selectedOrder.advanceApplied || 0) - effectivePaid, 0);
        const canSettle = isSale ? (d && d.due > 0) : (selectedOrder.status === 'DELIVERED' && (settleKey === 'UNPAID' || settleKey === 'REJECTED'));

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 620, background: '#FFFFFF', borderRadius: 22, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.14)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(30,64,175,0.03), rgba(59,130,246,0.02))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg, #1E40AF, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt style={{ width: 20, height: 20, color: '#FFFFFF' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0 }}>
                      {isSale ? 'B2C Sales Invoice' : 'B2B Purchase Order'}
                    </h3>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, fontFamily: 'monospace' }}>
                      #{selectedOrder.id.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg }}>{selectedOrder.status}</span>
                  {!isSale && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: pm.color, background: pm.bg }}>
                      <PayIcon style={{ width: 10, height: 10 }} /> {pm.label}
                    </span>
                  )}
                  {isSale && d && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: d.due > 0 ? '#EF4444' : '#10B981', background: d.due > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)' }}>
                      {d.due > 0 ? <AlertTriangle style={{ width: 10, height: 10 }} /> : <CheckCircle style={{ width: 10, height: 10 }} />}
                      {d.due > 0 ? `Due: ${fmtRs(d.due)}` : 'Paid'}
                    </span>
                  )}
                  <button onClick={() => setSelectedOrder(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px', cursor: 'pointer', color: '#64748B' }}>
                    <X style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { icon: Calendar, label: 'Date', val: new Date(selectedOrder.createdAt).toLocaleString() },
                    { icon: Hash,     label: 'Status', val: selectedOrder.status },
                    isSale
                      ? { icon: User,     label: 'Patient',  val: d?.name || 'Walk-in Customer' }
                      : { icon: Building, label: 'Wholesaler', val: selectedOrder.wholesaler?.companyName || '—' },
                    isSale
                      ? { icon: Phone, label: 'Phone',   val: d?.phone || 'N/A' }
                      : { icon: Phone, label: 'Contact', val: selectedOrder.wholesaler?.phone || '—' },
                  ].map((row, i) => {
                    if (!row) return null;
                    const RI = row.icon;
                    return (
                      <div key={i} style={{ background: '#F8FAFC', borderRadius: 10, padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                          <RI style={{ width: 11, height: 11, color: '#94A3B8' }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{row.label}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{row.val}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Financial Breakdown */}
                {!isSale && (
                  <div style={{ background: dueAmount > 0 ? 'rgba(239,68,68,0.04)' : 'rgba(16,185,129,0.04)', border: `1px solid ${dueAmount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}`, borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: dueAmount > 0 ? '#EF4444' : '#10B981', textTransform: 'uppercase', marginBottom: 12 }}>Payment Breakdown</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Order Total', val: selectedOrder.netAmount, color: '#1E293B' },
                        { label: 'Advance Applied', val: -(selectedOrder.advanceApplied || 0), color: '#8B5CF6', hide: !selectedOrder.advanceApplied },
                        { label: 'Settlement Paid', val: -(selectedOrder.settleAmount || 0), color: '#10B981', hide: !selectedOrder.settleAmount },
                        { label: 'Outstanding Due', val: dueAmount, color: dueAmount > 0 ? '#EF4444' : '#10B981', bold: true },
                      ].filter(row => !row.hide).map((row, i, arr) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(i === arr.length - 1 ? { borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 8, marginTop: 4 } : {}) }}>
                          <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 600, color: '#475569' }}>{row.label}</span>
                          <span style={{ fontSize: 14, fontWeight: row.bold ? 900 : 700, color: row.color, fontFamily: 'monospace' }}>
                            {row.val < 0 ? `-${fmtRs(Math.abs(row.val))}` : fmtRs(row.val)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 11, color: '#64748B' }}>Payment Status:</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: pm.color, background: pm.bg }}>
                        <PayIcon style={{ width: 10, height: 10 }} /> {pm.label}
                      </span>
                      {settleKey === 'PENDING_VERIFICATION' && (
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>{fmtRs(selectedOrder.settleAmount || 0)} via {selectedOrder.settleMethod}</span>
                      )}
                    </div>
                  </div>
                )}

                {isSale && d && (
                  <div style={{ background: d.due === 0 ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${d.due === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`, borderRadius: 14, padding: '16px 18px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: d.due === 0 ? '#10B981' : '#EF4444', textTransform: 'uppercase', marginBottom: 12 }}>B2C Payment Summary</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      {[
                        { label: 'Total Bill', val: fmtRs(selectedOrder.netAmount), color: '#1E293B' },
                        { label: 'Paid', val: fmtRs(d.paid), color: '#10B981' },
                        { label: 'Outstanding', val: fmtRs(d.due), color: d.due > 0 ? '#EF4444' : '#10B981' },
                      ].map((g, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 4 }}>{g.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: g.color, fontFamily: 'monospace' }}>{g.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: '#64748B' }}>Method: <strong>{d.method}</strong></div>
                  </div>
                )}

                {/* Items */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.05em' }}>Medicines / Items</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedOrder.items.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #F1F5F9' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1E293B', fontSize: 13 }}>{item.product.name}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>{item.product.sku}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: '#1E293B' }}>{fmtRs(item.quantity * item.pricePerUnit)}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{item.quantity} × {fmtRs(item.pricePerUnit)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748B' }}>
                      <span>Gross Total:</span><span>{fmtRs(selectedOrder.totalAmount)}</span>
                    </div>
                    {selectedOrder.discountAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#EF4444' }}>
                        <span>Discount:</span><span>-{fmtRs(selectedOrder.discountAmount)}</span>
                      </div>
                    )}
                    {(selectedOrder.advanceApplied || 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#8B5CF6' }}>
                        <span>Advance Applied:</span><span>-{fmtRs(selectedOrder.advanceApplied)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: '#1E293B', borderTop: '1px solid #E2E8F0', paddingTop: 8, marginTop: 4 }}>
                      <span>Net Bill:</span>
                      <span style={{ color: '#1E40AF' }}>{fmtRs(selectedOrder.netAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, flexShrink: 0 }}>
                <button onClick={() => setSelectedOrder(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                  Close
                </button>
                {canSettle && (
                  <button onClick={() => { setSelectedOrder(null); handleOpenSettle(selectedOrder, isSale); }}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: 'linear-gradient(135deg, #1E40AF, #3B82F6)', color: '#FFFFFF' }}>
                    💳 Settle Payment
                  </button>
                )}
                <button onClick={() => printInvoice(selectedOrder, isSale)}
                  style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Printer style={{ width: 15, height: 15 }} /> Print Invoice
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─ Settle Payment Modal ─ */}
      {settleOrder && (() => {
        const b2cDetails = settleIsB2C ? getB2CDetails(settleOrder.overrideJustification) : null;
        const st = settleOrder.settleStatus || 'UNPAID';
        const maxVal = settleIsB2C
          ? (b2cDetails?.due || 0)
          : Math.max(settleOrder.netAmount - (settleOrder.advanceApplied || 0) - (st === 'VERIFIED' ? (settleOrder.settleAmount || 0) : 0), 0);

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 460, background: '#FFFFFF', borderRadius: 22, overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.2)' }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(30,64,175,0.05), rgba(59,130,246,0.02))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(135deg, #1E40AF, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign style={{ width: 20, height: 20, color: '#FFFFFF' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', margin: 0 }}>
                      {settleIsB2C ? 'Collect Patient Due' : 'Submit B2B Payment'}
                    </h3>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, fontFamily: 'monospace' }}>
                      #{settleOrder.id.substring(0, 8).toUpperCase()} · {settleIsB2C ? b2cDetails?.name : settleOrder.wholesaler?.companyName}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSettleOrder(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px', cursor: 'pointer', color: '#64748B' }}>
                  <X style={{ width: 15, height: 15 }} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Amount info */}
                <div style={{ background: '#F8FAFC', borderRadius: 14, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>
                      {settleIsB2C ? 'Patient Outstanding Due' : 'Amount Due to Wholesaler'}
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#EF4444', fontFamily: 'monospace', marginTop: 4 }}>
                      {fmtRs(maxVal)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>Invoice Total</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#475569', marginTop: 4, fontFamily: 'monospace' }}>{fmtRs(settleOrder.netAmount)}</div>
                  </div>
                </div>

                {/* Amount Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Payment Amount (Rs.)
                  </label>
                  <input type="number" value={settleAmount} onChange={e => setSettleAmountVal(e.target.value)}
                    min={1} max={maxVal}
                    style={{ padding: '13px 16px', borderRadius: 12, border: '2px solid #E2E8F0', fontSize: 20, fontWeight: 800, outline: 'none', fontFamily: 'monospace', color: '#1E293B', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#3B82F6'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                  />
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>
                    Partial payments allowed • Max: {fmtRs(maxVal)}
                    {!settleIsB2C && (
                      <span style={{ display: 'block', marginTop: 2, color: '#F59E0B' }}>
                        ⚡ Will be submitted for wholesaler verification
                      </span>
                    )}
                  </div>
                </div>

                {/* Payment Method */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Method</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {PAYMENT_METHODS.map(m => {
                      const MIcon = m.icon;
                      const selected = settleMethod === m.id;
                      const isEnabled = settleIsB2C ? true : m.enabled;
                      return (
                        <button key={m.id} disabled={!isEnabled} onClick={() => isEnabled && setSettleMethod(m.id)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 8px',
                            borderRadius: 10, border: `1.5px solid ${selected ? '#1E40AF' : isEnabled ? '#E2E8F0' : '#F1F5F9'}`,
                            background: selected ? 'rgba(30,64,175,0.08)' : '#F8FAFC',
                            color: selected ? '#1E40AF' : isEnabled ? '#475569' : '#CBD5E1',
                            cursor: isEnabled ? 'pointer' : 'not-allowed',
                            fontSize: 10, fontWeight: 800, fontFamily: 'inherit', opacity: isEnabled ? 1 : 0.5,
                          }}>
                          <MIcon style={{ width: 16, height: 16 }} />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {settleError && (
                  <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                    ⚠ {settleError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10 }}>
                <button onClick={() => setSettleOrder(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                  Cancel
                </button>
                <button onClick={handleSubmitSettlement} disabled={settleLoading}
                  style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: settleLoading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #1E40AF, #3B82F6)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: settleLoading ? 0.7 : 1 }}>
                  <ShieldCheck style={{ width: 16, height: 16 }} />
                  {settleLoading ? 'Processing…' : `Confirm ${fmtRs(parseFloat(settleAmount || '0'))}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
