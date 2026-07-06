'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Receipt, Search, Printer, Eye, TrendingUp, TrendingDown,
  X, Package, User, Phone, Building, Calendar, Hash,
  AlertTriangle, CheckCircle, Clock, CreditCard, Banknote,
  Wallet, ShieldCheck, PiggyBank, Plus, RefreshCw, LayoutList,
  ChevronDown, FileText, ArrowDownLeft, ArrowUpLeft, Download
} from 'lucide-react';
import { settleB2CDueAction } from '@/app/actions/retailerActions';
import { useRealtimeEvent } from '@/lib/events';

interface OrderItem {
  id: string;
  quantity: number;
  pricePerUnit: number;
  product: { name: string; sku: string; };
}

interface B2BSettlement {
  id: string;
  amount: number;
  method?: string | null;
  status: string;
  createdAt: string;
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
  b2bSettlements?: B2BSettlement[];
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

const SETTLE_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  UNPAID:               { label: 'Due',        color: '#EF4444', bg: '#FEF2F2', icon: AlertTriangle },
  PENDING_VERIFICATION: { label: 'Pending',    color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
  VERIFIED:             { label: 'Paid',       color: '#10B981', bg: '#F0FDF4', icon: CheckCircle },
  REJECTED:             { label: 'Rejected',   color: '#EF4444', bg: '#FEF2F2', icon: AlertTriangle },
};

const PAYMENT_METHODS = [
  { id: 'CASH',     label: 'Cash',          icon: Banknote },
  { id: 'COD',      label: 'COD',           icon: Package },
  { id: 'UPI',      label: 'UPI / QR',      icon: Wallet },
  { id: 'BANK',     label: 'Bank Transfer', icon: CreditCard },
];

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

const fmtRs = (n: number) => `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--card-border)',
  outline: 'none',
  fontSize: 13,
  width: '100%',
  background: 'var(--card-bg)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box' as const,
};

const thStyle: React.CSSProperties = {
  padding: '11px 16px',
  color: 'var(--text-muted)',
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

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

  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'returns'>('overview');
  
  // Registry settings
  const [searchQuery, setSearchQuery]   = useState('');
  const [filterType, setFilterType]     = useState<'all' | 'b2b' | 'b2c' | 'online'>('all');
  const [filterSettle, setFilterSettle] = useState('all');
  const [detailedView, setDetailedView] = useState(false);
  const [selectedFY, setSelectedFY]     = useState<string>('all');

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isSaleModal, setIsSaleModal]   = useState(false);
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
      if (e.key === '/') {
        // Prevent hijacking if user is typing inside an input/textarea
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSelectedOrder(null);
        setSettleOrder(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const searchParams = useSearchParams();
  const billingRouter = useRouter();
  const handledInvoiceRef = useRef<string | null>(null);

  const tryOpenInvoice = useCallback((invoiceId: string) => {
    if (!invoiceId || handledInvoiceRef.current === invoiceId) return;
    const matchedSale = sales.find(s => s.id.toLowerCase().includes(invoiceId.toLowerCase()) || invoiceId.toLowerCase().includes(s.id.substring(0, 8).toLowerCase()));
    if (matchedSale) {
      handledInvoiceRef.current = invoiceId;
      setSelectedOrder(matchedSale);
      setIsSaleModal(true);
      billingRouter.replace('/retailer/billing', { scroll: false });
      return;
    }
    const matchedPurchase = purchases.find(p => p.id.toLowerCase().includes(invoiceId.toLowerCase()) || invoiceId.toLowerCase().includes(p.id.substring(0, 8).toLowerCase()));
    if (matchedPurchase) {
      handledInvoiceRef.current = invoiceId;
      setSelectedOrder(matchedPurchase);
      setIsSaleModal(false);
      billingRouter.replace('/retailer/billing', { scroll: false });
    }
  }, [sales, purchases, billingRouter]);

  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId') || searchParams.get('search');
    if (invoiceId) tryOpenInvoice(invoiceId);
  }, [searchParams, tryOpenInvoice]);

  const getOrderPaid = (order: any): number => {
    if (order.b2bSettlements && Array.isArray(order.b2bSettlements)) {
      return order.b2bSettlements.filter((s: any) => s.status === 'VERIFIED').reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    }
    return order.settleAmount || 0;
  };

  const getOrderPendingSettle = (order: any): number => {
    if (order.b2bSettlements && Array.isArray(order.b2bSettlements)) {
      return order.b2bSettlements.filter((s: any) => s.status === 'PENDING').reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    }
    return order.settleStatus === 'PENDING_VERIFICATION' ? (order.settleAmount || 0) : 0;
  };

  const totalOutstandingDue = purchases.reduce((s, p) => s + Math.max(p.netAmount - getOrderPaid(p), 0), 0);
  const totalVerifiedPayments = purchases.reduce((s, p) => s + getOrderPaid(p), 0);
  const totalPendingVerification = purchases.reduce((s, p) => s + getOrderPendingSettle(p), 0);
  const totalSalesRevenue = sales.reduce((s, o) => s + o.netAmount, 0);
  const totalPurchaseCost = purchases.reduce((s, o) => s + o.netAmount, 0);

  const handleOpenSettle = (order: Order, isB2C: boolean) => {
    const d = isB2C ? getB2CDetails(order.overrideJustification) : null;
    setSettleOrder(order);
    setSettleIsB2C(isB2C);
    setSettleError('');
    setSettleMethod(d ? d.method : 'CASH');
    setSettleAmountVal(String(d ? d.due : Math.max(order.netAmount - getOrderPaid(order), 0)));
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
        const newSettleEntry = { id: data.settlementId || `tmp-${Date.now()}`, amount: amt, method: settleMethod, status: 'PENDING', createdAt: new Date().toISOString() };
        setPurchases(prev => prev.map(p => p.id === settleOrder.id
          ? { ...p, settleStatus: 'PENDING_VERIFICATION', settleAmount: amt, settleMethod, b2bSettlements: [...(p.b2bSettlements || []), newSettleEntry] }
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

  const printInvoice = (order: Order, isSale: boolean) => {
    const d = isSale ? getB2CDetails(order.overrideJustification) : null;
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    const rows = order.items.map(i =>
      `<tr><td>${i.product.name}</td><td>${i.product.sku}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">Rs. ${i.pricePerUnit.toLocaleString()}</td><td style="text-align:right">Rs. ${(i.quantity * i.pricePerUnit).toLocaleString()}</td></tr>`
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Invoice</title><style>body{font-family:monospace;padding:30px}table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid #ddd;font-size:12px;text-align:left}.right{text-align:right}</style></head><body><h2>MEDHUB PHARMACY STATEMENT</h2><div>Invoice: ${order.id}</div><div>Date: ${new Date(order.createdAt).toLocaleString()}</div><table><thead><tr><th>Medicine</th><th>SKU</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Total</th></tr></thead><tbody>${rows}</tbody></table><h4>Total Amount: Rs. ${order.netAmount.toLocaleString()}</h4><script>window.onload=function(){window.print();window.close();}</script></body></html>`);
    win.document.close();
  };

  const exportLedgerCSV = () => {
    const headers = ['Date', 'Type', 'Description', 'Debit (Rs)', 'Credit (Rs)', 'Running Balance (Rs)'];
    const rows = [...ledgers].reverse().map(l => [
      new Date(l.createdAt).toLocaleString(),
      l.type,
      l.description,
      l.debit || 0,
      l.credit || 0,
      l.balance,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Pharmacy_Ledger_Statement.csv'; a.click();
  };

  // Unified Overview Transactions mapping B2B, B2C, Online B2C
  const b2bTx = purchases.map(p => {
    const paid = getOrderPaid(p);
    const due = Math.max(p.netAmount - paid, 0);
    return {
      id: p.id,
      date: p.createdAt,
      type: 'B2B Purchase',
      party: p.wholesaler?.companyName || 'Unknown Wholesaler',
      amount: p.netAmount,
      due: due,
      shipmentStatus: p.status, // Shipment status e.g. DELIVERED, DISPATCHED, PENDING
      itemsCount: p.items.length,
      itemsText: p.items.map(i => `${i.product.name} (x${i.quantity})`).join(', '),
      status: p.settleStatus || 'UNPAID',
      raw: p,
      isSale: false,
      rawType: 'b2b'
    };
  });

  const b2cTx = sales.map(s => {
    const d = getB2CDetails(s.overrideJustification);
    const isOnline = s.overrideJustification?.includes('Online') || false;
    return {
      id: s.id,
      date: s.createdAt,
      type: isOnline ? 'Online B2C Sale' : 'B2C POS Counter',
      party: d.name || 'Walk-in Customer',
      amount: s.netAmount,
      due: d.due,
      shipmentStatus: s.status, // Sales status e.g. DELIVERED, PENDING, SHIPPED
      itemsCount: s.items.length,
      itemsText: s.items.map(i => `${i.product.name} (x${i.quantity})`).join(', '),
      status: d.due > 0 ? 'UNPAID' : 'VERIFIED',
      raw: s,
      isSale: true,
      rawType: isOnline ? 'online' : 'b2c'
    };
  });

  const allTransactions = [...b2bTx, ...b2cTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Derive available FY options from transactions (Indian FY: Apr–Mar)
  const getFY = (dateStr: string) => {
    const d = new Date(dateStr);
    const yr = d.getFullYear();
    const mo = d.getMonth(); // 0=Jan .. 11=Dec
    return mo >= 3 ? `FY ${yr}-${String(yr + 1).slice(2)}` : `FY ${yr - 1}-${String(yr).slice(2)}`;
  };
  const availableFYs = Array.from(new Set(allTransactions.map(t => getFY(t.date)))).sort().reverse();

  const filteredTransactions = allTransactions.filter(t => {
    const matchesType = filterType === 'all' || t.rawType === filterType;
    const matchesSettle = filterSettle === 'all' || t.status === filterSettle || (filterSettle === 'UNPAID' && t.status !== 'VERIFIED');
    const matchesFY = selectedFY === 'all' || getFY(t.date) === selectedFY;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || t.id.toLowerCase().includes(q) || t.party.toLowerCase().includes(q) || t.itemsText.toLowerCase().includes(q);
    return matchesType && matchesSettle && matchesFY && matchesSearch;
  });

  const Modal = ({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 580, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Pharmacy Financial &amp; Billing Center</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>B2B procurement settlement &amp; B2C transaction history</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* FY Year Selector */}
          {availableFYs.length > 0 && (
            <div style={{ display: 'flex', gap: 3, background: 'var(--table-header-bg)', padding: 3, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <button
                onClick={() => setSelectedFY('all')}
                style={{ padding: '5px 10px', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: selectedFY === 'all' ? 'var(--card-bg)' : 'transparent', color: selectedFY === 'all' ? '#F59E0B' : 'var(--text-muted)', transition: 'all 0.1s' }}
              >
                All Years
              </button>
              {availableFYs.map(fy => (
                <button
                  key={fy}
                  onClick={() => setSelectedFY(fy)}
                  style={{ padding: '5px 10px', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: selectedFY === fy ? 'var(--card-bg)' : 'transparent', color: selectedFY === fy ? '#F59E0B' : 'var(--text-muted)', transition: 'all 0.1s' }}
                >
                  {fy}
                </button>
              ))}
            </div>
          )}
          {(['overview', 'ledger', 'returns'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: activeTab === tab ? '#F59E0B' : 'var(--card-bg)',
                color: activeTab === tab ? '#FFFFFF' : 'var(--text-secondary)',
                border: activeTab === tab ? 'none' : '1px solid var(--card-border)',
                transition: 'all 0.15s'
              }}
            >
              {tab === 'overview' ? 'Transactions' : tab === 'ledger' ? 'Audit Ledger' : 'Returns'}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>
          {/* Wholesaler Relations Advance Balances */}
          {relations.length > 0 && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
              {relations.map(rel => (
                <div key={rel.id} style={{ flex: 1, minWidth: 260, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#3B82F6', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PiggyBank style={{ width: 18, height: 18 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Advance with {rel.wholesaler.companyName}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1E3A8A', marginTop: 2, fontFamily: 'monospace' }}>
                      {fmtRs(rel.advanceBalance)}
                    </div>
                    <div style={{ fontSize: 10, color: '#1E40AF', marginTop: 1, opacity: 0.8 }}>
                      Credit Limit: {fmtRs(rel.creditLimit)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Overview stats */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Sales Revenue', val: totalSalesRevenue, color: '#10B981' },
              { label: 'B2B Purchases', val: totalPurchaseCost, color: '#F59E0B' },
              { label: 'B2B Outstanding Due', val: totalOutstandingDue, color: '#EF4444' },
              { label: 'B2B Verified Payments', val: totalVerifiedPayments, color: '#3B82F6' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 200 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{fmtRs(s.val)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginLeft: 'auto' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Filter configuration */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', flexWrap: 'wrap', alignItems: 'center' }}>
            
            {/* Filter Buttons replacing option select */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--table-header-bg)', padding: 3, borderRadius: 8, border: '1px solid var(--card-border)' }}>
              {([
                { id: 'all', label: 'All Trans' },
                { id: 'b2b', label: 'B2B Purchase' },
                { id: 'b2c', label: 'POS Counter' },
                { id: 'online', label: 'Online B2C' }
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilterType(t.id)}
                  style={{
                    padding: '6px 12px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: filterType === t.id ? 'var(--card-bg)' : 'transparent',
                    color: filterType === t.id ? '#F59E0B' : 'var(--text-secondary)',
                    boxShadow: filterType === t.id ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.1s'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--table-header-bg)', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <Search style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
              <input ref={searchRef} type="text" placeholder="Search party, invoice number or medicine…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--text-primary)' }} />
            </div>

            {/* Detailed View Toggle */}
            <button
              onClick={() => setDetailedView(!detailedView)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <LayoutList style={{ width: 14, height: 14 }} />
              {detailedView ? 'Simple View' : 'Detailed View'}
            </button>

            {/* Settlement select */}
            <select value={filterSettle} onChange={(e) => setFilterSettle(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, outline: 'none', background: 'var(--table-header-bg)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              <option value="all">All Settle Status</option>
              <option value="UNPAID">Outstanding Due</option>
              <option value="VERIFIED">Fully Paid</option>
              <option value="PENDING_VERIFICATION">Awaiting Wholesaler</option>
            </select>

            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{filteredTransactions.length} items</span>
          </div>

          {/* Main Transactions registry */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Invoice Reference</th>
                  <th style={thStyle}>Trans Type</th>
                  <th style={thStyle}>Party Name</th>
                  {detailedView && <th style={thStyle}>Items breakdown</th>}
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Remaining Due</th>
                  <th style={thStyle}>Shipment Status</th>
                  <th style={thStyle}>Billing Status</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const sm = SETTLE_META[tx.status] || SETTLE_META.UNPAID;
                  return (
                    <tr key={tx.id} onClick={() => { setSelectedOrder(tx.raw); setIsSaleModal(tx.isSale); }}
                      style={{ borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--table-header-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{new Date(tx.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>#{tx.id.substring(0, 8).toUpperCase()}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{tx.type}</td>
                      <td style={{ padding: '12px 16px' }}>{tx.party}</td>
                      {detailedView && <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.itemsText}</td>}
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>{fmtRs(tx.amount)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 750, color: tx.due > 0 ? '#EF4444' : '#10B981', fontFamily: 'monospace' }}>
                        {tx.due > 0 ? fmtRs(tx.due) : '✓ Settled'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: tx.shipmentStatus === 'DELIVERED' ? '#F0FDF4' : '#FFFBEB', color: tx.shipmentStatus === 'DELIVERED' ? '#10B981' : '#D97706' }}>
                          {tx.shipmentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: sm.bg, color: sm.color }}>{sm.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          {tx.due > 0 && (
                            <button onClick={() => handleOpenSettle(tx.raw, tx.isSale)} style={{ padding: '4px 8px', background: '#F59E0B', border: 'none', borderRadius: 6, color: '#FFFFFF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Settle</button>
                          )}
                          <button onClick={() => { setSelectedOrder(tx.raw); setIsSaleModal(tx.isSale); }} style={{ padding: 5, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}><Eye style={{ width: 13, height: 13 }} /></button>
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

      {/* LEDGER TAB */}
      {activeTab === 'ledger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-secondary)' }}>Pharmacy Fiscal Ledger Statement</span>
            <button onClick={exportLedgerCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Download style={{ width: 14, height: 14 }} /> Export CSV Statement
            </button>
          </div>
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={thStyle}>Timestamp</th>
                  <th style={thStyle}>Action / Type</th>
                  <th style={thStyle}>Opposite Party</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Debit (Dr)</th>
                  <th style={thStyle}>Credit (Cr)</th>
                  <th style={thStyle}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {[...ledgers].reverse().map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{new Date(l.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.type}</td>
                    <td style={{ padding: '12px 16px' }}>{l.oppositePartyName}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{l.description}</td>
                    <td style={{ padding: '12px 16px', color: '#EF4444', fontFamily: 'monospace' }}>{l.debit > 0 ? fmtRs(l.debit) : '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#10B981', fontFamily: 'monospace' }}>{l.credit > 0 ? fmtRs(l.credit) : '—'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, fontFamily: 'monospace' }}>{fmtRs(l.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RETURNS TAB */}
      {activeTab === 'returns' && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Return ID</th>
                <th style={thStyle}>Order Ref</th>
                <th style={thStyle}>Wholesaler</th>
                <th style={thStyle}>Adjust Bill</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>#{r.id.substring(0, 8).toUpperCase()}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>#{r.orderId.substring(0, 8).toUpperCase()}</td>
                  <td style={{ padding: '12px 16px' }}>{r.order.wholesaler?.companyName || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>{r.adjustBilling ? '✅ Yes' : '❌ No'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: r.status === 'APPROVED' ? '#F0FDF4' : r.status === 'PENDING' ? '#FFFBEB' : '#FEF2F2', color: r.status === 'APPROVED' ? '#10B981' : r.status === 'PENDING' ? '#D97706' : '#EF4444' }}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Transaction Details Modal ── */}
      {selectedOrder && (
        <Modal onClose={() => setSelectedOrder(null)} title={`${isSaleModal ? 'B2C Sales Receipt' : 'B2B Purchase Voucher'} Full Details`}>
          {(() => {
            const d = isSaleModal ? getB2CDetails(selectedOrder.overrideJustification) : null;
            const dueAmount = isSaleModal ? d?.due || 0 : Math.max(selectedOrder.netAmount - getOrderPaid(selectedOrder), 0);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Order Meta details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Order Type</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{isSaleModal ? 'Retail B2C Dispensation' : 'B2B Wholesale Procurement'}</div>
                  </div>
                  <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Shipment Delivery Status</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: selectedOrder.status === 'DELIVERED' ? '#10B981' : '#F59E0B' }}>{selectedOrder.status}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{isSaleModal ? 'Customer/Patient' : 'Supplier Company'}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{isSaleModal ? d?.name : selectedOrder.wholesaler?.companyName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isSaleModal ? d?.phone : selectedOrder.wholesaler?.phone}</div>
                  </div>
                  <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Billing Date</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{new Date(selectedOrder.createdAt).toLocaleDateString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(selectedOrder.createdAt).toLocaleTimeString()}</div>
                  </div>
                </div>

                <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Itemized billing list</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--card-border)' }}>
                        <span>{item.product.name} (x{item.quantity})</span>
                        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>Rs. {(item.quantity * item.pricePerUnit).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--card-border)' }}>
                    <span>Invoice Net Value</span>
                    <span style={{ color: '#F59E0B', fontFamily: 'monospace' }}>{fmtRs(selectedOrder.netAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 750, marginTop: 4, color: dueAmount > 0 ? '#EF4444' : '#10B981' }}>
                    <span>{dueAmount > 0 ? 'Remaining Outstanding Due' : 'Status'}</span>
                    <span style={{ fontFamily: 'monospace' }}>{dueAmount > 0 ? fmtRs(dueAmount) : 'Fully Settled / Paid'}</span>
                  </div>
                </div>

                {/* Settlements Timeline list inside Modal */}
                {!isSaleModal && selectedOrder.b2bSettlements && selectedOrder.b2bSettlements.length > 0 && (
                  <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Settlement Payments Timeline</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[...selectedOrder.b2bSettlements]
                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                        .map((s, idx) => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--card-bg)', borderRadius: 7, border: `1px solid ${s.status === 'VERIFIED' ? '#BBF7D0' : s.status === 'PENDING' ? '#FDE68A' : '#FECACA'}` }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: s.status === 'VERIFIED' ? '#10B981' : s.status === 'PENDING' ? '#F59E0B' : '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                              {idx + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>Rs. {s.amount.toLocaleString()} <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>via {s.method || 'CASH'}</span></div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                {s.createdAt ? `${new Date(s.createdAt).toLocaleDateString()} at ${new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—'}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: s.status === 'VERIFIED' ? '#F0FDF4' : s.status === 'PENDING' ? '#FFFBEB' : '#FEF2F2', color: s.status === 'VERIFIED' ? '#10B981' : s.status === 'PENDING' ? '#D97706' : '#EF4444' }}>
                              {s.status}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setSelectedOrder(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  {dueAmount > 0 && (
                    <button onClick={() => { const o = selectedOrder; setSelectedOrder(null); handleOpenSettle(o, isSaleModal); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#F59E0B', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Settle Bill</button>
                  )}
                  <button onClick={() => printInvoice(selectedOrder, isSaleModal)} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#10B981', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Printer style={{ width: 14, height: 14 }} /> Print</button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ── Settlement Payment Trigger Modal ── */}
      {settleOrder && (
        <Modal onClose={() => setSettleOrder(null)} title="Record Settlement Entry">
          {(() => {
            const b2cDetails = settleIsB2C ? getB2CDetails(settleOrder.overrideJustification) : null;
            const maxVal = settleIsB2C ? (b2cDetails?.due || 0) : Math.max(settleOrder.netAmount - getOrderPaid(settleOrder), 0);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--table-header-bg)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Due balance amount</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#EF4444', fontFamily: 'monospace', marginTop: 4 }}>{fmtRs(maxVal)}</div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Payment Amount (Rs.)</label>
                  <input type="number" value={settleAmount} onChange={e => setSettleAmountVal(e.target.value)} max={maxVal} style={inputStyle} />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Select Payment Method</label>
                  <select value={settleMethod} onChange={e => setSettleMethod(e.target.value)} style={inputStyle}>
                    {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>

                {settleError && <div style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{settleError}</div>}

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => setSettleOrder(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleSubmitSettlement} disabled={settleLoading} style={{ flex: 2, padding: 10, border: 'none', background: '#10B981', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {settleLoading ? 'Processing…' : `Confirm Settlement Rs. ${settleAmount}`}
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

    </div>
  );
}
