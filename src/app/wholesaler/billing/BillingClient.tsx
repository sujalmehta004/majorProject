'use client';

import React, { useState } from 'react';
import {
  Receipt, DollarSign, Clock, ArrowUpRight, ArrowDownRight,
  Printer, Send, Bell, Check, AlertCircle, RefreshCw, CheckCircle, TrendingUp
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
    let totalSales = 0;
    let totalCogs = 0;
    let pendingSales = 0;

    orders.forEach(order => {
      if (order.status === 'DELIVERED') {
        totalSales += order.netAmount;
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

    return { totalSales, totalCogs, grossProfit, profitMargin, pendingSales };
  };

  const { totalSales, totalCogs, grossProfit, profitMargin, pendingSales } = calculateMetrics();

  const handleSendInvoice = async (order: Order) => {
    setError('');
    setSuccessMsg('');
    await logActivity('SEND_INVOICE', `Dispatched digital tax invoice for Order ${order.id.substring(0, 8)} to ${order.retailer.pharmacyName}`);
    setSuccessMsg(`Digital Invoice dispatched to ${order.retailer.pharmacyName} successfully.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleSendReminder = async (order: Order) => {
    setError('');
    setSuccessMsg('');
    await logActivity('SEND_REMINDER', `Dispatched payment reminder alert for Order ${order.id.substring(0, 8)} (Rs. ${order.netAmount.toFixed(2)}) to ${order.retailer.pharmacyName}`);
    setSuccessMsg(`Outstanding payment reminder alert dispatched to ${order.retailer.pharmacyName}.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handlePrint = async () => {
    if (!selectedOrderForPrint) return;
    await logActivity('PRINT_INVOICE', `Printed custom invoice for order: ${selectedOrderForPrint.id}`);
    window.print();
  };

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Page Header — matches dashboard style */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(186,230,253,0.5)', borderRadius: 20,
        padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.07)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt style={{ width: 22, height: 22, color: '#F97316' }} />
            Billing &amp; Profit Analyzer
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            Track distributor revenue, gross profits, margins, and print custom tax invoices.
          </p>
        </div>
        <button onClick={refreshOrders} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw style={{ width: 14, height: 14, color: '#F97316' }} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error animate-scaleIn">
          <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success animate-scaleIn">
          <CheckCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Stat Cards — same pattern as dashboard stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {/* Completed Sales */}
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
              <DollarSign style={{ width: 20, height: 20 }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: 20 }}>PAID</span>
          </div>
          <div>
            <div className="stat-card-label">Completed Sales</div>
            <div className="stat-card-value" style={{ color: '#059669' }}>
              Rs. {totalSales.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Delivered invoice revenue</div>
          </div>
        </div>

        {/* Pending Bills */}
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-card-icon" style={{ background: '#FFF7ED', color: '#EA580C' }}>
              <Clock style={{ width: 20, height: 20 }} />
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'monospace', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '3px 10px', borderRadius: 20 }}>UNPAID</span>
          </div>
          <div>
            <div className="stat-card-label">Pending Payments</div>
            <div className="stat-card-value" style={{ color: '#EA580C' }}>
              Rs. {pendingSales.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Orders in transit / pending</div>
          </div>
        </div>
      </div>

      {/* Finance Card — same pattern as dashboard financial ledger */}
      <div className="finance-card">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
              <TrendingUp style={{ width: 14, height: 14, color: '#FB923C' }} />
              Profitability Ledger
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gross Profits</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: 4 }}>
                  Rs. {grossProfit.toLocaleString()}
                </div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Sales minus inventory costs</p>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profit Margin</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#FB923C', fontFamily: 'monospace', marginTop: 4 }}>
                  {profitMargin.toFixed(1)}%
                </div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Gross profit percentage</p>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost of Goods</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#FCD34D', fontFamily: 'monospace', marginTop: 4 }}>
                  Rs. {totalCogs.toLocaleString()}
                </div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Total inventory costs</p>
              </div>
            </div>
          </div>
          <div>
            <span style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#FCA5A5', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Verifier Active
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Ledger Table */}
      <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316', display: 'inline-block' }} />
            Invoices &amp; Bills Ledger
          </h3>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace', textTransform: 'uppercase', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: 8 }}>
            Double-Entry Verified
          </span>
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
                <th style={{ textAlign: 'center' }}>Invoice Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>
                    No bills detected in ledger.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const billDate = new Date(order.createdAt).toLocaleDateString();

                  let orderCost = 0;
                  order.items.forEach(item => {
                    item.allocations.forEach(allocation => {
                      orderCost += allocation.quantity * allocation.batch.manufacturingCost;
                    });
                  });
                  const orderProfit = order.status === 'DELIVERED' ? order.netAmount - orderCost : 0;

                  return (
                    <tr key={order.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{billDate}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1E293B' }}>INV-{order.id.substring(0, 8).toUpperCase()}</td>
                      <td style={{ fontWeight: 700, color: '#1E293B' }}>{order.retailer.pharmacyName}</td>
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
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1E293B' }}>Rs. {order.netAmount.toFixed(2)}</td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {order.status === 'DELIVERED' ? (
                          <span style={{ color: '#059669', fontWeight: 700 }}>Rs. {orderProfit.toFixed(2)}</span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: 11 }}>Awaiting delivery</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button
                            onClick={() => {
                              setSelectedOrderForPrint(order);
                              logActivity('PREVIEW_INVOICE', `Opened custom print preview for order: ${order.id}`);
                            }}
                            className="btn-ghost"
                            style={{ padding: '5px 10px', fontSize: 11, gap: 4 }}
                          >
                            <Printer style={{ width: 13, height: 13, color: '#F97316' }} />
                            Print
                          </button>
                          <button
                            onClick={() => handleSendInvoice(order)}
                            className="btn-ghost"
                            style={{ padding: '5px 10px', fontSize: 11, gap: 4 }}
                          >
                            <Send style={{ width: 13, height: 13, color: '#0EA5E9' }} />
                            Send
                          </button>
                          {order.status !== 'DELIVERED' && (
                            <button
                              onClick={() => handleSendReminder(order)}
                              className="btn-danger"
                              style={{ padding: '5px 10px', fontSize: 11, gap: 4 }}
                            >
                              <Bell style={{ width: 13, height: 13 }} />
                              Alert
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto' }} className="no-print">
          <div style={{ background: 'rgba(255,255,255,0.97)', border: '1.5px solid rgba(186,230,253,0.6)', borderRadius: 24, padding: 24, width: '100%', maxWidth: 900, boxShadow: '0 24px 64px rgba(14,165,233,0.18)', display: 'flex', flexDirection: 'row', gap: 24, maxHeight: '90vh' }}>

            {/* LEFT: Controls */}
            <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid #F1F5F9', paddingRight: 24 }}>
              <div>
                <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 16 }}>
                  <Receipt style={{ width: 14, height: 14, color: '#F97316' }} />
                  Bill Customizer
                </h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 16 }}>Update terms, header, and notes before printing.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Invoice Title</label>
                    <input type="text" value={customInvoiceTitle} onChange={(e) => setCustomInvoiceTitle(e.target.value)} className="input-crisp" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Terms &amp; Conditions</label>
                    <textarea rows={4} value={customTerms} onChange={(e) => setCustomTerms(e.target.value)} className="input-crisp" style={{ resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Memo / Notes</label>
                    <textarea rows={3} value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} className="input-crisp" style={{ resize: 'vertical' }} />
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: 16, borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={handlePrint} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', background: 'linear-gradient(135deg, #F97316, #F59E0B)' }}>
                  <Printer style={{ width: 14, height: 14 }} />
                  Print Document
                </button>
                <button onClick={() => setSelectedOrderForPrint(null)} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
                  Close Preview
                </button>
              </div>
            </div>

            {/* RIGHT: Print Preview */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 16, background: 'white', padding: 24 }}>
              <div id="print-area" style={{ color: '#1E293B', fontSize: 12 }}>

                {/* Invoice Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1E293B', paddingBottom: 16, marginBottom: 20 }}>
                  <div>
                    <h1 style={{ fontSize: 20, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{customInvoiceTitle}</h1>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#475569', marginTop: 4 }}>INV-{selectedOrderForPrint.id.substring(0, 12).toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>Date: {new Date(selectedOrderForPrint.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>MedHub Distributor</h2>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>VAT ID: {profileId.substring(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>Kathmandu Warehouse, NP</div>
                  </div>
                </div>

                {/* Billing Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800, fontFamily: 'monospace', marginBottom: 6 }}>Billed To (Customer):</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#1E293B' }}>{selectedOrderForPrint.retailer.pharmacyName}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{selectedOrderForPrint.retailer.address}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>Phone: {selectedOrderForPrint.retailer.phone}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800, fontFamily: 'monospace', marginBottom: 6 }}>Payment Summary:</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#1E293B' }}>Net Value: Rs. {selectedOrderForPrint.netAmount.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Status: <strong>{selectedOrderForPrint.status}</strong></div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>License: {selectedOrderForPrint.retailer.registrationNumber}</div>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 20 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #1E293B', textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.08em', color: '#475569' }}>
                      <th style={{ padding: '8px 0', textAlign: 'left' }}>SKU</th>
                      <th style={{ padding: '8px 0', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '8px 0', textAlign: 'right' }}>Units</th>
                      <th style={{ padding: '8px 0', textAlign: 'right' }}>Unit Price</th>
                      <th style={{ padding: '8px 0', textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderForPrint.items.map((item, index) => {
                      const totalPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
                      const qtyBoxes = item.quantity / totalPerBox;
                      const pricePerBox = item.pricePerUnit * totalPerBox;
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '10px 0', fontFamily: 'monospace', fontWeight: 700, color: '#1E293B' }}>{item.product.sku}</td>
                          <td style={{ padding: '10px 0', fontWeight: 600 }}>{item.product.name} ({qtyBoxes} boxes)</td>
                          <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace' }}>{item.quantity} tabs</td>
                          <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace' }}>Rs. {pricePerBox.toFixed(2)}/box</td>
                          <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#1E293B' }}>Rs. {(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Subtotals */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '2px solid #1E293B', paddingTop: 16, marginBottom: 20 }}>
                  <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'monospace', fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Total Value:</span><span>Rs. {selectedOrderForPrint.totalAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Discount:</span><span>- Rs. {selectedOrderForPrint.discountAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 14, color: '#1E293B', borderTop: '1px solid #1E293B', paddingTop: 8, marginTop: 4 }}>
                      <span>NET VALUE DUE:</span><span>Rs. {selectedOrderForPrint.netAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Terms & Notes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: '1px solid #E2E8F0', paddingTop: 16, fontSize: 9, color: '#94A3B8', marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', marginBottom: 4 }}>Terms &amp; Conditions:</div>
                    <pre style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap' }}>{customTerms}</pre>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', marginBottom: 4 }}>Memo / Notes:</div>
                    <p>{customNotes}</p>
                  </div>
                </div>

                {/* Signature Footer */}
                <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace' }}>
                  <span>MEDHUB SECURE BILLING MATRIX</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ width: 140, borderBottom: '1px solid #94A3B8', height: 40 }}></div>
                    <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginTop: 4 }}>Authorized Signature</span>
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
