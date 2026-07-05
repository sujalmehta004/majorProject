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
  user?: { email: string };
}

interface Batch { id: string; batchNumber: string; manufacturingCost: number; purchasePricePerBox: number; }
interface Product { id: string; name: string; sku: string; tabletsPerStrip: number; stripsPerBox: number; batches?: Batch[]; }
interface OrderAllocation { id: string; quantity: number; batch: Batch; }
interface OrderItem { id: string; productId: string; product: Product; quantity: number; pricePerUnit: number; allocations: OrderAllocation[]; }

interface B2BSettlement {
  id: string;
  orderId?: string;
  amount: number;
  method?: string | null;
  status: string;
  createdAt?: string;
  date?: string;
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
  settleStatus?: string | null;
  settleAmount?: number | null;
  settleMethod?: string | null;
  advanceApplied?: number | null;
  b2bSettlements?: B2BSettlement[];
}

// Settle log entry persisted per payment
interface SettleEntry {
  amount: number;
  date: string; // ISO string
}

interface SupplierSettlement {
  id: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes?: string | null;
}

interface SupplierBill {
  id: string;
  supplierId: string;
  supplier: {
    name: string;
    phone?: string | null;
  };
  billNumber: string;
  billDate: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  notes?: string | null;
  itemsJson?: string | null;
  settlements: SupplierSettlement[];
}

interface BillingClientProps {
  profileId: string;
  initialOrders: Order[];
  initialSupplierBills: SupplierBill[];
  profile?: {
    companyName: string;
    taxId: string;
    address: string;
    phone: string;
  };
}

type TabType = 'transactions' | 'supplier_bills' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'fiscal';

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

const getWalkInName = (justification?: string | null) => {
  if (!justification) return 'Walk-in Customer';
  const match = justification.match(/Walk-in Customer:\s*([^,]+)/);
  return match ? match[1].trim() : justification;
};

const getWalkInPhone = (justification?: string | null) => {
  if (!justification) return '';
  const match = justification.match(/Phone:\s*(.+)$/);
  return match ? match[1].trim() : '';
};

