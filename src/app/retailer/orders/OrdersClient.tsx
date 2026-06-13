'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Truck, Search, QrCode, AlertCircle, CheckCircle,
  Package, Eye, ShoppingBag, Trash2, Printer, X,
  ChevronRight, Calendar, Building, Hash, Phone,
  FileText, Layers, RefreshCw, Layers2, Square, CheckSquare,
  Clock, AlertTriangle, DollarSign
} from 'lucide-react';
import { confirmB2BDeliveryAction } from '@/app/actions/retailerActions';
import { useRealtimeEvent, broadcastUpdate } from '@/lib/events';

interface Batch {
  id: string;
  batchNumber: string;
  availableBaseUnits: number;
  expiryDate: string;
  sellingPricePerBox: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
  batches: Batch[];
  tierPricingJson?: string;
}

interface Wholesaler {
  id: string;
  companyName: string;
  taxId: string;
  address: string;
  phone: string;
  products: Product[];
}

interface OrderItem {
  id: string;
  quantity: number;
  pricePerUnit: number;
  product: {
    name: string;
    sku: string;
    category: string;
  };
}

interface Order {
  id: string;
  wholesaler: {
    companyName: string;
    phone: string;
    address: string;
  };
  status: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  overrideJustification?: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface OrdersClientProps {
  initialOrders: Order[];
  wholesalers: Wholesaler[];
  profileId: string;
}

const STATUS_META: Record<string, { color: string; bg: string; icon: any }> = {
  PENDING: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', icon: AlertCircle },
  PICKING: { color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', icon: Layers },
  DISPATCHED: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', icon: Truck },
  DELIVERED: { color: '#10B981', bg: 'rgba(16,185,129,0.08)', icon: CheckCircle },
  RETURNED: { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', icon: X },
};

export default function OrdersClient({ initialOrders, wholesalers, profileId }: OrdersClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'tracker' | 'order' | 'intake'>('tracker');
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');

  // Bulk Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Barcode / Label Scanner state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState({ text: '', isError: false });
  const [intakeBarcodeVerification, setIntakeBarcodeVerification] = useState('');

  // Order Placement State
  const [selectedWholesalerId, setSelectedWholesalerId] = useState('');
  const [cart, setCart] = useState<{ productId: string; name: string; qtyBoxes: number; pricePerBox: number; availableBoxes: number }[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState({ text: '', isError: false });
  const [needsOverride, setNeedsOverride] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState('');

  // Detail Modal & Print Preview Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printPreviewOrder, setPrintPreviewOrder] = useState<Order | null>(null);

  // Intake Modal state
  const [intakeOrder, setIntakeOrder] = useState<any>(null);
  const [intakeCustomPrices, setIntakeCustomPrices] = useState<Record<string, { buyingPrice: number; sellingPrice: number }>>({});
  const [intakeSettleNow, setIntakeSettleNow] = useState(false);
  const [intakeSettleAmount, setIntakeSettleAmount] = useState('');
  const [intakeSettleMethod, setIntakeSettleMethod] = useState('CASH');

  // Sync state via realtime updates
  useRealtimeEvent('ORDER_UPDATE', () => {
    fetchOrders();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const es = new EventSource(`/api/events?retailerId=${profileId}`);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.type === 'ORDER_UPDATE') {
          fetchOrders();
        }
      } catch (err) {}
    };
    es.onerror = () => {
      es.close();
    };
    return () => {
      es.close();
    };
  }, [profileId]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/retailer/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setActiveTab('order');
    }
  }, [searchParams]);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        setActiveTab('tracker');
      }
      if (e.key === 'F9') {
        e.preventDefault();
        setActiveTab('order');
      }
      if (e.key === 'F10') {
        e.preventDefault();
        setActiveTab('intake');
      }
      if (e.key === 'Escape') {
        setSelectedOrder(null);
        setPrintPreviewOrder(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openIntakeModalForOrder = (order: any) => {
    const initialPrices: Record<string, { buyingPrice: number; sellingPrice: number }> = {};
    order.items.forEach((item: any) => {
      const wholesalerPricePerBox = item.pricePerUnit * (item.product.tabletsPerStrip * item.product.stripsPerBox);
      initialPrices[item.productId] = {
        buyingPrice: wholesalerPricePerBox,
        sellingPrice: Math.round(wholesalerPricePerBox * 1.25), // default 25% markup
      };
    });

    setIntakeOrder(order);
    setIntakeCustomPrices(initialPrices);
    setIntakeSettleNow(false);
    setIntakeSettleAmount(String(order.netAmount));
    setIntakeSettleMethod('CASH');
    setIntakeBarcodeVerification('');
    setBarcodeMessage({ text: '', isError: false });
  };

  const handleBarcodeIntake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    let searchId = barcodeInput.trim();
    if (searchId.toUpperCase().startsWith('ORD-')) {
      searchId = searchId.substring(4);
    }

    const matched = orders.find(o => 
      o.id.toLowerCase() === searchId.toLowerCase() ||
      o.id.toLowerCase().startsWith(searchId.toLowerCase()) ||
      o.id.toLowerCase().includes(searchId.toLowerCase())
    );

    if (!matched) {
      setBarcodeMessage({ text: `No matching pending/dispatched order found for barcode/ID: ${barcodeInput}`, isError: true });
      return;
    }

    if (matched.status !== 'DISPATCHED') {
      setBarcodeMessage({ text: `Order status is ${matched.status}. It must be DISPATCHED to confirm delivery.`, isError: true });
      return;
    }

    openIntakeModalForOrder(matched);
  };

  const handleConfirmIntakeSubmit = async () => {
    if (!intakeOrder) return;
    try {
      setBarcodeLoading(true);

      const customPricesPayload = Object.entries(intakeCustomPrices).map(([productId, val]) => ({
        productId,
        buyingPrice: val.buyingPrice,
        sellingPrice: val.sellingPrice,
      }));

      const res = await confirmB2BDeliveryAction(
        intakeOrder.id,
        customPricesPayload,
        intakeSettleNow,
        intakeSettleNow ? parseFloat(intakeSettleAmount) : undefined,
        intakeSettleNow ? intakeSettleMethod : undefined
      );

      if (res.success) {
        alert('Package Intake Confirmed! Inventory stock and prices updated.');
        setIntakeOrder(null);
        setBarcodeInput('');
        // Trigger updates across channels
        broadcastUpdate('ORDER_UPDATE');
        broadcastUpdate('INVENTORY_UPDATE');
        broadcastUpdate('BILLING_UPDATE');
      }
    } catch (err: any) {
      alert(err.message || 'Error confirming package intake');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleBulkConfirmDelivery = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`Mark ${selectedOrderIds.length} order(s) as Delivered and ingest items into your inventory?`)) return;

    setBarcodeLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const orderId of selectedOrderIds) {
      try {
        const res = await confirmB2BDeliveryAction(orderId);
        if (res.success) successCount++;
      } catch (err) {
        failCount++;
      }
    }

    setBarcodeLoading(false);
    setSelectedOrderIds([]);
    alert(`Bulk Intake process complete.\nSuccessful deliveries: ${successCount}\nFailed deliveries (e.g. not dispatched): ${failCount}`);
    
    broadcastUpdate('ORDER_UPDATE');
    broadcastUpdate('INVENTORY_UPDATE');
    broadcastUpdate('BILLING_UPDATE');
  };

  const selectedWholesaler = wholesalers.find(w => w.id === selectedWholesalerId);

  const addToCart = (product: Product, qtyStr: string) => {
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) return;

    const unitsPerBox = product.tabletsPerStrip * product.stripsPerBox;
    const totalUnits = product.batches.reduce((sum, b) => sum + b.availableBaseUnits, 0);
    const availableBoxes = Math.floor(totalUnits / unitsPerBox);

    if (qty > availableBoxes) {
      alert(`Only ${availableBoxes} boxes available in wholesaler's stock.`);
      return;
    }

    const basePrice = product.batches[0]?.sellingPricePerBox || 100;
    let price = basePrice;
    try {
      const tiers = JSON.parse(product.tierPricingJson || '[]');
      const matchingTier = tiers.find((t: any) => qty >= t.minQty && qty <= (t.maxQty || 999999));
      if (matchingTier) {
        price = matchingTier.pricePerBox;
      } else if (tiers.length > 0) {
        price = tiers[0].pricePerBox;
      }
    } catch (e) {}

    setCart((prev) => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, qtyBoxes: qty, pricePerBox: price } : item);
      }
      return [...prev, { productId: product.id, name: product.name, qtyBoxes: qty, pricePerBox: price, availableBoxes }];
    });
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWholesaler || cart.length === 0) return;

    try {
      setPlacingOrder(true);
      setOrderMessage({ text: '', isError: false });

      const payload: any = {
        retailerId: profileId,
        wholesalerId: selectedWholesaler.id,
        items: cart.map((c) => ({
          productId: c.productId,
          qtyBoxes: c.qtyBoxes,
        })),
      };

      if (needsOverride && overrideMsg) {
        payload.overrideJustification = overrideMsg;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setOrderMessage({ text: 'B2B order placed successfully! Check status in active tracker.', isError: false });
        setCart([]);
        setNeedsOverride(false);
        setOverrideMsg('');
        broadcastUpdate('ORDER_UPDATE');
        broadcastUpdate('BILLING_UPDATE');
      } else {
        if (data.error === 'CREDIT_BLOCKED') {
          setNeedsOverride(true);
          setOrderMessage({ text: `Blocked: ${data.reason} Enter override justification to proceed.`, isError: true });
        } else {
          setOrderMessage({ text: data.error || 'Failed to place B2B order', isError: true });
        }
      }
    } catch (err: any) {
      setOrderMessage({ text: err.message || 'Error occurred', isError: true });
    } finally {
      setPlacingOrder(false);
    }
  };

  const toggleSelectOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filtered.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filtered.map((o) => o.id));
    }
  };

  const filtered = orders.filter((o) => {
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchesSearch =
      o.id.toLowerCase().includes(filterSearch.toLowerCase()) ||
      o.wholesaler.companyName.toLowerCase().includes(filterSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.qtyBoxes * item.pricePerBox, 0);

  const printOrderVoucher = (order: Order) => {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    const itemRows = order.items.map(item =>
      `<tr>
        <td>${item.product.name}</td>
        <td>${item.product.sku}</td>
        <td style="text-align:right">${item.quantity} units</td>
        <td style="text-align:right">Rs. ${item.pricePerUnit.toLocaleString()}</td>
        <td style="text-align:right">Rs. ${(item.quantity * item.pricePerUnit).toLocaleString()}</td>
      </tr>`
    ).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order Voucher - B2B MedHub</title>
        <style>
          body { font-family: monospace; padding: 24px; color: #000; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
          .logo { font-size: 20px; font-weight: bold; }
          .title { font-size: 14px; text-transform: uppercase; margin-top: 4px; }
          .meta { font-size: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th { border-bottom: 2px solid #000; font-size: 11px; padding: 6px 8px; text-align: left; }
          td { padding: 6px 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
          .total { font-weight: bold; text-align: right; font-size: 14px; margin-top: 8px; }
          .footer { text-align: center; font-size: 10px; border-top: 1px dashed #000; margin-top: 30px; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">MEDHUB PHARMACY NODE</div>
          <div class="title">B2B Purchase Voucher</div>
        </div>
        <div class="meta">
          <div><strong>Order ID:</strong> #${order.id.toUpperCase()}</div>
          <div><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</div>
          <div><strong>Supplier:</strong> ${order.wholesaler.companyName}</div>
          <div><strong>Status:</strong> ${order.status}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>SKU</th>
              <th style="text-align:right">Quantity</th>
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
        <div class="total" style="font-size: 16px; margin-top: 12px; border-top: 2px solid #000; padding-top: 6px;">NET AMOUNT: Rs. ${order.netAmount.toLocaleString()}</div>
        <div class="footer">Thank you for ordering with MedHub B2B Network</div>
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
    setPrintPreviewOrder(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1E293B', margin: 0 }}>B2B Ordering Panel</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            Manage pending shipments, scan barcodes for package arrivals, and order from live wholesalers &nbsp;
            <span style={{ fontSize: 11, color: '#94A3B8' }}>[ F8 ] Tracker · [ F9 ] New B2B Order · [ F10 ] Intake scanner</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setActiveTab('tracker')}
            style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', background: activeTab === 'tracker' ? '#F59E0B' : '#FFFFFF', border: activeTab === 'tracker' ? 'none' : '1.5px solid #E2E8F0', color: activeTab === 'tracker' ? '#FFFFFF' : '#475569' }}
          >
            My Purchase Orders
          </button>
          <button
            onClick={() => setActiveTab('order')}
            style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', background: activeTab === 'order' ? '#F59E0B' : '#FFFFFF', border: activeTab === 'order' ? 'none' : '1.5px solid #E2E8F0', color: activeTab === 'order' ? '#FFFFFF' : '#475569' }}
          >
            Create B2B Purchase
          </button>
          <button
            onClick={() => setActiveTab('intake')}
            style={{ padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', background: activeTab === 'intake' ? '#F59E0B' : '#FFFFFF', border: activeTab === 'intake' ? 'none' : '1.5px solid #E2E8F0', color: activeTab === 'intake' ? '#FFFFFF' : '#475569' }}
          >
            Barcode Package Intake
          </button>
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'tracker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Tracker Filters */}
          <div style={{ display: 'flex', gap: 12, padding: '14px 18px', background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #F1F5F9', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <Search style={{ width: 14, height: 14, color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search order ID or wholesaler…"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 12, color: '#334155' }}
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none', background: '#F8FAFC', color: '#475569', fontWeight: 600 }}
            >
              <option value="all">All Orders</option>
              <option value="PENDING">PENDING</option>
              <option value="PICKING">PICKING</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="DELIVERED">DELIVERED</option>
            </select>

            {selectedOrderIds.length > 0 && (
              <button
                onClick={handleBulkConfirmDelivery}
                disabled={barcodeLoading}
                style={{ background: '#10B981', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <CheckCircle style={{ width: 14, height: 14 }} />
                Bulk Intake ({selectedOrderIds.length})
              </button>
            )}

            <div style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
              {filtered.length} matching entries
            </div>
          </div>

          {/* Orders Table */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px', color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Truck style={{ width: 48, height: 48, color: '#E2E8F0' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No B2B orders found</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                    <th style={{ padding: '14px 20px', width: 40, textAlign: 'center' }}>
                      <button onClick={toggleSelectAll} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                        {selectedOrderIds.length === filtered.length ? (
                          <CheckSquare style={{ width: 16, height: 16, color: '#F59E0B' }} />
                        ) : (
                          <Square style={{ width: 16, height: 16, color: '#CBD5E1' }} />
                        )}
                      </button>
                    </th>
                    <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>Order ID / Barcode</th>
                    <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>Wholesaler</th>
                    <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>Items</th>
                    <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>Net Cost</th>
                    <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>Status</th>
                    <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>Date</th>
                    <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => {
                    const sm = STATUS_META[order.status] || { color: '#64748B', bg: 'rgba(100,116,139,0.08)', icon: AlertCircle };
                    const StatusIcon = sm.icon;
                    const isSelected = selectedOrderIds.includes(order.id);
                    const barcodeLabel = `ORD-${order.id.substring(0, 12).toUpperCase()}`;

                    return (
                      <tr
                        key={order.id}
                        style={{ borderBottom: '1px solid #F8FAFC', transition: 'background 0.1s', background: isSelected ? 'rgba(245,158,11,0.02)' : '' }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#FAFBFC'}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = isSelected ? 'rgba(245,158,11,0.02)' : ''}
                      >
                        <td style={{ padding: '16px 20px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => toggleSelectOrder(order.id, e)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                            {isSelected ? (
                              <CheckSquare style={{ width: 16, height: 16, color: '#F59E0B' }} />
                            ) : (
                              <Square style={{ width: 16, height: 16, color: '#CBD5E1' }} />
                            )}
                          </button>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          {order.status === 'DELIVERED' ? (
                             <>
                               <div style={{ fontWeight: 800, color: '#1E293B', fontFamily: 'monospace' }}>#{order.id.substring(0, 8).toUpperCase()}</div>
                               <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, fontFamily: 'monospace' }}>{barcodeLabel}</div>
                             </>
                           ) : (
                             <div style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                               <Clock style={{ width: 12, height: 12, color: '#F59E0B' }} /> Awaiting Delivery
                             </div>
                           )}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 700, color: '#334155' }}>{order.wholesaler.companyName}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{order.wholesaler.phone}</div>
                        </td>
                        <td style={{ padding: '16px 20px', fontWeight: 600, color: '#475569' }}>
                          {order.items.length} medicine{order.items.length !== 1 ? 's' : ''}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 800, color: '#1E293B' }}>Rs. {order.netAmount.toLocaleString()}</div>
                          {order.discountAmount > 0 && (
                            <div style={{ fontSize: 11, color: '#EF4444' }}>-Rs. {order.discountAmount.toLocaleString()}</div>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg }}>
                            <StatusIcon style={{ width: 12, height: 12 }} />
                            {order.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', color: '#64748B' }}>
                          <div>{new Date(order.createdAt).toLocaleDateString()}</div>
                          <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2 }}>{new Date(order.createdAt).toLocaleTimeString()}</div>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                           <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                             {order.status === 'DISPATCHED' && (
                               <button
                                 onClick={() => openIntakeModalForOrder(order)}
                                 style={{ padding: '6px 12px', background: '#F59E0B', border: 'none', borderRadius: 6, color: '#FFFFFF', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                               >
                                 Intake Package
                               </button>
                             )}
                             <button
                               onClick={() => setSelectedOrder(order)}
                               style={{ padding: '6px', background: '#F1F5F9', border: 'none', borderRadius: 6, color: '#64748B', cursor: 'pointer', display: 'flex' }}
                             >
                               <Eye style={{ width: 13, height: 13 }} />
                             </button>
                           </div>
                         </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'order' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Wholesaler selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Select Wholesaler</div>
            {wholesalers.map((w) => (
              <button
                key={w.id}
                onClick={() => { setSelectedWholesalerId(w.id); setCart([]); }}
                style={{ width: '100%', padding: 14, borderRadius: 12, background: selectedWholesalerId === w.id ? 'rgba(245,158,11,0.06)' : '#FFFFFF', border: selectedWholesalerId === w.id ? '2px solid #F59E0B' : '1.5px solid #F1F5F9', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <div style={{ fontWeight: 800, color: '#1E293B', fontSize: 13 }}>{w.companyName}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{w.address}</div>
              </button>
            ))}
          </div>

          {/* Wholesaler Stock Browse */}
          <div>
            {!selectedWholesaler ? (
              <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #F1F5F9', padding: 80, textAlign: 'center' }}>
                <Building style={{ width: 48, height: 48, color: '#E2E8F0', margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Choose a Wholesaler</h3>
                <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Select a wholesaler from the left panel to browse catalog and build order basket</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Cart Info */}
                {cart.length > 0 && (
                  <div style={{ background: 'rgba(245,158,11,0.06)', border: '1.5px solid rgba(245,158,11,0.2)', padding: '16px 20px', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>{cart.length} item(s) selected</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>Est. Total: Rs. {cartTotal.toLocaleString()}</div>
                    </div>
                    <form onSubmit={handlePlaceOrder} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {needsOverride && (
                        <input
                          type="text"
                          required
                          placeholder="Provide limit override note..."
                          value={overrideMsg}
                          onChange={(e) => setOverrideMsg(e.target.value)}
                          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #EF4444', fontSize: 12 }}
                        />
                      )}
                      <button
                        type="submit"
                        disabled={placingOrder}
                        style={{ padding: '10px 18px', background: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                      >
                        {placingOrder ? 'Submitting…' : 'Submit B2B Order'}
                      </button>
                    </form>
                  </div>
                )}

                {orderMessage.text && (
                  <div style={{ padding: '10px 14px', background: orderMessage.isError ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)', border: `1px solid ${orderMessage.isError ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, color: orderMessage.isError ? '#EF4444' : '#10B981', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                    {orderMessage.text}
                  </div>
                )}

                {/* Stock Table */}
                <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #F1F5F9', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'left' }}>Medicine Name</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'left' }}>Category</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'right' }}>Wholesaler Stock</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'right' }}>Price / Box</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Box Qty</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWholesaler.products.map((prod) => {
                        const tpb = prod.tabletsPerStrip * prod.stripsPerBox;
                        const totalUnits = prod.batches.reduce((sum, b) => sum + b.availableBaseUnits, 0);
                        const totalBoxes = Math.floor(totalUnits / tpb);
                        const price = prod.batches[0]?.sellingPricePerBox || 100;
                        const cartItem = cart.find(c => c.productId === prod.id);

                        return (
                          <tr key={prod.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                            <td style={{ padding: '12px 20px' }}>
                              <div style={{ fontWeight: 800, color: '#1E293B' }}>{prod.name}</div>
                              <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{prod.sku}</div>
                            </td>
                            <td style={{ padding: '12px 20px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: 6, background: '#F1F5F9', fontSize: 11, fontWeight: 600, color: '#475569' }}>{prod.category}</span>
                            </td>
                            <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 700 }}>{totalBoxes} boxes</div>
                              <div style={{ fontSize: 10, color: '#94A3B8' }}>{totalUnits.toLocaleString()} units</div>
                            </td>
                            <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, color: '#F59E0B' }}>Rs. {price.toLocaleString()}</div>
                              {(() => {
                                try {
                                  const tiers = JSON.parse(prod.tierPricingJson || '[]');
                                  if (tiers.length > 0) {
                                    return (
                                      <div style={{ fontSize: 9, color: '#64748B', marginTop: 4 }}>
                                        {tiers.map((t: any, idx: number) => (
                                          <div key={idx}>
                                            {t.minQty}-{t.maxQty || '+'}: Rs. {t.pricePerBox}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  }
                                } catch (e) {}
                                return null;
                              })()}
                            </td>
                            <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                              <input
                                id={`qty-${prod.id}`}
                                type="number"
                                min="1"
                                max={totalBoxes}
                                placeholder="0"
                                defaultValue={cartItem ? String(cartItem.qtyBoxes) : ''}
                                style={{ width: 60, padding: '5px', borderRadius: 6, border: '1px solid #E2E8F0', textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  const input = document.getElementById(`qty-${prod.id}`) as HTMLInputElement;
                                  addToCart(prod, input?.value || '0');
                                }}
                                style={{ padding: '6px 12px', borderRadius: 6, background: cartItem ? '#10B981' : '#F59E0B', color: '#FFFFFF', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                {cartItem ? 'In Basket' : 'Add'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'intake' && (
        <div style={{ maxWidth: 540, background: '#FFFFFF', border: '1.5px solid #F1F5F9', borderRadius: 20, padding: 28, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <QrCode style={{ width: 22, height: 22, color: '#F59E0B' }} />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: 0 }}>Confirm Dispatch Delivery</h3>
          </div>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: '20px', margin: '0 0 20px' }}>
            Input the order barcode printed on the wholesaler dispatch slip. The package contents will automatically transfer and register in your active stock.
          </p>
          <form onSubmit={handleBarcodeIntake} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="text"
              required
              placeholder="e.g. ORD-2BC02F83-1C7 or UUID"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              style={{ padding: '12px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 14, outline: 'none' }}
            />
            <button
              type="submit"
              disabled={barcodeLoading}
              style={{ background: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '12px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              {barcodeLoading ? 'Verifying Dispatch…' : 'Confirm Package Delivery'}
            </button>
          </form>

          {barcodeMessage.text && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: barcodeMessage.isError ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)', border: `1.5px solid ${barcodeMessage.isError ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, color: barcodeMessage.isError ? '#EF4444' : '#10B981', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              {barcodeMessage.text}
            </div>
          )}
        </div>
      )}

      {/* ── Order Detail Modal ── */}
      {selectedOrder && (() => {
        const sm = STATUS_META[selectedOrder.status] || { color: '#64748B', bg: 'rgba(100,116,139,0.08)', icon: AlertCircle };
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 580, background: '#FFFFFF', borderRadius: 24, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
              
              {/* Header */}
              <div style={{ padding: '22px 28px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText style={{ width: 20, height: 20, color: '#F59E0B' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0 }}>B2B Order Detail</h3>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, fontFamily: 'monospace' }}>#{selectedOrder.id.toUpperCase()}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg }}>
                    {selectedOrder.status}
                  </span>
                  <button onClick={() => setSelectedOrder(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: 28, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Meta details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12 }}>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>SUPPLIER WHOLESALER</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginTop: 4 }}>{selectedOrder.wholesaler.companyName}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{selectedOrder.wholesaler.phone} · {selectedOrder.wholesaler.address}</div>
                  </div>
                  <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 12 }}>
                    <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>CREATION DATE</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginTop: 4 }}>{new Date(selectedOrder.createdAt).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Barcode: ORD-{selectedOrder.id.substring(0, 12).toUpperCase()}</div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, marginBottom: 8 }}>MEDICINE BASKET</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: 12, borderRadius: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{item.product.name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{item.product.sku}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>Rs. {(item.quantity * item.pricePerUnit).toLocaleString()}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>{item.quantity} units × Rs. {item.pricePerUnit.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing Summary */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748B' }}>
                    <span>Gross cost:</span>
                    <span>Rs. {selectedOrder.totalAmount.toLocaleString()}</span>
                  </div>
                  {selectedOrder.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#EF4444' }}>
                      <span>Loyalty Discount:</span>
                      <span>-Rs. {selectedOrder.discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, color: '#1E293B', marginTop: 4 }}>
                    <span>Net Cost:</span>
                    <span>Rs. {selectedOrder.netAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '18px 28px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 12, background: '#F8FAFC' }}>
                <button onClick={() => setSelectedOrder(null)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Close
                </button>
                <button onClick={() => { setPrintPreviewOrder(selectedOrder); setSelectedOrder(null); }} style={{ flex: 2, padding: 11, borderRadius: 10, border: 'none', background: '#F59E0B', color: '#FFFFFF', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Printer style={{ width: 14, height: 14 }} />
                  Show Print Preview
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Print Preview Modal ── */}
      {printPreviewOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 500, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#1E293B' }}>Voucher Print Preview</span>
              <button onClick={() => setPrintPreviewOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            
            {/* Styled Voucher Preview */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: '#F8FAFC' }}>
              <div style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: 20, fontFamily: 'monospace', color: '#000', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>MEDHUB PHARMACY NODE</div>
                <div style={{ textAlign: 'center', fontSize: 11, borderBottom: '1px dashed #000', paddingBottom: 10, marginBottom: 12 }}>B2B PURCHASE ORDER VOUCHER</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                  <div><strong>Order #:</strong> {printPreviewOrder.id.toUpperCase()}</div>
                  <div><strong>Date:</strong> {new Date(printPreviewOrder.createdAt).toLocaleString()}</div>
                  <div><strong>Supplier:</strong> {printPreviewOrder.wholesaler.companyName}</div>
                  <div><strong>Status:</strong> {printPreviewOrder.status}</div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                      <th style={{ textAlign: 'right', padding: '4px 0' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printPreviewOrder.items.map(item => (
                      <tr key={item.id}>
                        <td style={{ padding: '4px 0' }}>{item.product.name}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right', padding: '4px 0' }}>Rs. ${(item.quantity * item.pricePerUnit).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ textAlign: 'right', borderTop: '1px dashed #000', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div>Gross Total: Rs. {printPreviewOrder.totalAmount.toLocaleString()}</div>
                  {printPreviewOrder.discountAmount > 0 && <div style={{ color: 'red' }}>Discount: -Rs. {printPreviewOrder.discountAmount.toLocaleString()}</div>}
                  <div style={{ fontWeight: 'bold', fontSize: 13, marginTop: 4 }}>NET PAYABLE: Rs. {printPreviewOrder.netAmount.toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10, background: '#FFFFFF' }}>
              <button onClick={() => setPrintPreviewOrder(null)} style={{ flex: 1, padding: 11, borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Back
              </button>
              <button onClick={() => printOrderVoucher(printPreviewOrder)} style={{ flex: 2, padding: 11, borderRadius: 8, border: 'none', background: '#10B981', color: '#FFFFFF', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Printer style={{ width: 14, height: 14 }} />
                Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Confirm & Settle Package Intake Modal ── */}
      {intakeOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 650, background: '#FFFFFF', borderRadius: 24, border: '1.5px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            {/* Header */}
            <div style={{ padding: '20px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode style={{ width: 18, height: 18, color: '#F59E0B' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', margin: 0 }}>Confirm B2B Intake & Pricing</h3>
                  <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>Order ID: #{intakeOrder.id.toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => setIntakeOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Wholesaler info */}
              <div style={{ background: 'rgba(245,158,11,0.03)', border: '1px dashed rgba(245,158,11,0.3)', padding: 14, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>SUPPLIER WHOLESALER</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', marginTop: 2 }}>{intakeOrder.wholesaler?.companyName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700 }}>NET PAYABLE</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#F59E0B', marginTop: 2 }}>Rs. {intakeOrder.netAmount?.toLocaleString()}</div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 800, textTransform: 'uppercase', marginBottom: 10 }}>Configure Medicine Pricing (Per Box)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {intakeOrder.items.map((item: any) => {
                    const priceKey = item.productId;
                    const val = intakeCustomPrices[priceKey] || { buyingPrice: 0, sellingPrice: 0 };
                    return (
                      <div key={item.id} style={{ background: '#F8FAFC', border: '1.5px solid #F1F5F9', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ minWidth: 150 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>{item.product.name}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>Qty: {item.quantity} base units</div>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          {/* Buying price per box */}
                          <div>
                            <label style={{ fontSize: 9, fontWeight: 750, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Buying Price / Box</label>
                            <input
                              type="number"
                              value={val.buyingPrice}
                              onChange={(e) => setIntakeCustomPrices({
                                ...intakeCustomPrices,
                                [priceKey]: { ...val, buyingPrice: parseFloat(e.target.value) || 0 }
                              })}
                              style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #E2E8F0', fontSize: 12, outline: 'none' }}
                            />
                          </div>
                          {/* Selling price per box */}
                          <div>
                            <label style={{ fontSize: 9, fontWeight: 750, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Selling Price / Box</label>
                            <input
                              type="number"
                              value={val.sellingPrice}
                              onChange={(e) => setIntakeCustomPrices({
                                ...intakeCustomPrices,
                                [priceKey]: { ...val, sellingPrice: parseFloat(e.target.value) || 0 }
                              })}
                              style={{ width: 100, padding: '6px 10px', borderRadius: 6, border: '1.5px solid #E2E8F0', fontSize: 12, outline: 'none' }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Barcode Verification section */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
                <div style={{ background: '#FFFBEB', border: '1px solid #FEF3C7', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#D97706', textTransform: 'uppercase' }}>Scan/Enter Order Barcode to Verify Intake</label>
                  <input
                    type="text"
                    placeholder="Scan package barcode (e.g. ORD-XXXX)"
                    value={intakeBarcodeVerification}
                    onChange={(e) => setIntakeBarcodeVerification(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }}
                  />
                  {intakeBarcodeVerification.trim().toUpperCase() === `ORD-${intakeOrder.id.substring(0, 12).toUpperCase()}` ? (
                    <div style={{ fontSize: 12, color: '#10B981', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <CheckCircle style={{ width: 14, height: 14 }} /> Barcode verified successfully.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, marginTop: 4 }}>
                      Please enter the correct barcode (ORD-{intakeOrder.id.substring(0, 12).toUpperCase()}) to enable confirmation.
                    </div>
                  )}
                </div>
              </div>

              {/* Settlement section */}
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    id="settle-now-chk"
                    checked={intakeSettleNow}
                    onChange={(e) => setIntakeSettleNow(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#F59E0B' }}
                  />
                  <label htmlFor="settle-now-chk" style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', cursor: 'pointer' }}>
                    Settle Payment Immediately on Delivery
                  </label>
                </div>

                {intakeSettleNow && (
                  <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 750, color: '#475569', display: 'block', marginBottom: 6 }}>Settle Amount (Rs.)</label>
                      <input
                        type="number"
                        value={intakeSettleAmount}
                        onChange={(e) => setIntakeSettleAmount(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13, outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 750, color: '#475569', display: 'block', marginBottom: 6 }}>Method</label>
                      <select
                        value={intakeSettleMethod}
                        onChange={(e) => setIntakeSettleMethod(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13, outline: 'none', background: '#FFFFFF' }}
                      >
                        <option value="CASH">Cash</option>
                        <option value="COD">Cash on Delivery (COD)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 12 }}>
              <button onClick={() => setIntakeOrder(null)} style={{ flex: 1, padding: 11, borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmIntakeSubmit}
                disabled={barcodeLoading || intakeBarcodeVerification.trim().toUpperCase() !== `ORD-${intakeOrder.id.substring(0, 12).toUpperCase()}`}
                style={{ flex: 2, padding: 11, borderRadius: 8, border: 'none', background: intakeBarcodeVerification.trim().toUpperCase() === `ORD-${intakeOrder.id.substring(0, 12).toUpperCase()}` ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#CBD5E1', color: '#FFFFFF', fontSize: 13, fontWeight: 800, cursor: intakeBarcodeVerification.trim().toUpperCase() === `ORD-${intakeOrder.id.substring(0, 12).toUpperCase()}` ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {barcodeLoading ? 'Confirming...' : 'Confirm Delivery & Ingest'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
