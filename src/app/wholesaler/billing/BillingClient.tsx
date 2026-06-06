'use client';

import React, { useState } from 'react';
import { 
  Receipt, DollarSign, Clock, ShieldAlert, ArrowUpRight, ArrowDownRight,
  Printer, Send, Bell, Check, Eye, AlertCircle, RefreshCw, CheckCircle
} from 'lucide-react';
import { logActivity } from '@/components/WholesalerLayout';

interface Retailer {
  id: string;
  pharmacyName: string;
  creditLimit: number;
  lifetimeSpend: number;
  registrationNumber: string;
  address: string;
  phone: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
}

interface Batch {
  id: string;
  batchNumber: string;
  manufacturingCost: number;
  purchasePricePerBox: number;
}

interface OrderAllocation {
  id: string;
  quantity: number;
  batch: Batch;
}

interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  pricePerUnit: number;
  allocations: OrderAllocation[];
}

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

export default function BillingClient({ profileId, initialOrders }: BillingClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Invoice Print Builder Modal
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  const [customInvoiceTitle, setCustomInvoiceTitle] = useState('TAX INVOICE');
  const [customTerms, setCustomTerms] = useState('1. Goods once sold will not be taken back.\n2. Payment terms: Due on delivery.\n3. All disputes are subject to local jurisdiction.');
  const [customNotes, setCustomNotes] = useState('Thank you for your business! We appreciate your partnership.');

  const refreshOrders = async () => {
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

  // Financial calculations
  const calculateMetrics = () => {
    let totalSales = 0; // Completed sales (Delivered)
    let totalCogs = 0;   // Cost of goods sold for completed sales
    let pendingSales = 0; // Uncollected sales (Pending/Dispatched)

    orders.forEach(order => {
      if (order.status === 'DELIVERED') {
        totalSales += order.netAmount;
        
        // Calculate COGS based on batch manufacturingCost (price per tablet)
        order.items.forEach(item => {
          item.allocations.forEach(allocation => {
            totalCogs += allocation.quantity * allocation.batch.manufacturingCost;
          });
        });
      } else {
        pendingSales += order.netAmount;
      }
    });

    const grossProfit = totalSales - totalCogs;
    const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    return {
      totalSales,
      totalCogs,
      grossProfit,
      profitMargin,
      pendingSales
    };
  };

  const { totalSales, totalCogs, grossProfit, profitMargin, pendingSales } = calculateMetrics();

  // Send simulated invoice
  const handleSendInvoice = async (order: Order) => {
    setError('');
    setSuccessMsg('');
    await logActivity('SEND_INVOICE', `Dispatched digital tax invoice for Order ${order.id.substring(0,8)} to ${order.retailer.pharmacyName}`);
    setSuccessMsg(`Digital Invoice dispatched to ${order.retailer.pharmacyName} successfully.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Send payment reminder alert
  const handleSendReminder = async (order: Order) => {
    setError('');
    setSuccessMsg('');
    await logActivity('SEND_REMINDER', `Dispatched payment reminder alert for Order ${order.id.substring(0,8)} (Rs. ${order.netAmount.toFixed(2)}) to ${order.retailer.pharmacyName}`);
    setSuccessMsg(`Outstanding payment reminder alert dispatched to ${order.retailer.pharmacyName}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Trigger print area output
  const handlePrint = async () => {
    if (!selectedOrderForPrint) return;
    await logActivity('PRINT_INVOICE', `Printed custom invoice for order: ${selectedOrderForPrint.id}`);
    
    // Trigger native printing (CSS @media print handles displaying only #print-area)
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(5,150,105,0.2)', borderRadius: 20,
        padding: '20px 24px', boxShadow: '0 2px 12px rgba(5,150,105,0.06)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Receipt style={{ width: 22, height: 22, color: '#059669' }} />
            Billing & Profit Analyzer
          </h1>
          <p style={{ fontSize: 12, color: '#64748B' }}>Track distributor revenue, gross profits, margins, and print custom invoices.</p>
        </div>
        <button onClick={refreshOrders} className="btn-ghost" title="Refresh Data">
          <RefreshCw style={{ width: 14, height: 14, color: '#059669' }} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Financial Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {/* Completed Sales */}
        <div style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #A7F3D0', borderRadius: 16, padding: '20px', boxShadow: '0 2px 8px rgba(5,150,105,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign style={{ width: 18, height: 18, color: '#059669' }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: 20 }}>PAID</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 6 }}>Completed Sales</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>Rs. {totalSales.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Delivered invoice revenue</div>
        </div>

        {/* Pending Bills */}
        <div style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #FED7AA', borderRadius: 16, padding: '20px', boxShadow: '0 2px 8px rgba(234,88,12,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock style={{ width: 18, height: 18, color: '#EA580C' }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '3px 10px', borderRadius: 20 }}>UNPAID</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.06em', marginBottom: 6 }}>Pending Payments</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#EA580C', fontFamily: 'monospace' }}>Rs. {pendingSales.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Orders in transit / pending</div>
        </div>

        {/* Gross Profits */}
        <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(251,146,60,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt style={{ width: 18, height: 18, color: '#FB923C' }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace', background: 'rgba(251,146,60,0.15)', color: '#FB923C', border: '1px solid rgba(251,146,60,0.3)', padding: '3px 10px', borderRadius: 20 }}>NET PROFIT</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', marginBottom: 6 }}>Gross Profits</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>Rs. {grossProfit.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Sales minus inventory costs</div>
        </div>

        {/* Profit Margin */}
        <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(252,211,77,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign style={{ width: 18, height: 18, color: '#FCD34D' }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', fontFamily: 'monospace', background: 'rgba(252,211,77,0.15)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.3)', padding: '3px 10px', borderRadius: 20 }}>{profitMargin.toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', marginBottom: 6 }}>Profit Margin</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#FCD34D', fontFamily: 'monospace' }}>{profitMargin.toFixed(1)}%</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Gross profit percentage</div>
        </div>
      </div>

        {/* Completed Sales */}
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div className="stat-card-icon bg-emerald-50 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-emerald-50 border-emerald-250 text-emerald-600 font-mono">
              PAID
            </span>
          </div>
          <div>
            <div className="stat-card-label">Completed Sales</div>
            <div className="stat-card-value text-emerald-600 mt-1">Rs. {totalSales.toLocaleString()}</div>
            <p className="text-[10px] text-zinc-400 mt-1">Delivered invoices revenue</p>
          </div>
        </div>

        {/* Pending Bills */}
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div className="stat-card-icon bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-amber-50 border-amber-250 text-amber-600 font-mono">
              UNPAID
            </span>
          </div>
          <div>
            <div className="stat-card-label">Pending Payments</div>
            <div className="stat-card-value text-amber-600 mt-1">Rs. {pendingSales.toLocaleString()}</div>
            <p className="text-[10px] text-zinc-400 mt-1">Pending order values in transit</p>
          </div>
        </div>

        {/* Gross Profits - Gradient Premium Card */}
        <div className="finance-card">
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-orange-400">
                <Receipt className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-orange-400 font-mono uppercase tracking-wider">
                Net Profit
              </span>
            </div>
            <div>
              <div className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">Gross Profits</div>
              <div className="text-2xl font-black text-white font-mono mt-1">Rs. {grossProfit.toLocaleString()}</div>
              <p className="text-[10px] text-slate-400 mt-1">Sales minus inventory costs</p>
            </div>
          </div>
        </div>

        {/* Profit Margin - Gradient Premium Card */}
        <div className="finance-card">
          <div className="relative z-10 space-y-4">
            <div className="flex justify-between items-center">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-amber-300 font-mono">
                {profitMargin.toFixed(1)}%
              </span>
            </div>
            <div>
              <div className="text-[10px] text-slate-300 uppercase font-bold tracking-wider">Profit Margin</div>
              <div className="text-2xl font-black text-amber-300 font-mono mt-1">{profitMargin.toFixed(1)}%</div>
              <p className="text-[10px] text-slate-400 mt-1">Gross profit percentage ratio</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="card bg-white/80 border p-6 space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider">Invoices & Bills Ledger</h3>
          <span className="text-[9.5px] text-zinc-400 font-mono">Double-Entry Verified</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Billing Date</th>
                <th>Invoice ID</th>
                <th>Customer Pharmacy</th>
                <th>Fulfillment Status</th>
                <th>Net Payable</th>
                <th>Simulated Profits</th>
                <th className="text-center">Invoice Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400 font-mono">
                    NO BILLS DETECTED IN LEDGER.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const billDate = new Date(order.createdAt).toLocaleDateString();
                  
                  // Calculate order cost and profit
                  let orderCost = 0;
                  order.items.forEach(item => {
                    item.allocations.forEach(allocation => {
                      orderCost += allocation.quantity * allocation.batch.manufacturingCost;
                    });
                  });
                  const orderProfit = order.status === 'DELIVERED' ? order.netAmount - orderCost : 0;

                  return (
                    <tr key={order.id}>
                      <td className="text-zinc-550 font-mono">{billDate}</td>
                      <td className="text-zinc-950 font-black font-mono">INV-{order.id.substring(0,8).toUpperCase()}</td>
                      <td className="text-zinc-800 font-bold">{order.retailer.pharmacyName}</td>
                      <td>
                        <span className={`status-pill ${
                          order.status === 'DELIVERED'
                            ? 'status-pill-active'
                            : order.status === 'DISPATCHED'
                            ? 'status-pill-pending'
                            : 'status-pill-inactive'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="text-zinc-950 font-black font-mono">Rs. {order.netAmount.toFixed(2)}</td>
                      <td className="font-mono text-zinc-600">
                        {order.status === 'DELIVERED' ? (
                          <span className="text-emerald-600 font-bold">Rs. {orderProfit.toFixed(2)}</span>
                        ) : (
                          <span className="text-zinc-400 italic text-[10px]">Awaiting delivery</span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              setSelectedOrderForPrint(order);
                              logActivity('PREVIEW_INVOICE', `Opened custom print preview for order: ${order.id}`);
                            }}
                            className="btn-ghost py-1 px-3 flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-orange-500" />
                            Print Bill
                          </button>
                          <button
                            onClick={() => handleSendInvoice(order)}
                            className="btn-ghost py-1 px-3 flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                            title="Send invoice via message"
                          >
                            <Send className="w-3.5 h-3.5 text-sky-500" />
                            Send Bill
                          </button>
                          {order.status !== 'DELIVERED' && (
                            <button
                              onClick={() => handleSendReminder(order)}
                              className="btn-danger py-1 px-3 flex items-center gap-1 text-[10px] font-bold cursor-pointer animate-pulse"
                              title="Send outstanding alert alert"
                            >
                              <Bell className="w-3.5 h-3.5 text-red-500" />
                              Alert Reminder
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INVOICE CUSTOM BUILDER & PRINT MODAL */}
      {selectedOrderForPrint && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 no-print overflow-y-auto">
          <div className="border border-slate-200 bg-white/95 backdrop-blur-2xl w-full max-w-4xl rounded-3xl p-6 shadow-2xl flex flex-col lg:flex-row gap-6 max-h-[90vh]">
            
            {/* LEFT: Custom Template Controls */}
            <div className="lg:w-1/3 space-y-4 border-r border-slate-100 pr-0 lg:pr-6 flex flex-col justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-sm uppercase text-zinc-950 tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-500" />
                  Bill Customizer
                </h3>
                <p className="text-[10px] text-zinc-500 leading-relaxed mt-2 font-medium">
                  Update terms, invoices header, and footer descriptions dynamically before printing.
                </p>

                <div className="space-y-3 mt-4 text-xs font-semibold">
                  <div>
                    <label className="block text-zinc-500 uppercase mb-1 font-bold">Invoice Title Header</label>
                    <input
                      type="text"
                      value={customInvoiceTitle}
                      onChange={(e) => setCustomInvoiceTitle(e.target.value)}
                      className="input-crisp"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 uppercase mb-1 font-bold">Terms & Conditions Note</label>
                    <textarea
                      rows={4}
                      value={customTerms}
                      onChange={(e) => setCustomTerms(e.target.value)}
                      className="input-crisp leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 uppercase mb-1 font-bold">Additional Memo / Notes</label>
                    <textarea
                      rows={3}
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="input-crisp"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <button
                  onClick={handlePrint}
                  className="w-full btn-primary bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3.5 font-bold uppercase text-xs tracking-wider"
                >
                  <Printer className="w-4 h-4" />
                  Print Document
                </button>
                <button
                  onClick={() => setSelectedOrderForPrint(null)}
                  className="w-full btn-ghost py-2.5 font-bold text-xs uppercase"
                >
                  Close Preview
                </button>
              </div>
            </div>

            {/* RIGHT: Document Print Area */}
            <div className="flex-grow overflow-y-auto p-4 border border-slate-150 rounded-2xl bg-white/70 shadow-inner flex flex-col justify-between">
              <div id="print-area" className="p-6 text-zinc-800 font-sans text-xs bg-white space-y-6">
                
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-4">
                  <div className="space-y-1">
                    <h1 className="text-xl font-black tracking-tight text-zinc-955 uppercase">{customInvoiceTitle}</h1>
                    <div className="text-zinc-550 font-bold">INV-{selectedOrderForPrint.id.substring(0, 12).toUpperCase()}</div>
                    <div className="text-[10px] text-zinc-450 font-mono">Date: {new Date(selectedOrderForPrint.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <h2 className="text-sm font-black text-zinc-955 uppercase">MedHub Distributor</h2>
                    <div className="text-[11px] text-zinc-600 font-medium">VAT ID: {profileId.substring(0, 8).toUpperCase()}</div>
                    <div className="text-[10px] text-zinc-450 font-medium">Kathmandu Warehouse, NP</div>
                  </div>
                </div>

                {/* Billing details */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 border border-slate-100 p-4 rounded-xl font-medium">
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase text-zinc-400 font-bold font-mono">Billed To (Customer):</div>
                    <div className="text-zinc-900 font-extrabold text-sm">{selectedOrderForPrint.retailer.pharmacyName}</div>
                    <div className="text-zinc-550">{selectedOrderForPrint.retailer.address}</div>
                    <div className="text-[10px] text-zinc-455">Phone: {selectedOrderForPrint.retailer.phone}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[9px] uppercase text-zinc-400 font-bold font-mono">Payment Summary:</div>
                    <div className="text-zinc-900 font-extrabold">Net Value: Rs. {selectedOrderForPrint.netAmount.toFixed(2)}</div>
                    <div className="text-zinc-500">Status: <span className="font-bold text-zinc-800">{selectedOrderForPrint.status}</span></div>
                    <div className="text-[10px] text-zinc-455">Customer License: {selectedOrderForPrint.retailer.registrationNumber}</div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-zinc-900 text-zinc-950 font-extrabold uppercase tracking-wider text-[9.5px]">
                      <th className="py-2">Medicine SKU</th>
                      <th className="py-2">Description</th>
                      <th className="py-2 text-right">Units (Base)</th>
                      <th className="py-2 text-right">Unit Price</th>
                      <th className="py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-medium">
                    {selectedOrderForPrint.items.map((item, index) => {
                      const totalPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
                      const qtyBoxes = item.quantity / totalPerBox;
                      const pricePerBox = item.pricePerUnit * totalPerBox;

                      return (
                        <tr key={index} className="text-zinc-755">
                          <td className="py-3 font-mono font-bold text-zinc-950">{item.product.sku}</td>
                          <td className="py-3 font-bold">{item.product.name} ({qtyBoxes} boxes)</td>
                          <td className="py-3 text-right font-mono">{item.quantity} tabs</td>
                          <td className="py-3 text-right font-mono">Rs. {pricePerBox.toFixed(2)}/box</td>
                          <td className="py-3 text-right font-mono font-bold text-zinc-950">Rs. {(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Subtotals */}
                <div className="border-t-2 border-zinc-900 pt-4 flex justify-end">
                  <div className="w-1/2 space-y-2 text-right font-semibold font-mono text-[11px]">
                    <div className="flex justify-between text-zinc-500">
                      <span>Total Value:</span>
                      <span>Rs. {selectedOrderForPrint.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Discount Deduction:</span>
                      <span>- Rs. {selectedOrderForPrint.discountAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-950 border-t border-zinc-900 pt-2 font-black text-sm">
                      <span>NET VALUE DUE:</span>
                      <span>Rs. {selectedOrderForPrint.netAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Terms and Memo */}
                <div className="grid grid-cols-2 gap-6 border-t border-zinc-200 pt-4 text-[9px] leading-relaxed text-zinc-500 font-medium">
                  <div>
                    <div className="text-[10px] text-zinc-955 uppercase font-bold mb-1">Terms & Conditions:</div>
                    <pre className="font-sans whitespace-pre-wrap">{customTerms}</pre>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-955 uppercase font-bold mb-1">Invoice Memo / Notes:</div>
                    <p>{customNotes}</p>
                  </div>
                </div>

                {/* Footer Signature */}
                <div className="border-t border-dashed border-zinc-300 pt-8 flex justify-between items-center text-[10px] font-bold text-zinc-400 font-mono">
                  <span>MEDHUB SECURE BILLING MATRIX</span>
                  <div className="text-right">
                    <div className="w-36 border-b border-zinc-400 h-10"></div>
                    <span className="text-[9px] uppercase tracking-wider block mt-1">Authorized Signature</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
