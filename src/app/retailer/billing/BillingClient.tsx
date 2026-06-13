'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Receipt, Search, Printer, Eye, TrendingUp, TrendingDown,
  X, Package, User, Phone, Building, Calendar, Hash,
  ArrowUpRight, BarChart2, ChevronDown, Layers, DollarSign,
  CheckCircle, Clock, AlertTriangle, CreditCard, Banknote,
  Wallet, Send, ShieldCheck
} from 'lucide-react';
import { useRealtimeEvent } from '@/lib/events';
import { settleB2CDueAction } from '@/app/actions/retailerActions';

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
  overrideJustification?: string | null;
  createdAt: string;
  items: OrderItem[];
  // Settlement fields
  settleStatus?: string;
  settleAmount?: number;
  settleMethod?: string;
}

interface BillingClientProps {
  initialSales: Order[];
  initialPurchases: Order[];
  profileId: string;
}

const STATUS_META: Record<string, { color: string; bg: string }> = {
  DELIVERED:  { color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  PENDING:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  PICKING:    { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' },
  DISPATCHED: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
};

const SETTLE_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  UNPAID:               { label: 'Due',        color: '#DC2626', bg: 'rgba(220,38,38,0.08)',    icon: AlertTriangle },
  PENDING_VERIFICATION: { label: 'Pending',    color: '#D97706', bg: 'rgba(217,119,6,0.08)',    icon: Clock },
  VERIFIED:             { label: 'Paid',       color: '#059669', bg: 'rgba(5,150,105,0.08)',    icon: CheckCircle },
  REJECTED:             { label: 'Rejected',   color: '#DC2626', bg: 'rgba(220,38,38,0.12)',    icon: AlertTriangle },
};

const PAYMENT_METHODS = [
  { id: 'CASH',     label: 'Cash',          icon: Banknote,  enabled: true  },
  { id: 'COD',      label: 'COD',           icon: Package,   enabled: true  },
  { id: 'UPI',      label: 'UPI / QR',      icon: Wallet,    enabled: false },
  { id: 'BANK',     label: 'Bank Transfer', icon: CreditCard,enabled: false },
  { id: 'CHEQUE',   label: 'Cheque',        icon: Send,      enabled: false },
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
    due:    dueMatch    ? parseFloat(dueMatch[1]) : 0,
    paid:   paidMatch   ? parseFloat(paidMatch[1]) : 0,
  };
};