export default function BillingClient({ profileId, initialOrders, initialSupplierBills, profile }: BillingClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [supplierBills, setSupplierBills] = useState<SupplierBill[]>(initialSupplierBills || []);
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

  // Side panel selected row
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  // Full invoice detail modal (opened by clicking Invoice ID)
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<Order | null>(null);

  // Supplier bill detail modal
  const [detailSupplierBill, setDetailSupplierBill] = useState<SupplierBill | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // Settle input state
  const [settleAmount, setSettleAmount] = useState('');
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [settlingBillId, setSettlingBillId] = useState<string | null>(null);
  // Supplier bill settlement method state
  const [supplierBillSettleMethod, setSupplierBillSettleMethod] = useState('CASH');
  // For settlement inside the detail modal
  const [detailBillSettleAmount, setDetailBillSettleAmount] = useState('');
  const [detailBillSettleMethod, setDetailBillSettleMethod] = useState('CASH');
  const [detailBillSettleLoading, setDetailBillSettleLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState('');

  // Supplier bills filters
  const [supBillSupplierSearch, setSupBillSupplierSearch] = useState('');
  const [supBillDateFrom, setSupBillDateFrom] = useState('');
  const [supBillDateTo, setSupBillDateTo] = useState('');

  useEffect(() => {
    // Fetch wholesaler products catalog
    fetch('/api/wholesaler/products')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setProducts(data.products || []);
        }
      })
      .catch(err => console.error('Error fetching products for supplier bills:', err));
  }, []);

  // Helper: get total verified paid amount for an order from DB settlements
  const getOrderPaid = (order: any): number => {
    if (order.b2bSettlements && Array.isArray(order.b2bSettlements)) {
      return order.b2bSettlements
        .filter((s: any) => s.status === 'VERIFIED')
        .reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    }
    return order.settleAmount || 0;
  };

  const getProductBuyingPrice = (productId: string): number => {
    const prod = products.find(p => p.id === productId);
    if (!prod?.batches?.length) return 0;
    // Prefer the most recent batch that has a non-zero purchase price
    const withPrice = prod.batches.filter((b: Batch) => b.purchasePricePerBox > 0);
    if (withPrice.length > 0) return withPrice[withPrice.length - 1].purchasePricePerBox;
    return prod.batches[prod.batches.length - 1]?.purchasePricePerBox || 0;
  };

  const printSupplierBillVoucher = (bill: SupplierBill, itemsArray: any[]) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const companyName = profile?.companyName || 'MedHub Wholesaler';
    const companyTaxId = profile?.taxId || '';
    const companyAddress = profile?.address || '';
    const companyPhone = profile?.phone || '';

    const billDateStr = new Date(bill.billDate).toLocaleDateString();
    const itemsRows = itemsArray.map((item: any) => {
      const prod = products.find(p => p.id === item.productId);
      const cost = item.pricePerBox || getProductBuyingPrice(item.productId) || 0;
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">\${prod?.name || 'Unknown Product'}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">\${item.qtyBoxes}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">Rs. \${cost.toLocaleString()}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: bold;">Rs. \${(item.qtyBoxes * cost).toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const settlementRows = bill.settlements.map((settle: any) => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px dashed #E2E8F0;">\${new Date(settle.date).toLocaleString()}</td>
        <td style="padding: 8px 10px; border-bottom: 1px dashed #E2E8F0;">\${settle.paymentMethod}</td>
        <td style="padding: 8px 10px; border-bottom: 1px dashed #E2E8F0; color: #64748B;">\${settle.notes || 'N/A'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px dashed #E2E8F0; text-align: right; color: #059669; font-weight: bold;">Rs. \${settle.amount.toLocaleString()}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Supplier Bill Voucher - \${bill.billNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1E293B; margin: 0; padding: 40px; line-height: 1.5; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; text-transform: uppercase; color: #0F172A; }
            .subtitle { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748B; font-weight: 700; margin-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
            .info-card { border: 1px solid #E2E8F0; padding: 16px; border-radius: 8px; background-color: #F8FAFC; }
            .card-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748B; margin-bottom: 8px; border-bottom: 1px solid #E2E8F0; padding-bottom: 4px; }
            .data-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .data-table th { padding: 12px 10px; text-align: left; background-color: #F1F5F9; border-bottom: 2px solid #CBD5E1; font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; }
            .totals-table { width: 40%; margin-left: auto; border-collapse: collapse; margin-bottom: 30px; }
            .totals-table td { padding: 8px 10px; font-size: 13px; }
            .footer { text-align: center; margin-top: 60px; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 20px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <div class="subtitle">Purchase Voucher</div>
                <div class="title">\${companyName}</div>
                <div style="font-size: 13px; color: #64748B; margin-top: 4px;">
                  \${companyAddress ? companyAddress + '<br>' : ''}
                  \${companyPhone ? 'Phone: ' + companyPhone : ''}
                  \${companyTaxId ? ' | Tax ID / PAN: ' + companyTaxId : ''}
                </div>
              </td>
              <td style="text-align: right; vertical-align: top;">
                <div style="font-size: 18px; font-weight: 800; color: #0F172A; text-transform: uppercase;">BILL DETAIL</div>
                <div style="font-size: 13px; font-family: monospace; font-weight: bold; margin-top: 6px; color: #F97316;">NO: \${bill.billNumber}</div>
                <div style="font-size: 12px; color: #64748B; margin-top: 4px;">Date: \${billDateStr}</div>
              </td>
            </tr>
          </table>

          <div class="info-grid">
            <div class="info-card">
              <div class="card-title">Supplier Information</div>
              <div style="font-size: 14px; font-weight: bold; color: #0F172A;">\${bill.supplier.name}</div>
              \${bill.supplier.phone ? \`<div style="font-size: 12px; color: #475569; margin-top: 4px;">Phone: \${bill.supplier.phone}</div>\` : ''}
              <div style="font-size: 12px; color: #475569; margin-top: 2px;">Status: <span style="font-weight: bold; text-transform: uppercase;">\${bill.status}</span></div>
            </div>
            <div class="info-card">
              <div class="card-title">Overview Memo</div>
              <div style="font-size: 12px; color: #475569; line-height: 1.6;">\${bill.notes || 'No notes or memo recorded for this purchase.'}</div>
            </div>
          </div>

          \${itemsRows ? \`
            <div class="subtitle" style="margin-bottom: 8px;">Supplied Items List</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="text-align: left;">Item / Medication</th>
                  <th style="text-align: center; width: 100px;">Qty (Boxes)</th>
                  <th style="text-align: right; width: 150px;">Cost per Box</th>
                  <th style="text-align: right; width: 150px;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                \${itemsRows}
              </tbody>
            </table>
          \` : ''}

          \${settlementRows ? \`
            <div class="subtitle" style="margin-bottom: 8px;">Settlement timeline ledger</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="text-align: left;">Settlement Date</th>
                  <th style="text-align: left; width: 150px;">Method</th>
                  <th style="text-align: left;">Notes</th>
                  <th style="text-align: right; width: 150px;">Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                \${settlementRows}
              </tbody>
            </table>
          \` : ''}

          <table class="totals-table">
            <tr>
              <td style="color: #64748B;">Total Bill Amount:</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold;">Rs. \${bill.totalAmount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="color: #64748B; border-bottom: 1px solid #E2E8F0;">Total Amount Paid:</td>
              <td style="text-align: right; font-family: monospace; font-weight: bold; color: #059669; border-bottom: 1px solid #E2E8F0;">Rs. \${bill.paidAmount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; font-size: 15px; padding-top: 12px;">Remaining Balance:</td>
              <td style="text-align: right; font-family: monospace; font-weight: 800; font-size: 16px; color: \${bill.totalAmount - bill.paidAmount > 0 ? '#DC2626' : '#64748B'}; padding-top: 12px;">
                Rs. \${Math.max(bill.totalAmount - bill.paidAmount, 0).toLocaleString()}
              </td>
            </tr>
          </table>

          <div class="footer">
            Generated on \${new Date().toLocaleString()} · System voucher powered by MedHub
          </div>

          <script>
            var printed = false;
            function doPrint() {
              if (printed) return;
              printed = true;
              window.print();
              window.close();
            }
            window.onload = function() {
              setTimeout(doPrint, 200);
            };
            setTimeout(doPrint, 2000);
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleVerifySettlementRequest = async (settlementId: string, orderId: string, approve: boolean) => {
    try {
      const res = await fetch('/api/wholesaler/verify-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settlementId, orderId, approve }),
      });
      const data = await res.json();
      if (data.success) {
        alert(approve ? 'Settlement verified and approved!' : 'Settlement request rejected.');
        // Update client-side state
        setOrders(prev => prev.map(o => {
          if (o.id === orderId) {
            return {
              ...o,
              settleStatus: data.order.settleStatus,
              settleAmount: data.order.settleAmount,
              b2bSettlements: (o.b2bSettlements || []).map((s: any) => 
                s.id === settlementId ? { ...s, status: approve ? 'VERIFIED' : 'REJECTED' } : s
              )
            };
          }
          return o;
        }));

        // Update active modal order if open
        if (invoiceModalOrder && invoiceModalOrder.id === orderId) {
          setInvoiceModalOrder(prev => {
            if (!prev) return null;
            return {
              ...prev,
              settleStatus: data.order.settleStatus,
              settleAmount: data.order.settleAmount,
              b2bSettlements: (prev.b2bSettlements || []).map((s: any) => 
                s.id === settlementId ? { ...s, status: approve ? 'VERIFIED' : 'REJECTED' } : s
              )
            } as any;
          });
        }
      } else {
        alert(data.error || 'Failed to verify settlement');
      }
    } catch (e) {
      alert('Error verifying settlement request');
    }
  };

  const handleSettleSubmit = async (orderId: string, totalAmount: number) => {
    const inputPaid = parseFloat(settleAmount) || 0;
    if (inputPaid <= 0) return;

    try {
      const res = await fetch('/api/wholesaler/verify-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount: inputPaid, method: 'CASH', approve: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update database');
      }
      const data = await res.json();

      // Update client-side state
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          const updatedSettlements = [...(o.b2bSettlements || [])];
          updatedSettlements.push({
            id: Math.random().toString(),
            orderId,
            amount: inputPaid,
            method: 'CASH',
            status: 'VERIFIED',
            createdAt: new Date().toISOString()
          });
          return {
            ...o,
            settleStatus: data.order.settleStatus,
            settleAmount: data.order.settleAmount,
            b2bSettlements: updatedSettlements
          };
        }
        return o;
      }));

      // Also update the invoiceModalOrder if open
      if (invoiceModalOrder && invoiceModalOrder.id === orderId) {
        setInvoiceModalOrder(prev => {
          if (!prev) return null;
          const updatedSettlements = [...(prev.b2bSettlements || [])];
          updatedSettlements.push({
            id: Math.random().toString(),
            orderId,
            amount: inputPaid,
            method: 'CASH',
            status: 'VERIFIED',
            createdAt: new Date().toISOString()
          });
          return {
            ...prev,
            settleStatus: data.order.settleStatus,
            settleAmount: data.order.settleAmount,
            b2bSettlements: updatedSettlements
          };
        });
      }

      setSettleAmount('');
      setSettlingOrderId(null);
      setSuccessMsg(`Payment of Rs. ${inputPaid.toLocaleString()} recorded.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      logActivity('SETTLE_PAYMENT', `Recorded payment of Rs.${inputPaid} for Order ${orderId}`);
    } catch (err: any) {
      alert(err.message || 'Error recording payment settlement in database');
    }
  };

  const handleSupplierSettleSubmit = async (billId: string, method = 'CASH') => {
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) return;

    try {
      const res = await fetch('/api/wholesaler/supplier-bills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: billId,
          settlementAmount: amt,
          paymentMethod: method,
          settlementNotes: `Payment settled via Billing Page (${method})`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to settle supplier bill');

      setSettleAmount('');
      setSettlingBillId(null);
      setSupplierBillSettleMethod('CASH');
      fetchSupplierBills();
      setSuccessMsg(`Supplier payment of Rs. ${amt.toLocaleString()} recorded successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    }
  };

  const handleDetailBillSettle = async () => {
    if (!detailSupplierBill) return;
    const amt = parseFloat(detailBillSettleAmount);
    if (!amt || amt <= 0) return;
    setDetailBillSettleLoading(true);
    try {
      const res = await fetch('/api/wholesaler/supplier-bills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: detailSupplierBill.id,
          settlementAmount: amt,
          paymentMethod: detailBillSettleMethod,
          settlementNotes: `Payment settled via Billing Page (${detailBillSettleMethod})`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to settle supplier bill');

      setDetailBillSettleAmount('');
      await fetchSupplierBills();
      // Refresh the detail view with updated data
      const updatedBill = data.bill;
      if (updatedBill) setDetailSupplierBill(updatedBill);
      setSuccessMsg(`Payment of Rs. ${amt.toLocaleString()} recorded for bill ${detailSupplierBill.billNumber}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setDetailBillSettleLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orders?wholesalerId=${profileId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch bills');
      // Exclude retailer B2C POS orders — they belong on the retailer billing page only
      const b2bOrders = (data.orders || []).filter(
        (o: any) => !o.overrideJustification?.includes('B2C POS')
      );
      setOrders(b2bOrders);
    } catch (err: any) {
      setError(err.message || 'Failed to sync billing data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierBills = async () => {
    try {
      const res = await fetch(`/api/wholesaler/supplier-bills`);
      const data = await res.json();
      if (res.ok) setSupplierBills(data.bills);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalytics = async (period: string) => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`/api/wholesaler/analytics?period=${period}&wholesalerId=${profileId}`);
      const data = await res.json();
      if (res.ok && data.chartData) setAnalyticsData(data.chartData);
    } catch (e) {}
    finally { setAnalyticsLoading(false); }
  };

  useEffect(() => {
    if (['daily', 'weekly', 'monthly', 'yearly'].includes(activeTab)) {
      fetchAnalytics(activeTab);
    }
  }, [activeTab]);

  useSSEListener(profileId, (type) => {
    if (
      type === 'ORDER_CREATED' || type === 'ORDER_STATUS_CHANGED' ||
      type === 'INVENTORY_UPDATED' || type === 'SUPPLIER_UPDATED' ||
      type === 'BILLING_UPDATE'
    ) {
      fetchOrders();
      fetchSupplierBills();
    }
  });

  const calculateMetrics = () => {
    let totalSales = 0, totalCogs = 0;
    let pendingSales = 0;
    orders.forEach((order: any) => {
      if (order.status === 'DELIVERED') {
        totalSales += order.netAmount;
        order.items.forEach((item: any) => item.allocations.forEach((al: any) => {
          totalCogs += al.quantity * al.batch.manufacturingCost;
        }));
      }
      // Count remaining unpaid for ALL orders regardless of delivery status
      const paid = getOrderPaid(order);
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
  const downloadFiscalExcel = () => {
    const headers = [
      'Date',
      'Invoice ID',
      'Customer Pharmacy',
      'Status',
      'Gross Amount (Rs.)',
      'Discount Amount (Rs.)',
      'Net Amount (Rs.)',
      'Estimated Profit (Rs.)',
      'Purchased Items'
    ];
    
    const rows = fiscalOrders.map(o => {
      const itemsDetail = o.items.map(item => `${item.product.name} (${item.quantity} units)`).join('; ');
      return [
        new Date(o.createdAt).toLocaleDateString(),
        `INV-${o.id.substring(0, 8).toUpperCase()}`,
        o.retailer.pharmacyName === "Walk-in Customer (POS)" ? getWalkInName(o.overrideJustification) : o.retailer.pharmacyName,
        o.status,
        o.totalAmount,
        o.discountAmount,
        o.netAmount,
        o.status === 'DELIVERED' ? getOrderProfit(o) : 0,
        `"${itemsDetail}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `MedHub_Fiscal_Audit_${fiscalYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendInvoice = async (order: Order) => {
    setError(''); setSuccessMsg('');
    try {
      const res = await fetch(`/api/orders/${order.id}/send-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch digital invoice email.');
      await logActivity('SEND_INVOICE', `Dispatched digital tax invoice for Order ${order.id.substring(0, 8)} to ${order.retailer.pharmacyName}`);
      setSuccessMsg(data.message || `Digital Invoice dispatched to ${order.retailer.pharmacyName} successfully.`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending the invoice email.');
    }
    setTimeout(() => { setSuccessMsg(''); setError(''); }, 5000);
  };

  const handlePrint = async () => {
    if (!selectedOrderForPrint) return;
    await logActivity('PRINT_INVOICE', `Printed custom invoice for order: ${selectedOrderForPrint.id}`);
    const order = selectedOrderForPrint as any;
    const customerName = order.retailer.pharmacyName === 'Walk-in Customer (POS)'
      ? getWalkInName(order.overrideJustification)
      : order.retailer.pharmacyName;
    const customerAddress = order.retailer.pharmacyName === 'Walk-in Customer (POS)'
      ? 'POS Counter Walk-in Cash Sale'
      : order.retailer.address;
    const customerPhone = order.retailer.pharmacyName === 'Walk-in Customer (POS)'
      ? getWalkInPhone(order.overrideJustification)
      : order.retailer.phone;
    const paidAmt = getOrderPaid(order);
    const remaining = Math.max(order.netAmount - paidAmt, 0);
    const itemRows = order.items.map((item: any) => {
      const totalPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
      const qtyBoxes = item.quantity / totalPerBox;
      const pricePerBox = item.pricePerUnit * totalPerBox;
      return `<tr>
        <td style="padding:8px 4px;border-bottom:1px solid #E2E8F0;font-family:monospace;font-weight:700">${item.product.sku}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #E2E8F0;font-weight:600">${item.product.name} (${qtyBoxes} boxes)</td>
        <td style="padding:8px 4px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:monospace">${item.quantity} tabs</td>
        <td style="padding:8px 4px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:monospace">Rs. ${pricePerBox.toFixed(2)}/box</td>
        <td style="padding:8px 4px;border-bottom:1px solid #E2E8F0;text-align:right;font-family:monospace;font-weight:800">Rs. ${(item.quantity * item.pricePerUnit).toFixed(2)}</td>
      </tr>`;
    }).join('');
    const htmlContent = `<!DOCTYPE html>
<html><head><title>${customInvoiceTitle} - INV-${order.id.substring(0, 12).toUpperCase()}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1E293B; padding: 32px; background: white; }
  h1 { font-size: 22px; font-weight: 900; text-transform: uppercase; }
  h2 { font-size: 14px; font-weight: 900; text-transform: uppercase; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1E293B; padding-bottom: 16px; margin-bottom: 20px; }
  .billing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  .label { font-size: 9px; text-transform: uppercase; color: #94A3B8; font-weight: 800; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead tr { border-bottom: 2px solid #1E293B; }
  th { padding: 8px 4px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; font-weight: 700; }
  th:last-child, th:nth-child(3), th:nth-child(4) { text-align: right; }
  .totals { display: flex; justify-content: flex-end; border-top: 2px solid #1E293B; padding-top: 16px; margin-bottom: 20px; }
  .totals-inner { width: 50%; display: flex; flex-direction: column; gap: 6px; font-family: monospace; font-size: 11px; }
  .totals-row { display: flex; justify-content: space-between; color: #64748B; }
  .totals-net { display: flex; justify-content: space-between; font-weight: 900; font-size: 14px; color: #1E293B; border-top: 1px solid #1E293B; padding-top: 8px; margin-top: 4px; }
  .footer { border-top: 1px dashed #CBD5E1; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; font-weight: 700; color: #94A3B8; font-family: monospace; }
  .sig-box { text-align: right; }
  .sig-line { width: 140px; border-bottom: 1px solid #94A3B8; height: 40px; margin-left: auto; }
  .terms { margin-top: 20px; padding: 12px; background: #F8FAFC; border-radius: 8px; font-size: 10px; color: #64748B; line-height: 1.6; }
  @media print { body { padding: 16px; } }
</style></head>
<body>
<div class="header">
  <div>
    <h1>${customInvoiceTitle}</h1>
    <div style="font-family:monospace;font-weight:700;color:#475569;margin-top:4px">INV-${order.id.substring(0, 12).toUpperCase()}</div>
    <div style="font-size:10px;color:#94A3B8;font-family:monospace;margin-top:2px">Date: ${new Date(order.createdAt).toLocaleDateString()}</div>
  </div>
  <div style="text-align:right">
    <h2>${profile?.companyName || 'MedHub Distributor'}</h2>
    <div style="font-size:10px;color:#475569;margin-top:2px">${profile?.address || 'Warehouse Location'}</div>
    <div style="font-size:10px;color:#475569">Phone: ${profile?.phone || 'N/A'}</div>
    <div style="font-size:11px;color:#475569;font-weight:800;margin-top:4px">VAT/PAN: ${profile?.taxId || profileId.substring(0, 8).toUpperCase()}</div>
  </div>
</div>
<div class="billing-grid">
  <div>
    <div class="label">Billed To:</div>
    <div style="font-size:13px;font-weight:900">${customerName}</div>
    <div style="font-size:11px;color:#475569;margin-top:2px">${customerAddress}</div>
    <div style="font-size:10px;color:#94A3B8;margin-top:1px">Phone: ${customerPhone}</div>
  </div>
  <div>
    <div class="label">Payment Summary:</div>
    <div style="font-size:13px;font-weight:900">Net Value: Rs. ${order.netAmount.toFixed(2)}</div>
    <div style="font-size:11px;color:#059669;margin-top:2px">Paid: Rs. ${paidAmt.toLocaleString()}</div>
    <div style="font-size:11px;color:#DC2626;margin-top:1px">Remaining: Rs. ${remaining.toLocaleString()}</div>
  </div>
</div>
<table>
  <thead><tr>
    <th>SKU</th><th>Description</th><th style="text-align:right">Units</th>
    <th style="text-align:right">Unit Price</th><th style="text-align:right">Subtotal</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<div class="totals">
  <div class="totals-inner">
    <div class="totals-row"><span>Total:</span><span>Rs. ${order.totalAmount.toFixed(2)}</span></div>
    <div class="totals-row"><span>Discount:</span><span>- Rs. ${order.discountAmount.toFixed(2)}</span></div>
    <div class="totals-net"><span>NET DUE:</span><span>Rs. ${order.netAmount.toFixed(2)}</span></div>
    <div class="totals-row" style="color:#059669;font-weight:700"><span>Paid:</span><span>Rs. ${paidAmt.toLocaleString()}</span></div>
    <div class="totals-row" style="color:#DC2626;font-weight:700"><span>Remaining:</span><span>Rs. ${remaining.toLocaleString()}</span></div>
  </div>
</div>
${customTerms ? `<div class="terms"><strong>Terms &amp; Conditions:</strong><br>${customTerms.replace(/\n/g, '<br>')}</div>` : ''}
${customNotes ? `<div class="terms" style="margin-top:8px"><strong>Notes:</strong><br>${customNotes.replace(/\n/g, '<br>')}</div>` : ''}
<div class="footer">
  <span>MEDHUB SECURE BILLING MATRIX</span>
  <div class="sig-box"><div class="sig-line"></div><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-top:4px">Authorized Signature</span></div>
</div>
</body></html>`;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
    }
  };

  const printFiscalAudit = () => {
    const deliveredOrders = fiscalOrders.filter(o => o.status === 'DELIVERED');
    const pendingOrders = fiscalOrders.filter(o => o.status !== 'DELIVERED');
    const totalDiscount = fiscalOrders.reduce((s, o) => s + o.discountAmount, 0);
    const grossRevenue = fiscalOrders.reduce((s, o) => s + o.totalAmount, 0);
    const rowsHtml = fiscalOrders.map(o => {
      const custName = o.retailer.pharmacyName === 'Walk-in Customer (POS)' ? getWalkInName(o.overrideJustification) : o.retailer.pharmacyName;
      const profit = o.status === 'DELIVERED' ? getOrderProfit(o) : 0;
      return `<tr>
        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
        <td style="font-family:monospace;font-weight:700;color:#F97316">INV-${o.id.substring(0,8).toUpperCase()}</td>
        <td style="font-weight:700">${custName}</td>
        <td>${o.status}</td>
        <td style="font-family:monospace;text-align:right">Rs. ${o.totalAmount.toFixed(2)}</td>
        <td style="font-family:monospace;text-align:right;color:#EA580C">-Rs. ${o.discountAmount.toFixed(2)}</td>
        <td style="font-family:monospace;text-align:right;font-weight:800">Rs. ${o.netAmount.toFixed(2)}</td>
        <td style="font-family:monospace;text-align:right;color:${o.status==='DELIVERED'?'#059669':'#94A3B8'}">${o.status==='DELIVERED'?`Rs. ${profit.toFixed(2)}`:'—'}</td>
      </tr>`;
    }).join('');
    const htmlContent = `<!DOCTYPE html>
<html><head><title>Fiscal Audit Report ${fiscalYear}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1E293B; padding: 24px; background: white; }
  h1 { font-size: 18px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; }
  .sub { font-size: 11px; color: #64748B; margin-bottom: 20px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .kpi { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
  .kpi-label { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #94A3B8; margin-bottom: 4px; }
  .kpi-val { font-size: 16px; font-weight: 900; font-family: monospace; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  thead { background: #1E293B; color: white; }
  th { padding: 8px 10px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
  th:nth-child(5), th:nth-child(6), th:nth-child(7), th:nth-child(8) { text-align: right; }
  tbody tr { border-bottom: 1px solid #F1F5F9; }
  tbody tr:nth-child(even) { background: #F8FAFC; }
  td { padding: 7px 10px; vertical-align: middle; }
  .total-row { background: #1E293B !important; color: white; font-weight: 800; }
  .total-row td { color: white; padding: 10px; }
  @media print { body { padding: 12px; } }
</style></head>
<body>
<h1>Fiscal Audit Report — ${fiscalYear}</h1>
<div class="sub">Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; ${profile?.companyName || 'MedHub Distributor'}</div>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Net Revenue</div><div class="kpi-val" style="color:#0369A1">Rs. ${fiscalRevenue.toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Gross Profit</div><div class="kpi-val" style="color:#047857">Rs. ${fiscalProfit.toLocaleString()}</div></div>
  <div class="kpi"><div class="kpi-label">Total Invoices</div><div class="kpi-val" style="color:#C2410C">${fiscalOrders.length}</div></div>
  <div class="kpi"><div class="kpi-label">Total Discount</div><div class="kpi-val" style="color:#7C3AED">Rs. ${totalDiscount.toFixed(2)}</div></div>
  <div class="kpi"><div class="kpi-label">Delivered</div><div class="kpi-val" style="color:#059669">${deliveredOrders.length}</div></div>
  <div class="kpi"><div class="kpi-label">Pending/Other</div><div class="kpi-val" style="color:#EA580C">${pendingOrders.length}</div></div>
  <div class="kpi"><div class="kpi-label">Gross Billed</div><div class="kpi-val">Rs. ${grossRevenue.toFixed(2)}</div></div>
  <div class="kpi"><div class="kpi-label">Profit Margin</div><div class="kpi-val" style="color:#0EA5E9">${fiscalRevenue>0?((fiscalProfit/fiscalRevenue)*100).toFixed(1):0}%</div></div>
</div>
<table>
  <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Status</th><th style="text-align:right">Gross</th><th style="text-align:right">Discount</th><th style="text-align:right">Net</th><th style="text-align:right">Profit</th></tr></thead>
  <tbody>${rowsHtml}
    <tr class="total-row"><td colspan="4">FISCAL YEAR TOTALS</td>
    <td style="text-align:right;color:#FCD34D">Rs. ${grossRevenue.toFixed(2)}</td>
    <td style="text-align:right;color:#FCA5A5">-Rs. ${totalDiscount.toFixed(2)}</td>
    <td style="text-align:right;color:#6EE7B7">Rs. ${fiscalRevenue.toFixed(2)}</td>
    <td style="text-align:right;color:#6EE7B7">Rs. ${fiscalProfit.toFixed(2)}</td></tr>
  </tbody>
</table>
</body></html>`;
    const printWindow = window.open('', '_blank', 'width=1100,height=750');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
    }
  };

  const fiscalOrders = orders.filter(o => 
    new Date(o.createdAt).getFullYear() === fiscalYear &&
    !o.overrideJustification?.includes('B2C POS')
  );
  const fiscalRevenue = fiscalOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.netAmount, 0);
  const fiscalProfit = fiscalOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + getOrderProfit(o), 0);

  // Supplier bills for the same fiscal year — treated as procurement expenses
  const fiscalSupplierBills = supplierBills.filter(b =>
    new Date(b.billDate).getFullYear() === fiscalYear
  );
  const totalProcurement = fiscalSupplierBills.reduce((s, b) => s + b.totalAmount, 0);
  const paidToSuppliers = fiscalSupplierBills.reduce((s, b) => s + b.paidAmount, 0);
  const supplierDueBalance = totalProcurement - paidToSuppliers;
  // Net profit after deducting supplier procurement costs (only for DELIVERED orders)
  const netProfitAfterCosts = fiscalRevenue - totalProcurement;

  // Filtered orders for transaction table
  const filteredOrders = orders.filter(o => {
    // Exclude retailer-side B2C POS sales — those belong only to the retailer's billing view
    if (o.overrideJustification?.includes('B2C POS')) return false;

    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchSearch = !filterSearch ||
      o.retailer.pharmacyName.toLowerCase().includes(filterSearch.toLowerCase()) ||
      o.overrideJustification?.toLowerCase().includes(filterSearch.toLowerCase()) ||
      o.id.toLowerCase().includes(filterSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const TABS: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'transactions', label: 'Transactions', icon: <FileText style={{ width: 12, height: 12 }} /> },
    { key: 'supplier_bills', label: 'Supplier Bills', icon: <Receipt style={{ width: 12, height: 12 }} /> },
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
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(14,165,233,0.18)', borderRadius: 20, padding: '20px 24px', boxShadow: '0 2px 16px rgba(14,165,233,0.07)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt style={{ width: 22, height: 22, color: '#0EA5E9' }} />
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
          { label: 'Unpaid Due', value: `Rs. ${pendingSales.toLocaleString()}`, badge: 'UNPAID', icon: <Clock style={{ width: 20, height: 20 }} />, badgeBg: '#F0F9FF', badgeColor: '#0EA5E9', badgeBorder: '#BAE6FD', iconBg: '#F0F9FF', shadow: '0 4px 20px rgba(14,165,233,0.1)' },
          { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, badge: 'MARGIN', icon: <TrendingUp style={{ width: 20, height: 20 }} />, badgeBg: '#F0F9FF', badgeColor: '#0284C7', badgeBorder: '#BAE6FD', iconBg: '#F0F9FF', shadow: '0 4px 20px rgba(14,165,233,0.1)' },
          { label: 'Gross Profit', value: `Rs. ${grossProfit.toLocaleString()}`, badge: 'PROFIT', icon: <ArrowUpRight style={{ width: 20, height: 20 }} />, badgeBg: '#F0F9FF', badgeColor: '#0EA5E9', badgeBorder: '#BAE6FD', iconBg: '#F0F9FF', shadow: '0 4px 20px rgba(14,165,233,0.1)' },
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
              <TrendingUp style={{ width: 14, height: 14, color: '#38BDF8' }} /> Profitability Ledger
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 24 }}>
              <div><div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gross Profits</div><div style={{ fontSize: 24, fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: 4 }}>Rs. {grossProfit.toLocaleString()}</div></div>
              <div><div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Profit Margin</div><div style={{ fontSize: 24, fontWeight: 900, color: '#38BDF8', fontFamily: 'monospace', marginTop: 4 }}>{profitMargin.toFixed(1)}%</div></div>
              <div><div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost of Goods</div><div style={{ fontSize: 24, fontWeight: 900, color: '#FCD34D', fontFamily: 'monospace', marginTop: 4 }}>Rs. {totalCogs.toLocaleString()}</div></div>
            </div>
          </div>
          <span style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, color: '#FCA5A5', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Verifier Active</span>
        </div>
      </div>

      {/* Tab Navigation Bar */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(14,165,233,0.15)', borderRadius: 14, padding: '6px 8px', boxShadow: '0 2px 8px rgba(14,165,233,0.06)', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
              transition: 'all 0.18s ease',
              background: activeTab === tab.key ? 'linear-gradient(135deg, #0EA5E9, #38BDF8)' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#64748B',
              boxShadow: activeTab === tab.key ? '0 2px 10px rgba(14,165,233,0.3)' : 'none',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* TRANSACTIONS TAB */}
      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (() => {
        // Find orders with pending B2B settlements
        const pendingSettlementOrders = orders.filter(o => 
          o.b2bSettlements?.some((s: any) => s.status === 'PENDING')
        );

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Pending Settlements Verification Section */}
            {pendingSettlementOrders.length > 0 && (
              <div style={{ background: 'linear-gradient(135deg, rgba(30,64,175,0.06), rgba(59,130,246,0.03))', border: '1.5px dashed #3B82F6', borderRadius: 16, padding: '20px 24px', boxShadow: '0 4px 20px rgba(59,130,246,0.05)' }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign style={{ width: 18, height: 18, color: '#3B82F6' }} /> B2B Payment Verification Requests
                </h3>
                <p style={{ margin: '4px 0 16px', fontSize: 12, color: '#475569' }}>
                  The following retailers have submitted payments that require your confirmation.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pendingSettlementOrders.map(order => {
                    const pendings = (order.b2bSettlements || []).filter((s: any) => s.status === 'PENDING');
                    return pendings.map((settle: any) => (
                      <div key={settle.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', padding: '14px 18px', borderRadius: 12, border: '1.5px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>
                            {order.retailer.pharmacyName}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            Invoice: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{order.id.substring(0, 8).toUpperCase()}</span> · Amount: <strong style={{ color: '#10B981' }}>Rs. {settle.amount.toLocaleString()}</strong> via {settle.method}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleVerifySettlementRequest(settle.id, order.id, false)}
                            style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #EF4444', fontSize: 12, fontWeight: 700, background: '#FFFFFF', color: '#EF4444', cursor: 'pointer', transition: 'all 0.2s' }}
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleVerifySettlementRequest(settle.id, order.id, true)}
                            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 800, background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFFFFF', cursor: 'pointer', transition: 'all 0.2s' }}
                          >
                            Approve & Settle
                          </button>
                        </div>
                      </div>
                    ));
                  })}
                </div>
              </div>
            )}

            {/* Main Transaction List (Full Width) */}
            <div className="card" style={{ background: '#FFFFFF', padding: 24, border: '1.5px solid #E2E8F0', borderRadius: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              {/* Header with filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: '1px solid #F1F5F9', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }} /> Sales Ledger Invoices
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94A3B8' }}>Click any invoice row to view details, settle balance, or send digital copy.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '6px 12px' }}>
                    <FileText style={{ width: 14, height: 14, color: '#94A3B8' }} />
                    <input type="text" placeholder="Search invoices..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: 140, color: '#1E293B' }} />
                  </div>
                  {/* Status filter */}
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#475569', background: '#FFFFFF', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <option value="all">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="DISPATCHED">Dispatched</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="RETURNED">Returned</option>
                  </select>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                      <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'left' }}>Invoice ID</th>
                      <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'left' }}>Customer</th>
                      <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Advance Applied</th>
                      <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Net Payable</th>
                      <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Total Paid</th>
                      <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'right' }}>Outstanding Due</th>
                      <th style={{ padding: '12px 16px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: 13 }}>No bills found matching filters.</td></tr>
                    ) : (
                      filteredOrders.map((order: any) => {
                        const paid = getOrderPaid(order);
                        const due = Math.max(order.netAmount - paid, 0);
                        return (
                          <tr key={order.id}
                            style={{ cursor: 'pointer', borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}
                            onClick={() => setInvoiceModalOrder(order)}
                            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '14px 16px', fontSize: 12, color: '#64748B' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#3B82F6', fontSize: 12 }}>
                              INV-{order.id.substring(0, 8).toUpperCase()}
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1E293B', fontSize: 12 }}>
                              {order.retailer.pharmacyName === "Walk-in Customer (POS)" ? (
                                <span style={{ fontSize: 11, color: '#0EA5E9' }}>{getWalkInName(order.overrideJustification)}</span>
                              ) : (
                                order.retailer.pharmacyName
                              )}
                            </td>
                            <td style={{ padding: '14px 16px' }}>
                              <span style={statusPillStyle(order.status)}>{order.status}</span>
                            </td>
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 700, color: '#8B5CF6' }}>
                              {(order.advanceApplied || 0) > 0 ? `Rs. ${(order.advanceApplied as number).toLocaleString()}` : '—'}
                            </td>
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 800, color: '#1E293B' }}>
                              Rs. {order.netAmount.toLocaleString()}
                            </td>
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 800, color: '#10B981' }}>
                              Rs. {paid.toLocaleString()}
                            </td>
                            <td style={{ padding: '14px 16px', fontFamily: 'monospace', textAlign: 'right', fontWeight: 900, color: due > 0 ? '#EF4444' : '#10B981' }}>
                              {due > 0 ? `Rs. ${due.toLocaleString()}` : '✓ Paid'}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                <button onClick={() => { setSelectedOrderForPrint(order); logActivity('PREVIEW_INVOICE', `Opened custom print preview for order: ${order.id}`); }} className="btn-ghost" style={{ padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Printer style={{ width: 13, height: 13 }} /> Print
                                </button>
                                <button onClick={() => setInvoiceModalOrder(order)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#F0F9FF', color: '#0EA5E9', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Eye style={{ width: 13, height: 13 }} /> Details
                                </button>
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
          </div>
        );
      })()}

      {/* SUPPLIER BILLS TAB */}
      {activeTab === 'supplier_bills' && (
        <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 16 }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0EA5E9', display: 'inline-block' }} /> Wholesaler Supplier Bills Ledger
            </h3>
            
            {/* Filter controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search supplier / bill #..."
                value={supBillSupplierSearch}
                onChange={e => setSupBillSupplierSearch(e.target.value)}
                className="input-crisp"
                style={{ fontSize: 11, padding: '5px 10px', width: 180 }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 650 }}>Date:</span>
                <input
                  type="date"
                  value={supBillDateFrom}
                  onChange={e => setSupBillDateFrom(e.target.value)}
                  className="input-crisp"
                  style={{ fontSize: 11, padding: '4px 8px', width: 115 }}
                />
                <span style={{ fontSize: 10, color: '#64748B' }}>to</span>
                <input
                  type="date"
                  value={supBillDateTo}
                  onChange={e => setSupBillDateTo(e.target.value)}
                  className="input-crisp"
                  style={{ fontSize: 11, padding: '4px 8px', width: 115 }}
                />
              </div>
              {(supBillSupplierSearch || supBillDateFrom || supBillDateTo) && (
                <button
                  onClick={() => {
                    setSupBillSupplierSearch('');
                    setSupBillDateFrom('');
                    setSupBillDateTo('');
                  }}
                  className="btn-ghost"
                  style={{ fontSize: 10, padding: '5px 10px', color: '#EF4444', borderColor: '#FECDD3', background: '#FEF2F2' }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill Date</th>
                  <th>Bill Reference</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total Bill Amount</th>
                  <th style={{ textAlign: 'right' }}>Amount Paid</th>
                  <th style={{ textAlign: 'right' }}>Remaining Due</th>
                  <th style={{ textAlign: 'center' }}>Settle Action</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = supplierBills.filter(bill => {
                    const matchText = bill.supplier.name.toLowerCase().includes(supBillSupplierSearch.toLowerCase()) ||
                                      bill.billNumber.toLowerCase().includes(supBillSupplierSearch.toLowerCase());
                    if (!matchText) return false;

                    const billTime = new Date(bill.billDate).getTime();
                    if (supBillDateFrom && billTime < new Date(supBillDateFrom).getTime()) return false;
                    if (supBillDateTo && billTime > new Date(supBillDateTo).getTime()) return false;

                    return true;
                  });

                  if (filtered.length === 0) {
                    return <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>No supplier bills found matching filters.</td></tr>;
                  }

                  return filtered.map((bill) => {
                    const due = Math.max(bill.totalAmount - bill.paidAmount, 0);
                    const isFullyPaid = bill.paidAmount >= bill.totalAmount;
                    return (
                      <tr key={bill.id} onClick={() => setDetailSupplierBill(bill)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748B' }}>{new Date(bill.billDate).toLocaleDateString()}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0EA5E9' }}>{bill.billNumber}</td>
                        <td style={{ fontWeight: 700, color: '#1E293B' }}>{bill.supplier.name}</td>
                        <td>
                          <span className={`status-pill status-pill-${bill.status.toLowerCase()}`}>{bill.status}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>Rs. {bill.totalAmount.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>Rs. {bill.paidAmount.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: due > 0 ? '#DC2626' : '#94A3B8' }}>Rs. {due.toLocaleString()}</td>
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          {!isFullyPaid ? (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                              {settlingBillId === bill.id ? (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  <input 
                                    type="number" 
                                    placeholder="Amount"
                                    value={settleAmount} 
                                    onChange={e => setSettleAmount(e.target.value)} 
                                    className="input-crisp" 
                                    style={{ width: 80, fontSize: 10, padding: 4 }} 
                                  />
                                  <select
                                    value={supplierBillSettleMethod}
                                    onChange={e => setSupplierBillSettleMethod(e.target.value)}
                                    className="select-crisp"
                                    style={{ fontSize: 10, padding: '4px 6px', width: 90 }}
                                  >
                                    <option value="CASH">💵 Cash</option>
                                    <option value="BANK_TRANSFER">🏦 Bank</option>
                                    <option value="MOBILE_BANKING">📱 Mobile</option>
                                    <option value="CARD">💳 Card</option>
                                  </select>
                                  <button 
                                    onClick={() => handleSupplierSettleSubmit(bill.id, supplierBillSettleMethod)}
                                    style={{ padding: '4px 8px', fontSize: 9, background: '#10B981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    ✓ OK
                                  </button>
                                  <button 
                                    onClick={() => setSettlingBillId(null)}
                                    style={{ padding: '4px 6px', fontSize: 9, background: '#64748B', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => { setSettlingBillId(bill.id); setSettleAmount(due.toString()); }}
                                  className="btn-ghost"
                                  style={{ padding: '4px 8px', fontSize: 10, borderColor: '#BAE6FD', color: '#0EA5E9' }}
                                >
                                  Settle
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓ Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Period Chart Tabs */}
      {(['daily', 'weekly', 'monthly', 'yearly'] as TabType[]).includes(activeTab) && (
        <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
          <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart2 style={{ width: 14, height: 14, color: '#0EA5E9' }} /> {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Revenue &amp; Profit
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
                <Bar dataKey="profit" name="Profit" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
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
              <Calendar style={{ width: 14, height: 14, color: '#0EA5E9' }} /> Fiscal Year Audit Report — {fiscalYear}
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={fiscalYear} onChange={e => setFiscalYear(parseInt(e.target.value))} className="input-crisp" style={{ fontSize: 11, padding: '4px 10px', width: 'auto' }}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
               <button onClick={downloadFiscalExcel} className="btn-primary animate-scaleIn" style={{ fontSize: 10, padding: '5px 12px', gap: 4, background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none' }}>
                <FileText style={{ width: 12, height: 12 }} /> Export Excel
              </button>
              <button onClick={printFiscalAudit} className="btn-ghost" style={{ fontSize: 10, padding: '5px 12px', gap: 4 }}>
                <Printer style={{ width: 12, height: 12 }} /> Print Audit
              </button>
            </div>
          </div>
          {/* ── Enhanced KPI Grid ── */}
          {(() => {
            const deliveredOrders = fiscalOrders.filter(o => o.status === 'DELIVERED');
            const pendingOrders = fiscalOrders.filter(o => o.status !== 'DELIVERED');
            const totalDiscount = fiscalOrders.reduce((s, o) => s + o.discountAmount, 0);
            const grossBilled = fiscalOrders.reduce((s, o) => s + o.totalAmount, 0);
            const profitMarginPct = fiscalRevenue > 0 ? ((fiscalProfit / fiscalRevenue) * 100).toFixed(1) : '0';
            const netMarginPct = fiscalRevenue > 0 ? ((netProfitAfterCosts / fiscalRevenue) * 100).toFixed(1) : '0';
            const kpis = [
              { label: 'Sales Revenue', val: `Rs. ${fiscalRevenue.toLocaleString()}`, bg: '#F0F9FF', border: '#BAE6FD', col: '#0369A1' },
              { label: 'Gross Profit', val: `Rs. ${fiscalProfit.toLocaleString()}`, bg: '#ECFDF5', border: '#A7F3D0', col: '#047857' },
              { label: 'Total Procurement', val: `Rs. ${totalProcurement.toLocaleString()}`, bg: '#FFF1F2', border: '#FECDD3', col: '#BE123C' },
              { label: 'Paid to Suppliers', val: `Rs. ${paidToSuppliers.toLocaleString()}`, bg: '#FFF7ED', border: '#FED7AA', col: '#C2410C' },
              { label: 'Supplier Due', val: `Rs. ${supplierDueBalance.toLocaleString()}`, bg: '#FEF3C7', border: '#FDE68A', col: '#B45309' },
              { label: 'Net Profit (After Costs)', val: `Rs. ${netProfitAfterCosts.toLocaleString()}`, bg: netProfitAfterCosts >= 0 ? '#ECFDF5' : '#FFF1F2', border: netProfitAfterCosts >= 0 ? '#A7F3D0' : '#FECDD3', col: netProfitAfterCosts >= 0 ? '#047857' : '#BE123C' },
              { label: 'Total Orders', val: String(fiscalOrders.length), bg: '#FAF5FF', border: '#DDD6FE', col: '#7C3AED' },
              { label: 'Supplier Bills', val: String(fiscalSupplierBills.length), bg: '#F0F9FF', border: '#BAE6FD', col: '#0EA5E9' },
              { label: 'Delivered Orders', val: String(deliveredOrders.length), bg: '#ECFDF5', border: '#A7F3D0', col: '#059669' },
              { label: 'Pending / Other', val: String(pendingOrders.length), bg: '#FFF7ED', border: '#FED7AA', col: '#EA580C' },
              { label: 'Total Discount', val: `Rs. ${totalDiscount.toFixed(2)}`, bg: '#FAF5FF', border: '#DDD6FE', col: '#7C3AED' },
              { label: 'Net Margin', val: `${netMarginPct}%`, bg: '#F0F9FF', border: '#BAE6FD', col: '#0EA5E9' },
            ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                {kpis.map(k => (
                  <div key={k.label} style={{ background: k.bg, border: `1.5px solid ${k.border}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: k.col, textTransform: 'uppercase', opacity: 0.75, marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: k.col, fontFamily: 'monospace', lineHeight: 1.2 }}>{k.val}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Monthly Breakdown Chart (Revenue + Procurement) ── */}
          {(fiscalOrders.length > 0 || fiscalSupplierBills.length > 0) && (() => {
            const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const monthlyData = MONTHS.map((label, idx) => {
              const monthOrders = fiscalOrders.filter(o => new Date(o.createdAt).getMonth() === idx);
              const revenue = monthOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.netAmount, 0);
              const profit = monthOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + getOrderProfit(o), 0);
              const procurement = fiscalSupplierBills
                .filter(b => new Date(b.billDate).getMonth() === idx)
                .reduce((s, b) => s + b.totalAmount, 0);
              return { label, revenue, profit, procurement, count: monthOrders.length };
            });
            return (
              <div style={{ marginBottom: 20, background: '#FAFCFF', border: '1.5px solid #E0F2FE', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BarChart2 style={{ width: 12, height: 12, color: '#0EA5E9' }} /> Monthly Revenue, Profit & Procurement — {fiscalYear}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94A3B8', fontWeight: 600 }} />
                    <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} tickFormatter={(v) => `Rs.${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                    <Bar dataKey="revenue" name="Sales Revenue" fill="#0EA5E9" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="procurement" name="Procurement Cost" fill="#EF4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="profit" name="Gross Profit" fill="#10B981" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

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
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0EA5E9' }}>INV-{o.id.substring(0, 8).toUpperCase()}</td>
                        <td style={{ fontWeight: 700 }}>
                          {o.retailer.pharmacyName === "Walk-in Customer (POS)" ? (
                            <span style={{ fontSize: 11, color: '#0284C7' }}>{getWalkInName(o.overrideJustification)}</span>
                          ) : (
                            o.retailer.pharmacyName
                          )}
                        </td>
                        <td><span style={statusPillStyle(o.status)}>{o.status}</span></td>
                        <td style={{ fontFamily: 'monospace' }}>Rs. {o.totalAmount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'monospace', color: '#EA580C' }}>- Rs. {o.discountAmount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 800 }}>Rs. {o.netAmount.toFixed(2)}</td>
                        <td style={{ fontFamily: 'monospace', color: o.status === 'DELIVERED' ? '#059669' : '#94A3B8', fontWeight: 700 }}>{o.status === 'DELIVERED' ? `Rs. ${getOrderProfit(o).toFixed(2)}` : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#1E293B' }}>
                      <td colSpan={4} style={{ fontSize: 11, fontWeight: 800, color: 'white', padding: '12px 16px' }}>FISCAL YEAR SALES TOTALS</td>
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

          {/* ── Supplier Bills Table for Fiscal Year ── */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#BE123C', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Receipt style={{ width: 12, height: 12 }} /> Supplier Procurement Bills — {fiscalYear}
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead><tr>
                  <th>Bill Date</th><th>Bill #</th><th>Supplier</th><th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                </tr></thead>
                <tbody>
                  {fiscalSupplierBills.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>No supplier bills for fiscal year {fiscalYear}.</td></tr>
                  ) : (
                    <>
                      {fiscalSupplierBills.map(b => {
                        const due = Math.max(b.totalAmount - b.paidAmount, 0);
                        return (
                          <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setDetailSupplierBill(b)}>
                            <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{new Date(b.billDate).toLocaleDateString()}</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#BE123C' }}>{b.billNumber}</td>
                            <td style={{ fontWeight: 700 }}>{b.supplier?.name}</td>
                            <td>
                              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                                background: b.status === 'PAID' ? '#ECFDF5' : b.status === 'PARTIAL' ? '#FFF7ED' : '#FFF1F2',
                                color: b.status === 'PAID' ? '#059669' : b.status === 'PARTIAL' ? '#C2410C' : '#BE123C' }}>
                                {b.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>Rs. {b.totalAmount.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>Rs. {b.paidAmount.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: due > 0 ? '#DC2626' : '#94A3B8' }}>
                              {due > 0 ? `Rs. ${due.toFixed(2)}` : '✓ Cleared'}
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: '#7F1D1D' }}>
                        <td colSpan={4} style={{ fontSize: 11, fontWeight: 800, color: 'white', padding: '12px 16px' }}>PROCUREMENT TOTALS</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#FCA5A5' }}>Rs. {totalProcurement.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#6EE7B7' }}>Rs. {paidToSuppliers.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#FDE68A' }}>Rs. {supplierDueBalance.toFixed(2)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          SUPPLIER BILL DETAIL MODAL
      ───────────────────────────────────────────────────────────────── */}
      {detailSupplierBill && (() => {
        let itemsArray: any[] = [];
        try {
          itemsArray = JSON.parse(detailSupplierBill.itemsJson || '[]');
        } catch(e) {}
        
        const due = Math.max(detailSupplierBill.totalAmount - detailSupplierBill.paidAmount, 0);

        return (
          <div className="modal-overlay animate-fadeIn" onClick={() => setDetailSupplierBill(null)} style={{ zIndex: 9999 }}>
            <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '650px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Receipt style={{ width: 18, height: 18, color: '#0EA5E9' }} /> Supplier Bill Details
                  </h3>
                  <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    Bill No: {detailSupplierBill.billNumber} · Date: {new Date(detailSupplierBill.billDate).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`status-pill status-pill-${detailSupplierBill.status.toLowerCase()}`}>{detailSupplierBill.status}</span>
                  <button onClick={() => setDetailSupplierBill(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex' }}>
                    <X style={{ width: 20, height: 20 }} />
                  </button>
                </div>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Supplier Info */}
                <div style={{ background: '#FAFCFF', border: '1px solid #E0F2FE', borderRadius: 12, padding: 12, fontSize: 11, color: '#334155' }}>
                  <div style={{ fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', fontSize: 9, marginBottom: 4 }}>Supplier Details</div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{detailSupplierBill.supplier.name}</div>
                  {detailSupplierBill.supplier.phone && <div style={{ color: '#64748B', marginTop: 2 }}>Phone: {detailSupplierBill.supplier.phone}</div>}
                </div>

                {/* Amounts Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Total Amount', val: `Rs. ${detailSupplierBill.totalAmount.toLocaleString()}`, color: '#1E293B' },
                    { label: 'Paid Amount', val: `Rs. ${detailSupplierBill.paidAmount.toLocaleString()}`, color: '#059669' },
                    { label: 'Remaining Due', val: `Rs. ${due.toLocaleString()}`, color: due > 0 ? '#DC2626' : '#94A3B8' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: 'monospace' }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Supplied Items */}
                {itemsArray.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Medication Items</div>
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead style={{ background: '#F8FAFC' }}>
                          <tr>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Item</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>Boxes</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Cost / Box</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsArray.map((item: any, i: number) => {
                            const prod = products.find(p => p.id === item.productId);
                            // Resolve cost per box: prefer stored value, fall back to batch purchase price
                            const costPerBox = (item.pricePerBox && item.pricePerBox > 0)
                              ? item.pricePerBox
                              : getProductBuyingPrice(item.productId);
                            const subtotal = (item.qtyBoxes || 0) * costPerBox;
                            return (
                              <tr key={i} style={{ borderTop: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 700 }}>{prod?.name || 'Unknown Product'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace' }}>{item.qtyBoxes}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                  Rs. {costPerBox.toLocaleString()}
                                  {(!item.pricePerBox || item.pricePerBox === 0) && costPerBox > 0 && (
                                    <span style={{ fontSize: 9, color: '#94A3B8', marginLeft: 4 }}>(from batch)</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>Rs. {subtotal.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Memo */}
                {detailSupplierBill.notes && (
                  <div style={{ background: '#FAFCFF', border: '1px solid #E0F2FE', borderRadius: 12, padding: 12, fontSize: 11, color: '#334155' }}>
                    <strong>Note:</strong> {detailSupplierBill.notes}
                  </div>
                )}

                {/* Settlement Timeline Ledger */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Settlement History Ledger</div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, maxHeight: 150, overflowY: 'auto' }}>
                    {detailSupplierBill.settlements.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11, padding: 12, fontStyle: 'italic' }}>
                        No settlements recorded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detailSupplierBill.settlements.map((settle) => (
                          <div key={settle.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                            <div>
                              <span style={{ color: '#64748B' }}>{new Date(settle.date).toLocaleString()}</span>
                              {settle.notes && <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{settle.notes}</div>}
                            </div>
                            <span style={{ fontWeight: 800, color: '#059669' }}>+ Rs. {settle.amount.toLocaleString()} ({settle.paymentMethod})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Settle Section */}
                {due > 0 && (
                  <div style={{ background: 'linear-gradient(135deg, #FFF7ED, #FEF2F2)', border: '1.5px solid #FED7AA', borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#C2410C', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CreditCard style={{ width: 12, height: 12 }} /> Record Settlement Payment
                    </div>
                    <div style={{ fontSize: 11, color: '#7C2D12', marginBottom: 8 }}>
                      Outstanding Due: <strong style={{ fontFamily: 'monospace', fontSize: 13 }}>Rs. {due.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                      <input
                        type="number"
                        step="any"
                        placeholder={`Max Rs. ${due}`}
                        value={detailBillSettleAmount}
                        onChange={e => setDetailBillSettleAmount(e.target.value)}
                        className="input-crisp"
                        style={{ fontSize: 12, padding: '8px 10px' }}
                      />
                      <select
                        value={detailBillSettleMethod}
                        onChange={e => setDetailBillSettleMethod(e.target.value)}
                        className="select-crisp"
                        style={{ fontSize: 12, padding: '8px 10px' }}
                      >
                        <option value="CASH">💵 CASH</option>
                        <option value="BANK_TRANSFER">🏦 BANK TRANSFER</option>
                        <option value="MOBILE_BANKING">📱 MOBILE / FONEPAY</option>
                        <option value="CARD">💳 CARD</option>
                      </select>
                      <button
                        onClick={handleDetailBillSettle}
                        disabled={detailBillSettleLoading || !detailBillSettleAmount}
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: 11, background: '#10B981', whiteSpace: 'nowrap', opacity: detailBillSettleLoading ? 0.7 : 1 }}
                      >
                        {detailBillSettleLoading ? 'Processing...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => printSupplierBillVoucher(detailSupplierBill, itemsArray)}
                  className="btn-ghost"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: '#BAE6FD', color: '#0EA5E9' }}
                >
                  <Printer style={{ width: 14, height: 14 }} /> Print Voucher
                </button>
                <button
                  onClick={() => setDetailSupplierBill(null)}
                  className="btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────────
          TRANSACTION DETAIL MODAL — opened by clicking Invoice ID
      ───────────────────────────────────────────────────────────────── */}
      {invoiceModalOrder && (
        <div className="modal-overlay" onClick={() => setInvoiceModalOrder(null)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '760px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt style={{ width: 18, height: 18, color: '#0EA5E9' }} />
                  Invoice: INV-{invoiceModalOrder.id.substring(0, 12).toUpperCase()}
                </h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                  {invoiceModalOrder.retailer.pharmacyName === 'Walk-in Customer (POS)' ? (
                    <span style={{ fontWeight: 'bold', color: '#0EA5E9' }}>{getWalkInName(invoiceModalOrder.overrideJustification)}</span>
                  ) : (
                    invoiceModalOrder.retailer.pharmacyName
                  )}
                  {' · '}{new Date(invoiceModalOrder.createdAt).toLocaleString()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={statusPillStyle(invoiceModalOrder.status)}>{invoiceModalOrder.status}</span>
                <button onClick={() => setInvoiceModalOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 8, display: 'flex' }}>
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {(() => {
                const imoOrder = invoiceModalOrder as any;
                const imoVerifiedSettlements = (imoOrder.b2bSettlements || []).filter((s: any) => s.status === 'VERIFIED');
                const imoPaid = imoVerifiedSettlements.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
                const imoDue = Math.max(imoOrder.netAmount - imoPaid, 0);
                return (
                  <>
                    {/* Summary grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                      {[
                        { label: 'Gross Amount', val: `Rs. ${imoOrder.totalAmount.toFixed(2)}`, color: '#1E293B' },
                        { label: 'Discount', val: `- Rs. ${imoOrder.discountAmount.toFixed(2)}`, color: '#EA580C' },
                        { label: 'Advance Applied', val: (imoOrder.advanceApplied || 0) > 0 ? `Rs. ${(imoOrder.advanceApplied as number).toLocaleString()}` : 'None', color: '#7C3AED' },
                        { label: 'Net Payable', val: `Rs. ${imoOrder.netAmount.toFixed(2)}`, color: '#0EA5E9' },
                        { label: 'Total Paid', val: `Rs. ${imoPaid.toLocaleString()}`, color: '#059669' },
                        { label: 'Remaining Due', val: `Rs. ${imoDue.toLocaleString()}`, color: imoDue > 0 ? '#DC2626' : '#94A3B8' },
                        { label: 'Profit', val: imoOrder.status === 'DELIVERED' ? `Rs. ${getOrderProfit(imoOrder).toFixed(2)}` : 'Pending', color: '#059669' },
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
                            {imoOrder.items.map((item: any) => {
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

                    {/* Settle History + Settle Input */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <History style={{ width: 12, height: 12 }} /> Payment History
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                          {imoVerifiedSettlements.length === 0 ? (
                            <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', padding: '12px 0' }}>No payments recorded yet.</div>
                          ) : (
                            imoVerifiedSettlements.map((entry: any, i: number) => (
                              <div key={entry.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8 }}>
                                <div>
                                  <div style={{ fontSize: 10, color: '#475569' }}>{new Date(entry.createdAt || entry.date).toLocaleString()}</div>
                                  {entry.method && <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{entry.method}</div>}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>+ Rs. {(entry.amount || 0).toLocaleString()}</div>
                              </div>
                            ))
                          )}
                          {/* Also show pending settlements with PENDING badge */}
                          {(imoOrder.b2bSettlements || []).filter((s: any) => s.status === 'PENDING').map((entry: any, i: number) => (
                            <div key={`pending-${entry.id || i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8 }}>
                              <div>
                                <div style={{ fontSize: 10, color: '#475569' }}>{new Date(entry.createdAt || entry.date).toLocaleString()}</div>
                                <div style={{ fontSize: 9, color: '#C2410C', fontWeight: 700 }}>⏳ AWAITING APPROVAL</div>
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 800, color: '#EA580C', fontFamily: 'monospace' }}>Rs. {(entry.amount || 0).toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Settle input */}
                      <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 14, padding: 16 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#C2410C', marginBottom: 10 }}>
                          <CreditCard style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                          Record Manual Payment
                        </div>
                        {imoDue > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 11, color: '#7C2D12' }}>
                              Remaining Due: <strong style={{ fontFamily: 'monospace' }}>Rs. {imoDue.toLocaleString()}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <button onClick={() => setSettleAmount(String(imoDue))} style={{ padding: '4px 10px', fontSize: 10, borderRadius: 8, border: '1px solid #FED7AA', background: '#FEF3C7', color: '#92400E', cursor: 'pointer', fontWeight: 700 }}>Full Pay</button>
                              <button onClick={() => setSettleAmount(String(Math.floor(imoDue / 2)))} style={{ padding: '4px 10px', fontSize: 10, borderRadius: 8, border: '1px solid #FED7AA', background: '#FEF3C7', color: '#92400E', cursor: 'pointer', fontWeight: 700 }}>Half Pay</button>
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
                                onClick={() => handleSettleSubmit(imoOrder.id, imoOrder.netAmount)}
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
                  </>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setSelectedOrderForPrint(invoiceModalOrder); setInvoiceModalOrder(null); }} className="btn-ghost" style={{ gap: 6 }}>
                <Printer style={{ width: 14, height: 14 }} /> Print Invoice
              </button>
              <button onClick={() => handleSendInvoice(invoiceModalOrder)} className="btn-ghost" style={{ gap: 6 }}>
                <Send style={{ width: 14, height: 14 }} /> Send Invoice
              </button>
              <button onClick={() => setInvoiceModalOrder(null)} className="btn-primary" style={{ background: '#475569' }}>
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
                  <input type="checkbox" checked={visibleCols[col]} onChange={() => setVisibleCols({ ...visibleCols, [col]: !visibleCols[col] })} style={{ accentColor: '#0EA5E9', width: 14, height: 14 }} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* INVOICE PRINT MODAL */}
      {selectedOrderForPrint && (
        <div className="modal-overlay" onClick={() => setSelectedOrderForPrint(null)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '900px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header no-print">
              <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Receipt style={{ width: 16, height: 16, color: '#0EA5E9' }} /> Invoice Print Preview
              </h3>
              <button onClick={() => setSelectedOrderForPrint(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
               {/* Customizer row */}
              <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, background: '#F8FAFC', padding: 16, borderRadius: 12 }}>
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
                    <div style={{ fontSize: 13, fontWeight: 900 }}>
                      {selectedOrderForPrint.retailer.pharmacyName === "Walk-in Customer (POS)" ? (
                        <span>{getWalkInName(selectedOrderForPrint.overrideJustification)}</span>
                      ) : (
                        selectedOrderForPrint.retailer.pharmacyName
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                      {selectedOrderForPrint.retailer.pharmacyName === "Walk-in Customer (POS)" ? 'POS Counter Walk-in Cash Sale' : selectedOrderForPrint.retailer.address}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                      {selectedOrderForPrint.retailer.pharmacyName === "Walk-in Customer (POS)" 
                        ? `Phone: ${getWalkInPhone(selectedOrderForPrint.overrideJustification)}` 
                        : `Phone: ${selectedOrderForPrint.retailer.phone}`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 800, marginBottom: 6 }}>Payment Summary:</div>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>Net Value: Rs. {selectedOrderForPrint.netAmount.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>Paid: Rs. {getOrderPaid(selectedOrderForPrint as any).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#DC2626', marginTop: 1 }}>Remaining: Rs. {Math.max(selectedOrderForPrint.netAmount - getOrderPaid(selectedOrderForPrint as any), 0).toLocaleString()}</div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700 }}><span>Paid:</span><span>Rs. {getOrderPaid(selectedOrderForPrint as any).toLocaleString()}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626', fontWeight: 700 }}><span>Remaining:</span><span>Rs. {Math.max(selectedOrderForPrint.netAmount - getOrderPaid(selectedOrderForPrint as any), 0).toLocaleString()}</span></div>
                  </div>
                </div>
                <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace' }}>
                  <span>MEDHUB SECURE BILLING MATRIX</span>
                  <div style={{ textAlign: 'right' }}><div style={{ width: 140, borderBottom: '1px solid #94A3B8', height: 40 }}></div><span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginTop: 4 }}>Authorized Signature</span></div>
                </div>
              </div>
            </div>
            <div className="modal-footer no-print" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={handlePrint} className="btn-primary" style={{ background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', gap: 6 }}>
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