export default function BillingClient({ initialSales, initialPurchases }: BillingClientProps) {
  const [sales, setSales]         = useState<Order[]>(initialSales);
  const [purchases, setPurchases] = useState<Order[]>(initialPurchases);
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases' | 'audit'>('sales');
  const [selectedFY, setSelectedFY] = useState<'26-27' | '25-26' | '24-25' | 'all'>('26-27');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSettle, setFilterSettle]  = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Settle payment modal state
  const [settleOrder, setSettleOrder]   = useState<Order | null>(null);
  const [settleAmount, setSettleAmountVal] = useState('');
  const [settleMethod, setSettleMethod] = useState('CASH');
  const [settleLoading, setSettleLoading] = useState(false);
  const [settleError, setSettleError]   = useState('');

  const [auditInterval, setAuditInterval] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');

  const searchRef = useRef<HTMLInputElement>(null);

  useRealtimeEvent('BILLING_UPDATE', () => {
    fetchBillingData();
  });

  const fetchBillingData = async () => {
    try {
      const res = await fetch('/api/retailer/billing');
      const data = await res.json();
      if (data.success) {
        setSales(data.sales);
        setPurchases(data.purchases);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // helper to check if date falls in selected FY range
  const isInSelectedFY = (dateStr: string) => {
    if (selectedFY === 'all') return true;
    const date = new Date(dateStr);
    
    // FY 2026-2027: Apr 1 2026 - Mar 31 2027
    if (selectedFY === '26-27') {
      const start = new Date('2026-04-01T00:00:00');
      const end = new Date('2027-03-31T23:59:59');
      return date >= start && date <= end;
    }
    if (selectedFY === '25-26') {
      const start = new Date('2025-04-01T00:00:00');
      const end = new Date('2026-03-31T23:59:59');
      return date >= start && date <= end;
    }
    if (selectedFY === '24-25') {
      const start = new Date('2024-04-01T00:00:00');
      const end = new Date('2025-03-31T23:59:59');
      return date >= start && date <= end;
    }
    return true;
  };

  const getBuyingPricePerUnit = (item: OrderItem) => {
    // Find in purchases first
    for (const p of purchases) {
      const matchedItem = p.items.find(pi => pi.product.sku === item.product.sku || pi.product.name === item.product.name);
      if (matchedItem) {
        return matchedItem.pricePerUnit;
      }
    }
    // Fallback: 75% of selling price
    return item.pricePerUnit * 0.75;
  };

  const auditedTransactions = (() => {
    const allTx: any[] = [];
    
    // 1. Process Sales (B2C)
    sales.forEach(sale => {
      if (!isInSelectedFY(sale.createdAt)) return;
      
      const d = getB2CDetails(sale.overrideJustification);
      
      // Calculate COGS
      let cogs = 0;
      sale.items.forEach(item => {
        cogs += item.quantity * getBuyingPricePerUnit(item);
      });
      
      const netVal = sale.netAmount;
      const profit = Math.max(netVal - cogs, 0);
      const loss = Math.max(cogs - netVal, 0);
      
      allTx.push({
        id: sale.id,
        date: new Date(sale.createdAt).toLocaleDateString(),
        time: new Date(sale.createdAt).toLocaleTimeString(),
        timestamp: new Date(sale.createdAt).getTime(),
        type: 'B2C Sale',
        entity: d.name,
        gross: sale.totalAmount,
        discount: sale.discountAmount,
        net: netVal,
        cogs: Math.round(cogs),
        profit: Math.round(profit),
        loss: Math.round(loss),
        status: d.due > 0 ? `Due: Rs. ${d.due}` : 'Paid',
        rawType: 'sale',
      });
    });

    // 2. Process Purchases (B2B)
    purchases.forEach(purchase => {
      if (!isInSelectedFY(purchase.createdAt)) return;
      
      // B2B Purchase is a capital outflow / expense
      // Profit is 0, loss/expense is netAmount
      allTx.push({
        id: purchase.id,
        date: new Date(purchase.createdAt).toLocaleDateString(),
        time: new Date(purchase.createdAt).toLocaleTimeString(),
        timestamp: new Date(purchase.createdAt).getTime(),
        type: 'B2B Purchase',
        entity: purchase.wholesaler?.companyName || 'Wholesaler',
        gross: purchase.totalAmount,
        discount: purchase.discountAmount,
        net: purchase.netAmount,
        cogs: purchase.netAmount, // Purchase cost is the COGS entry
        profit: 0,
        loss: purchase.netAmount,
        status: purchase.settleStatus || 'UNPAID',
        rawType: 'purchase',
      });
    });

    // Sort chronologically (newest first)
    return allTx.sort((a, b) => b.timestamp - a.timestamp);
  })();

  // Audit Metrics
  const auditMetrics = (() => {
    let salesRev = 0;
    let purchaseCost = 0;
    let totalCogs = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    
    auditedTransactions.forEach(t => {
      if (t.rawType === 'sale') {
        salesRev += t.net;
        totalCogs += t.cogs;
        totalProfit += t.profit;
      } else {
        purchaseCost += t.net;
        totalLoss += t.net; // purchase outflow
      }
    });

    const netIncome = salesRev - totalCogs; // operating profit
    
    return {
      salesRev,
      purchaseCost,
      totalCogs,
      totalProfit,
      totalLoss,
      netIncome,
    };
  })();

  const downloadCSVReport = () => {
    const headers = ['Date', 'Time', 'Invoice ID', 'Type', 'Entity', 'Gross Amount (Rs)', 'Discount (Rs)', 'Net Amount (Rs)', 'Estimated COGS (Rs)', 'Net Profit (Rs)', 'Status'];
    const rows = auditedTransactions.map(d => [
      d.date,
      d.time,
      d.id,
      d.type,
      d.entity,
      d.gross,
      d.discount,
      d.net,
      d.cogs,
      d.profit,
      d.status
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Fiscal_Year_Audit_Report_${selectedFY}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [hasParsedSearch, setHasParsedSearch] = useState(false);
  useEffect(() => {
    if (!hasParsedSearch && (sales.length > 0 || purchases.length > 0)) {
      setHasParsedSearch(true);
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const searchVal = params.get('search') || params.get('q');
        if (searchVal) {
          setSearchQuery(searchVal);
          const hasSale = sales.some(s => s.id.toLowerCase() === searchVal.toLowerCase() || s.id.toLowerCase().includes(searchVal.toLowerCase()));
          const hasPurchase = purchases.some(p => p.id.toLowerCase() === searchVal.toLowerCase() || p.id.toLowerCase().includes(searchVal.toLowerCase()));
          if (hasPurchase && !hasSale) {
            setActiveTab('purchases');
          } else if (hasSale && !hasPurchase) {
            setActiveTab('sales');
          }
          const matched = [...sales, ...purchases].find(o => o.id.toLowerCase() === searchVal.toLowerCase() || o.id.toLowerCase().includes(searchVal.toLowerCase()));
          if (matched) {
            setSelectedOrder(matched);
          }
        }
      }
    }
  }, [sales, purchases, hasParsedSearch]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setSelectedOrder(null); setSettleOrder(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const isWithinInterval = (dateStr: string) => {
    if (auditInterval === 'all') return true;
    const txDate = new Date(dateStr).getTime();
    const now = Date.now();
    const diffDays = (now - txDate) / (1000 * 60 * 60 * 24);
    if (auditInterval === 'day')   return diffDays <= 1;
    if (auditInterval === 'week')  return diffDays <= 7;
    if (auditInterval === 'month') return diffDays <= 30;
    if (auditInterval === 'year')  return diffDays <= 365;
    return true;
  };

  const currentSales     = sales.filter(s => isWithinInterval(s.createdAt));
  const currentPurchases = purchases.filter(p => isWithinInterval(p.createdAt));
  const list = activeTab === 'sales' ? currentSales : currentPurchases;

  const filtered = list.filter((item) => {
    const matchStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchSettle = filterSettle === 'all' || (item.settleStatus || 'UNPAID') === filterSettle;
    if (activeTab === 'sales') {
      const d = getB2CDetails(item.overrideJustification);
      return matchStatus && (
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return matchStatus && matchSettle && (
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.wholesaler?.companyName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Financial metrics
  const totalSalesRevenue  = currentSales.reduce((sum, s) => sum + s.netAmount, 0);
  const totalPurchaseCost  = currentPurchases.reduce((sum, p) => sum + p.netAmount, 0);
  const grossProfit        = totalSalesRevenue - totalPurchaseCost;
  const marginPercent      = totalSalesRevenue > 0 ? (grossProfit / totalSalesRevenue) * 100 : 0;
  const totalFilteredRev   = filtered.reduce((sum, i) => sum + i.netAmount, 0);

  // Outstanding / Advance from purchases
  const outstandingDue = currentPurchases
    .reduce((sum, p) => {
      const status = p.settleStatus || 'UNPAID';
      if (status === 'UNPAID' || status === 'REJECTED') {
        return sum + p.netAmount;
      } else if (status === 'PENDING_VERIFICATION' || status === 'VERIFIED') {
        return sum + Math.max(p.netAmount - (p.settleAmount || 0), 0);
      }
      return sum;
    }, 0);

  const pendingVerification = currentPurchases
    .filter(p => (p.settleStatus || 'UNPAID') === 'PENDING_VERIFICATION')
    .reduce((sum, p) => sum + (p.settleAmount || 0), 0);
  const totalVerified = currentPurchases
    .filter(p => (p.settleStatus || 'UNPAID') === 'VERIFIED')
    .reduce((sum, p) => sum + (p.settleAmount || 0), 0);

  const handleOpenSettle = (order: Order) => {
    setSettleOrder(order);
    const d = activeTab === 'sales' ? getB2CDetails(order.overrideJustification) : null;
    setSettleAmountVal(String(d ? d.due : order.netAmount));
    setSettleMethod(d ? d.method : 'CASH');
    setSettleError('');
  };

  const handleSubmitSettlement = async () => {
    if (!settleOrder) return;
    if (!settleAmount || isNaN(parseFloat(settleAmount))) {
      setSettleError('Please enter a valid amount');
      return;
    }
    setSettleLoading(true);
    setSettleError('');
    try {
      if (activeTab === 'purchases') {
        const res = await fetch('/api/retailer/billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: settleOrder.id,
            amount: parseFloat(settleAmount),
            method: settleMethod,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit settlement');

        // Update local state
        setPurchases(prev => prev.map(p =>
          p.id === settleOrder.id
            ? { ...p, settleStatus: 'PENDING_VERIFICATION', settleAmount: parseFloat(settleAmount), settleMethod }
            : p
        ));
      } else {
        // B2C Patient Due Settlement
        const res = await settleB2CDueAction(settleOrder.id, parseFloat(settleAmount));
        if (!res.success || !res.order) throw new Error('Failed to settle B2C due');

        // Update local state
        setSales(prev => prev.map(s =>
          s.id === settleOrder.id
            ? { ...s, overrideJustification: res.order.overrideJustification }
            : s
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
    const win = window.open('', '_blank', 'width=700,height=800');
    if (!win) return;
    const itemRows = order.items.map(item =>
      `<tr>
        <td>${item.product.name}</td>
        <td>${item.product.sku}</td>
        <td style="text-align:right">${item.quantity}</td>
        <td style="text-align:right">Rs. ${item.pricePerUnit.toLocaleString()}</td>
        <td style="text-align:right">Rs. ${(item.quantity * item.pricePerUnit).toLocaleString()}</td>
      </tr>`
    ).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice Voucher</title>
        <style>
          body { font-family:'Courier New', monospace; max-width:600px; margin:30px auto; color:#000; font-size:13px; }
          h1 { text-align:center; font-size:18px; margin:0; }
          p { text-align:center; margin:4px 0; font-size:11px; }
          table { width:100%; border-collapse:collapse; margin-top:12px; }
          th { border-bottom:2px solid #000; padding:6px 8px; text-align:left; font-size:11px; }
          td { padding:6px 8px; border-bottom:1px solid #ddd; font-size:12px; }
          .total { font-weight:bold; font-size:14px; text-align:right; margin-top:10px; }
          .meta { border-top:1px dashed #000; border-bottom:1px dashed #000; padding:8px 0; margin:10px 0; font-size:12px; }
        </style>
      </head>
      <body>
        <h1>MEDHUB PHARMACY NODE</h1>
        <p>${isSale ? 'RETAIL INVOICE STATEMENT' : 'WHOLESALE PURCHASE BILL'}</p>
        <div class="meta">
          <div><strong>Ref #:</strong> ${order.id.toUpperCase()}</div>
          <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</div>
          ${isSale ? `<div><strong>Patient:</strong> ${d?.name} | Phone: ${d?.phone}</div><div><strong>Payment:</strong> ${d?.method}</div>` : `<div><strong>Supplier:</strong> ${order.wholesaler?.companyName || '—'}</div>`}
          <div><strong>Status:</strong> ${order.status}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>SKU</th>
              <th style="text-align:right">Qty</th>
              <th style="text-align:right">Price/Unit</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
        <div class="total">Gross Total: Rs. ${order.totalAmount.toLocaleString()}</div>
        ${order.discountAmount > 0 ? `<div class="total" style="color:red">Discount: -Rs. ${order.discountAmount.toLocaleString()}</div>` : ''}
        <div class="total" style="font-size:16px; border-top:2px solid #000; padding-top:6px;">NET VALUE: Rs. ${order.netAmount.toLocaleString()}</div>
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '24px 0', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Modern Page Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)',
        border: '1.5px solid #F1F5F9', borderRadius: 20, padding: '20px 24px',
        boxShadow: '0 4px 20px -2px rgba(148,163,184,0.06)'
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.02em' }}>
            <Receipt style={{ width: 22, height: 22, color: '#F59E0B' }} />
            Accounting & Fiscal Ledger
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            B2C POS counter sales ledger, margins overview, and B2B spend analysis.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: '#F8FAFC', padding: 4, borderRadius: 12, border: '1px solid #E2E8F0' }}>
          {([
            { id: 'day', label: 'Today' },
            { id: 'week', label: 'Weekly' },
            { id: 'month', label: 'Monthly' },
            { id: 'year', label: 'Annual' },
            { id: 'all', label: 'All Time' },
          ] as const).map((interval) => (
            <button
              key={interval.id}
              onClick={() => setAuditInterval(interval.id)}
              style={{
                padding: '8px 14px', borderRadius: 9, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                background: auditInterval === interval.id ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'transparent',
                color: auditInterval === interval.id ? '#FFFFFF' : '#64748B',
                boxShadow: auditInterval === interval.id ? '0 4px 10px rgba(245,158,11,0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {interval.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Beautiful Fiscal Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {[
          { label: 'Gross B2C Revenue', val: totalSalesRevenue, color: '#10B981', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.02), rgba(16,185,129,0.06))', border: 'rgba(16,185,129,0.15)', icon: TrendingUp },
          { label: 'B2B Procurement Spend', val: totalPurchaseCost, color: '#F97316', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.02), rgba(249,115,22,0.06))', border: 'rgba(249,115,22,0.15)', icon: TrendingDown },
          { label: 'Net Profit Margin', val: grossProfit, color: grossProfit >= 0 ? '#3B82F6' : '#EF4444', gradient: grossProfit >= 0 ? 'linear-gradient(135deg, rgba(59,130,246,0.02), rgba(59,130,246,0.06))' : 'linear-gradient(135deg, rgba(239,68,68,0.02), rgba(239,68,68,0.06))', border: grossProfit >= 0 ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)', icon: BarChart2 },
          { label: 'Gross Margin %', val: `${marginPercent.toFixed(1)}%`, color: '#8B5CF6', gradient: 'linear-gradient(135deg, rgba(139,92,246,0.02), rgba(139,92,246,0.06))', border: 'rgba(139,92,246,0.15)', icon: ArrowUpRight, raw: true },
        ].map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              style={{
                background: '#FFFFFF', border: `1.5px solid ${card.border}`, padding: '22px 24px', borderRadius: 18,
                display: 'flex', alignItems: 'center', gap: 16, position: 'relative',
                overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.02)';
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: card.color }} />
              <div style={{ width: 44, height: 44, borderRadius: 14, background: card.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${card.border}` }}>
                <Icon style={{ width: 20, height: 20, color: card.color }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                <div style={{ fontSize: 20, fontWeight: 950, color: '#1E293B', marginTop: 4 }}>
                  {(card as any).raw ? card.val : `Rs. ${(card.val as number).toLocaleString()}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── B2B Payment Summary Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {[
          { label: 'Outstanding Due', val: outstandingDue, subtitle: 'Unpaid B2B purchases', color: '#EF4444', icon: AlertTriangle, bg: 'rgba(239,68,68,0.03)', border: 'rgba(239,68,68,0.12)' },
          { label: 'Pending Verification', val: pendingVerification, subtitle: 'Awaiting wholesaler approval', color: '#F59E0B', icon: Clock, bg: 'rgba(245,158,11,0.03)', border: 'rgba(245,158,11,0.12)' },
          { label: 'Total Verified Payments', val: totalVerified, subtitle: 'Confirmed by wholesaler', color: '#10B981', icon: ShieldCheck, bg: 'rgba(16,185,129,0.03)', border: 'rgba(16,185,129,0.12)' }
        ].map((pCard, idx) => {
          const PIcon = pCard.icon;
          return (
            <div key={idx} style={{
              background: pCard.bg, border: `1.5px solid ${pCard.border}`, borderRadius: 16, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.01)'
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FFFFFF', border: `1px solid ${pCard.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PIcon style={{ width: 18, height: 18, color: pCard.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{pCard.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace', marginTop: 2 }}>
                  Rs. {pCard.val.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{pCard.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modern Navigation Tabs ── */}
      <div style={{ display: 'flex', gap: 6, background: '#F8FAFC', borderRadius: 16, padding: 6, border: '1px solid #E2E8F0' }}>
        <button
          onClick={() => { setActiveTab('sales'); setFilterStatus('all'); setFilterSettle('all'); setSearchQuery(''); }}
          style={{
            flex: 1, padding: '12px 20px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            background: activeTab === 'sales' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'sales' ? '#F59E0B' : '#64748B',
            boxShadow: activeTab === 'sales' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          B2C Sales Counter Statement ({currentSales.length})
        </button>
        <button
          onClick={() => { setActiveTab('purchases'); setFilterStatus('all'); setFilterSettle('all'); setSearchQuery(''); }}
          style={{
            flex: 1, padding: '12px 20px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            background: activeTab === 'purchases' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'purchases' ? '#F59E0B' : '#64748B',
            boxShadow: activeTab === 'purchases' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          B2B Wholesale Purchases ({currentPurchases.length})
        </button>
        <button
          onClick={() => { setActiveTab('audit'); }}
          style={{
            flex: 1, padding: '12px 20px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            background: activeTab === 'audit' ? '#FFFFFF' : 'transparent',
            color: activeTab === 'audit' ? '#F59E0B' : '#64748B',
            boxShadow: activeTab === 'audit' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          💼 Fiscal Year Audit Report
        </button>
      </div>

      {activeTab !== 'audit' ? (
        <>
          {/* ── Modern Search & Filter Controls ── */}
          <div style={{
            display: 'flex', gap: 16, padding: '16px 20px', background: '#FFFFFF', borderRadius: 18,
            border: '1.5px solid #F1F5F9', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.01)'
          }}>
            <div style={{ flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', padding: '10px 16px', borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <Search style={{ width: 16, height: 16, color: '#94A3B8' }} />
              <input
                ref={searchRef}
                type="text"
                placeholder={activeTab === 'sales' ? 'Search patient name, phone, or invoice UUID…' : 'Search wholesaler, address, or bill UUID…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: '#334155', fontFamily: 'inherit' }}
              />
            </div>

            {/* Order status filters */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'DELIVERED', 'PENDING', 'DISPATCHED', 'PICKING'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: '8px 16px', borderRadius: 20, fontSize: 11, fontWeight: 800, cursor: 'pointer', border: '1.5px solid',
                    transition: 'all 0.15s ease', fontFamily: 'inherit',
                    borderColor: filterStatus === s ? '#F59E0B' : '#E2E8F0',
                    background: filterStatus === s ? '#FEF3C7' : '#FFFFFF',
                    color: filterStatus === s ? '#B45309' : '#64748B'
                  }}
                >
                  {s === 'all' ? 'All Statuses' : s}
                </button>
              ))}
            </div>

            {/* Settle status filters */}
            {activeTab === 'purchases' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', 'UNPAID', 'PENDING_VERIFICATION', 'VERIFIED'].map(s => {
                  const m = s === 'all' ? null : SETTLE_META[s];
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterSettle(s)}
                      style={{
                        padding: '8px 16px', borderRadius: 20, fontSize: 11, fontWeight: 800, cursor: 'pointer', border: '1.5px solid',
                        transition: 'all 0.15s ease', fontFamily: 'inherit',
                        borderColor: filterSettle === s ? (m?.color || '#3B82F6') : '#E2E8F0',
                        background: filterSettle === s ? (m?.bg || 'rgba(59,130,246,0.1)') : '#FFFFFF',
                        color: filterSettle === s ? (m?.color || '#3B82F6') : '#64748B'
                      }}
                    >
                      {s === 'all' ? 'All Settlements' : m?.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', marginLeft: 'auto', background: '#F8FAFC', padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              {filtered.length} Invoices · <span style={{ color: '#1E293B' }}>Rs. {totalFilteredRev.toLocaleString()}</span>
            </div>
          </div>

          {/* ── Modern Premium Table ── */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 40px', color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #F1F5F9' }}>
                  <Receipt style={{ width: 28, height: 28, color: '#CBD5E1' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#475569' }}>No fiscal statements matching criteria</div>
                  <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Try clearing queries or filtering another interval.</div>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                      <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invoice UUID</th>
                      <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{activeTab === 'sales' ? 'Recipient Patient' : 'Wholesaler Pharmacy'}</th>
                      <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Items In Cart</th>
                      <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Bill Value</th>
                      <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order Status</th>
                      <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accounting Status</th>
                      <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timestamp</th>
                      <th style={{ padding: '16px 24px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const d = activeTab === 'sales' ? getB2CDetails(item.overrideJustification) : null;
                      const sm = STATUS_META[item.status] || { color: '#64748B', bg: 'rgba(100,116,139,0.08)' };
                      const settleKey = item.settleStatus || 'UNPAID';
                      const pm = SETTLE_META[settleKey] || SETTLE_META.UNPAID;
                      const PayIcon = pm.icon;
                      const canSettle = activeTab === 'purchases'
                        ? (item.status === 'DELIVERED' && (settleKey === 'UNPAID' || settleKey === 'REJECTED'))
                        : (d && d.due > 0);

                      // Highlight logic if search parameter exactly matches
                      const isExactlyMatched = searchQuery && item.id.toLowerCase() === searchQuery.toLowerCase();

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedOrder(item)}
                          style={{
                            borderBottom: '1px solid #F8FAFC', cursor: 'pointer', transition: 'all 0.15s ease',
                            background: isExactlyMatched ? 'rgba(254,243,199,0.4)' : 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = isExactlyMatched ? 'rgba(254,243,199,0.5)' : '#F8FAFC';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isExactlyMatched ? 'rgba(254,243,199,0.4)' : 'transparent';
                          }}
                        >
                          <td style={{ padding: '16px 24px', fontFamily: 'monospace', fontWeight: 700, color: '#475569', fontSize: 12 }}>
                            #{item.id.substring(0, 8).toUpperCase()}
                            {isExactlyMatched && <span style={{ marginLeft: 6, background: '#F59E0B', color: '#FFFFFF', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>TARGET</span>}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontWeight: 800, color: '#1E293B' }}>{d ? d.name : item.wholesaler?.companyName || '—'}</div>
                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{d ? `📞 ${d.phone}` : item.wholesaler?.address || ''}</div>
                          </td>
                          <td style={{ padding: '16px 24px', color: '#475569', fontWeight: 600 }}>{item.items.length} medicine{item.items.length !== 1 ? 's' : ''}</td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontWeight: 900, color: '#1E293B' }}>Rs. {item.netAmount.toLocaleString()}</div>
                            {item.discountAmount > 0 && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 1 }}>-Rs. {item.discountAmount.toLocaleString()}</div>}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 750, color: sm.color, background: sm.bg }}>
                              {item.status}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            {activeTab === 'purchases' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: pm.color, background: pm.bg, width: 'fit-content' }}>
                                  <PayIcon style={{ width: 12, height: 12 }} />
                                  {pm.label}
                                </span>
                                {settleKey === 'PENDING_VERIFICATION' && item.settleAmount && (
                                  <div style={{ fontSize: 10, color: '#94A3B8' }}>Rs. {item.settleAmount.toLocaleString()} via {item.settleMethod}</div>
                                )}
                                {settleKey === 'VERIFIED' && item.settleAmount && (
                                  <div style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>✓ Rs. {item.settleAmount.toLocaleString()} verified</div>
                                )}
                                {settleKey === 'REJECTED' && (
                                  <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700 }}>⚠ Settlement rejected</div>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {d && d.due > 0 ? (
                                  <>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: '#DC2626', background: 'rgba(220,38,38,0.08)', width: 'fit-content' }}>
                                      <AlertTriangle style={{ width: 12, height: 12 }} />
                                      Due: Rs. {d.due.toLocaleString()}
                                    </span>
                                    <div style={{ fontSize: 10, color: '#94A3B8' }}>Paid: Rs. {d.paid.toLocaleString()} ({d.method})</div>
                                  </>
                                ) : (
                                  <>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: '#059669', background: 'rgba(5,150,105,0.08)', width: 'fit-content' }}>
                                      <CheckCircle style={{ width: 12, height: 12 }} />
                                      Fully Paid
                                    </span>
                                    {d && <div style={{ fontSize: 10, color: '#94A3B8' }}>Paid: Rs. {d.paid.toLocaleString()} ({d.method})</div>}
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px', color: '#64748B', fontSize: 12 }}>
                            {new Date(item.createdAt).toLocaleDateString()}
                            <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2 }}>{new Date(item.createdAt).toLocaleTimeString()}</div>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                              <button
                                onClick={() => setSelectedOrder(item)}
                                title="Inspect Details"
                                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px', color: '#475569', cursor: 'pointer', display: 'flex', transition: 'all 0.15s ease' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#E2E8F0'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                              >
                                <Eye style={{ width: 14, height: 14 }} />
                              </button>
                              <button
                                onClick={() => printInvoice(item, activeTab === 'sales')}
                                title="Print invoice receipt"
                                style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px', color: '#F59E0B', cursor: 'pointer', display: 'flex', transition: 'all 0.15s ease' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF3C7'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.05)'; }}
                              >
                                <Printer style={{ width: 14, height: 14 }} />
                              </button>
                              {canSettle && (
                                <button
                                  onClick={() => handleOpenSettle(item)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                                    background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none',
                                    borderRadius: 8, color: 'white', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                                    boxShadow: '0 4px 10px rgba(245,158,11,0.15)', transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                                >
                                  <DollarSign style={{ width: 12, height: 12 }} /> Settle
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
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Audit Period Selector Panel */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
            background: '#FFFFFF', border: '1.5px solid #F1F5F9', borderRadius: 20, padding: '20px 24px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.01)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: '#475569' }}>Select Fiscal Period:</label>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value as any)}
                style={{
                  padding: '10px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none',
                  fontSize: 13, fontWeight: 700, color: '#1E293B', background: '#FFFFFF', cursor: 'pointer'
                }}
              >
                <option value="26-27">FY 2026 - 2027 (Apr 2026 - Mar 2027)</option>
                <option value="25-26">FY 2025 - 2026 (Apr 2025 - Mar 2026)</option>
                <option value="24-25">FY 2024 - 2025 (Apr 2024 - Mar 2025)</option>
                <option value="all">All Time Audited Ledger</option>
              </select>
            </div>
            
            <button
              onClick={downloadCSVReport}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px',
                background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none',
                borderRadius: 12, color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16,185,129,0.25)', transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
            >
              📥 Export Excel Report (CSV)
            </button>
          </div>

          {/* Audit Performance Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {[
              { label: 'Audited B2C Sales', val: auditMetrics.salesRev, color: '#10B981', bg: 'rgba(16,185,129,0.03)', border: 'rgba(16,185,129,0.12)' },
              { label: 'Audited Procurement Spend', val: auditMetrics.purchaseCost, color: '#F97316', bg: 'rgba(249,115,22,0.03)', border: 'rgba(249,115,22,0.12)' },
              { label: 'Estimated COGS (Cost of Goods)', val: auditMetrics.totalCogs, color: '#8B5CF6', bg: 'rgba(139,92,246,0.03)', border: 'rgba(139,92,246,0.12)' },
              { label: 'Estimated Operating Net Income', val: auditMetrics.netIncome, color: auditMetrics.netIncome >= 0 ? '#3B82F6' : '#EF4444', bg: auditMetrics.netIncome >= 0 ? 'rgba(59,130,246,0.03)' : 'rgba(239,68,68,0.03)', border: auditMetrics.netIncome >= 0 ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)' },
            ].map((card, idx) => (
              <div key={idx} style={{
                background: card.bg, border: `1.5px solid ${card.border}`, borderRadius: 18, padding: '20px 24px',
                display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
              }}>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</span>
                <span style={{ fontSize: 22, fontWeight: 950, color: card.color, fontFamily: 'monospace' }}>
                  Rs. {card.val.toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>Estimated for selected period</span>
              </div>
            ))}
          </div>

          {/* Audit Detailed Ledger Table */}
          <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B', margin: 0 }}>Detailed Financial Transaction Registry</h3>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>{auditedTransactions.length} Transactions Audited</span>
            </div>
            {auditedTransactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
                No audited transactions found for selected fiscal period.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                      <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Date & Time</th>
                      <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Invoice ID</th>
                      <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Type</th>
                      <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Entity</th>
                      <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Net Amount</th>
                      <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>COGS Cost</th>
                      <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Net Profit</th>
                      <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Net Loss / Outflow</th>
                      <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditedTransactions.map((tx, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F8FAFC', transition: 'background 0.15s ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                        <td style={{ padding: '14px 20px', color: '#475569' }}>
                          <div style={{ fontWeight: 700 }}>{tx.date}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{tx.time}</div>
                        </td>
                        <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontWeight: 700, color: '#64748B' }}>
                          #{tx.id.substring(0, 8).toUpperCase()}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
                            color: tx.rawType === 'sale' ? '#10B981' : '#F97316',
                            background: tx.rawType === 'sale' ? 'rgba(16,185,129,0.08)' : 'rgba(249,115,22,0.08)'
                          }}>
                            {tx.type}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', fontWeight: 750, color: '#1E293B' }}>{tx.entity}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: '#1E293B', fontFamily: 'monospace' }}>Rs. {tx.net.toLocaleString()}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: '#64748B', fontFamily: 'monospace' }}>Rs. {tx.cogs.toLocaleString()}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: tx.profit > 0 ? '#10B981' : '#CBD5E1', fontFamily: 'monospace' }}>
                          {tx.profit > 0 ? `+Rs. ${tx.profit.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 800, color: tx.loss > 0 ? '#EF4444' : '#CBD5E1', fontFamily: 'monospace' }}>
                          {tx.loss > 0 ? `-Rs. ${tx.loss.toLocaleString()}` : '—'}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 750, color: tx.status.includes('Paid') || tx.status === 'VERIFIED' ? '#059669' : '#DC2626',
                            background: tx.status.includes('Paid') || tx.status === 'VERIFIED' ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
                            padding: '3px 8px', borderRadius: 6
                          }}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Invoice Detail Modal ── */}
      {selectedOrder && (() => {
        const isSale = activeTab === 'sales';
        const d = isSale ? getB2CDetails(selectedOrder.overrideJustification) : null;
        const sm = STATUS_META[selectedOrder.status] || { color: '#64748B', bg: 'rgba(100,116,139,0.08)' };
        const settleKey = selectedOrder.settleStatus || 'UNPAID';
        const pm = SETTLE_META[settleKey] || SETTLE_META.UNPAID;
        const PayIcon = pm.icon;
        const canSettle = !isSale
          ? (selectedOrder.status === 'DELIVERED' && settleKey === 'UNPAID')
          : (d && d.due > 0);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 580, background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

              {/* Modal Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt style={{ width: 20, height: 20, color: '#F59E0B' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0 }}>
                      {isSale ? 'B2C Sales Statement' : 'B2B Purchase Bill'}
                    </h3>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, fontFamily: 'monospace' }}>#{selectedOrder.id.toUpperCase()}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg }}>{selectedOrder.status}</span>
                  {!isSale ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: pm.color, background: pm.bg }}>
                      <PayIcon style={{ width: 10, height: 10 }} /> {pm.label}
                    </span>
                  ) : (
                    d && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: d.due > 0 ? '#DC2626' : '#059669', background: d.due > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(5,150,105,0.08)' }}>
                        {d.due > 0 ? <AlertTriangle style={{ width: 10, height: 10 }} /> : <CheckCircle style={{ width: 10, height: 10 }} />}
                        {d.due > 0 ? `Due: Rs. ${d.due}` : 'Fully Paid'}
                      </span>
                    )
                  )}
                  <button onClick={() => setSelectedOrder(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Meta info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { icon: Calendar, label: 'Timestamp', val: new Date(selectedOrder.createdAt).toLocaleString() },
                    { icon: Hash, label: 'Status Code', val: selectedOrder.status },
                    isSale
                      ? { icon: User, label: 'Patient Name', val: d?.name || 'Walk-in Customer' }
                      : { icon: Building, label: 'Wholesaler', val: selectedOrder.wholesaler?.companyName || '—' },
                    isSale
                      ? { icon: Phone, label: 'Phone', val: d?.phone || 'N/A' }
                      : { icon: Phone, label: 'Contact', val: selectedOrder.wholesaler?.phone || '—' },
                  ].map((row, index) => {
                    if (!row) return null;
                    const RowIcon = row.icon;
                    return (
                      <div key={index} style={{ background: '#F8FAFC', borderRadius: 10, padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                          <RowIcon style={{ width: 11, height: 11, color: '#94A3B8' }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{row.label}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{row.val}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Settlement details */}
                {!isSale ? (
                  <div style={{ background: settleKey === 'VERIFIED' ? 'rgba(5,150,105,0.05)' : settleKey === 'PENDING_VERIFICATION' ? 'rgba(217,119,6,0.05)' : 'rgba(220,38,38,0.05)', border: `1px solid ${pm.color}30`, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: pm.color, textTransform: 'uppercase', marginBottom: 8 }}>Payment Settlement Status</div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>Status</div>
                        <div style={{ fontWeight: 800, color: pm.color, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <PayIcon style={{ width: 13, height: 13 }} /> {pm.label}
                        </div>
                      </div>
                      {selectedOrder.settleAmount ? (
                        <div>
                           <div style={{ fontSize: 10, color: '#94A3B8' }}>Amount Settled</div>
                          <div style={{ fontWeight: 800, color: '#1E293B', marginTop: 2 }}>Rs. {selectedOrder.settleAmount.toLocaleString()}</div>
                        </div>
                      ) : null}
                      {selectedOrder.settleMethod && settleKey !== 'UNPAID' ? (
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>Method</div>
                          <div style={{ fontWeight: 700, color: '#475569', marginTop: 2 }}>{selectedOrder.settleMethod}</div>
                        </div>
                      ) : null}
                      <div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>Outstanding</div>
                        <div style={{ fontWeight: 900, color: '#DC2626', marginTop: 2 }}>
                          Rs. {(selectedOrder.netAmount - (selectedOrder.settleAmount || 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  d && (
                    <div style={{ background: d.due === 0 ? 'rgba(5,150,105,0.05)' : 'rgba(220,38,38,0.05)', border: `1px solid ${d.due === 0 ? '#059669' : '#DC2626'}30`, borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: d.due === 0 ? '#059669' : '#DC2626', textTransform: 'uppercase', marginBottom: 8 }}>B2C Payment Details</div>
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>Status</div>
                          <div style={{ fontWeight: 800, color: d.due === 0 ? '#059669' : '#DC2626', marginTop: 2 }}>
                            {d.due === 0 ? 'Fully Paid' : 'Pending Due'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>Amount Paid</div>
                          <div style={{ fontWeight: 800, color: '#1E293B', marginTop: 2 }}>Rs. {d.paid.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>Method</div>
                          <div style={{ fontWeight: 700, color: '#475569', marginTop: 2 }}>{d.method}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>Outstanding Due</div>
                          <div style={{ fontWeight: 900, color: '#DC2626', marginTop: 2 }}>Rs. {d.due.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* Line items */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 }}>Medicines</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1E293B', fontSize: 13 }}>{item.product.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{item.product.sku}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: '#1E293B' }}>Rs. {(item.quantity * item.pricePerUnit).toLocaleString()}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.quantity} × Rs. {item.pricePerUnit.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748B' }}>
                    <span>Gross subtotal:</span><span>Rs. {selectedOrder.totalAmount.toLocaleString()}</span>
                  </div>
                  {selectedOrder.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#EF4444' }}>
                      <span>Discount:</span><span>-Rs. {selectedOrder.discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: '#1E293B', borderTop: '1px solid #E2E8F0', paddingTop: 8, marginTop: 4 }}>
                    <span>Net Bill Value:</span>
                    <span style={{ color: '#F59E0B' }}>Rs. {selectedOrder.netAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, flexShrink: 0 }}>
                <button onClick={() => setSelectedOrder(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                  Close
                </button>
                {canSettle && (
                  <button
                    onClick={() => { setSelectedOrder(null); handleOpenSettle(selectedOrder); }}
                    style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <DollarSign style={{ width: 15, height: 15 }} /> Settle Payment
                  </button>
                )}
                <button
                  onClick={() => printInvoice(selectedOrder, isSale)}
                  style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Printer style={{ width: 15, height: 15 }} />
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Settle Payment Modal ── */}
      {settleOrder && (() => {
        const isB2C = activeTab === 'sales';
        const b2cDetails = isB2C ? getB2CDetails(settleOrder.overrideJustification) : null;
        const maxSettleVal = b2cDetails ? b2cDetails.due : settleOrder.netAmount;
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 460, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.18)' }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(124,58,237,0.05), rgba(139,92,246,0.03))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign style={{ width: 20, height: 20, color: '#FFFFFF' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', margin: 0 }}>
                      {isB2C ? 'Settle Patient Due' : 'Settle B2B Payment'}
                    </h3>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, fontFamily: 'monospace' }}>
                      #{settleOrder.id.substring(0, 8).toUpperCase()} · {isB2C ? b2cDetails?.name : settleOrder.wholesaler?.companyName}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSettleOrder(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Bill summary */}
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>
                      {isB2C ? 'Total Outstanding Due' : 'Total Bill Amount'}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace', marginTop: 2 }}>
                      Rs. {maxSettleVal.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>Items</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#475569', marginTop: 2 }}>{settleOrder.items.length} medicines</div>
                  </div>
                </div>

                {/* Amount input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Settlement Amount (Rs.)</label>
                  <input
                    type="number"
                    value={settleAmount}
                    onChange={(e) => setSettleAmountVal(e.target.value)}
                    min={1}
                    max={maxSettleVal}
                    style={{ padding: '12px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 16, fontWeight: 800, outline: 'none', fontFamily: 'monospace' }}
                  />
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>Enter the amount paid. Partial payments are allowed.</div>
                </div>

                {/* Payment method */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Payment Method</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {PAYMENT_METHODS.map(m => {
                      const MIcon = m.icon;
                      const selected = settleMethod === m.id;
                      const isEnabled = isB2C ? true : m.enabled;
                      return (
                        <button
                          key={m.id}
                          disabled={!isEnabled}
                          onClick={() => isEnabled && setSettleMethod(m.id)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px',
                            borderRadius: 10, border: '1.5px solid',
                            borderColor: selected ? '#7C3AED' : isEnabled ? '#E2E8F0' : '#F1F5F9',
                            background: selected ? 'rgba(124,58,237,0.08)' : isEnabled ? '#F8FAFC' : '#F8FAFC',
                            color: selected ? '#7C3AED' : isEnabled ? '#475569' : '#CBD5E1',
                            cursor: isEnabled ? 'pointer' : 'not-allowed',
                            fontSize: 11, fontWeight: 800, fontFamily: 'inherit', opacity: isEnabled ? 1 : 0.5,
                            transition: 'all 0.15s',
                          }}
                        >
                          <MIcon style={{ width: 16, height: 16 }} />
                          {m.label}
                          {!isEnabled && <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>N/A</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>
                    {isB2C
                      ? '💡 Patient payment method for this settlement.'
                      : '💡 Only Cash and COD are available for B2B settlements. Other methods require wholesaler setup.'}
                  </div>
                </div>

                {settleError && (
                  <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                    {settleError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10 }}>
                <button onClick={() => setSettleOrder(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                  Cancel
                </button>
                <button
                  onClick={handleSubmitSettlement}
                  disabled={settleLoading}
                  style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: settleLoading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #7C3AED, #8B5CF6)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: settleLoading ? 0.7 : 1 }}
                >
                  <ShieldCheck style={{ width: 16, height: 16 }} />
                  {settleLoading ? 'Submitting…' : isB2C ? `Confirm Rs. ${parseFloat(settleAmount || '0').toLocaleString()} Settlement` : `Submit Rs. ${parseFloat(settleAmount || '0').toLocaleString()} for Verification`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
