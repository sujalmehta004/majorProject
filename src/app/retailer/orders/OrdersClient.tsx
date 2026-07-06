'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Truck, Search, QrCode, AlertCircle, CheckCircle,
  Package, Eye, ShoppingBag, Trash2, Printer, X,
  ChevronRight, Calendar, Building, Hash, Phone,
  FileText, Layers, RefreshCw, Square, CheckSquare,
  Clock, AlertTriangle, DollarSign, LayoutList, List
} from 'lucide-react';
import { confirmB2BDeliveryAction } from '@/app/actions/retailerActions';
import { updateConsumerOrderStatusAction, saveDeliveryFeeSettingsAction, getDeliveryFeeSettingsAction } from '@/app/actions/consumerActions';
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
  initialConsumerOrders: any[];
}

const STATUS_META: Record<string, { color: string; bg: string; icon: any }> = {
  PENDING: { color: '#F59E0B', bg: '#FFFBEB', icon: AlertCircle },
  PICKING: { color: '#3B82F6', bg: '#EFF6FF', icon: Layers },
  DISPATCHED: { color: '#8B5CF6', bg: '#F5F3FF', icon: Truck },
  DELIVERED: { color: '#10B981', bg: '#F0FDF4', icon: CheckCircle },
  RETURNED: { color: '#EF4444', bg: '#FEF2F2', icon: X },
  SHIPPED: { color: '#8B5CF6', bg: '#F5F3FF', icon: Truck },
  FAILED: { color: '#EF4444', bg: '#FEF2F2', icon: X },
};

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

export default function OrdersClient({ initialOrders, wholesalers, profileId, initialConsumerOrders }: OrdersClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'tracker' | 'order' | 'intake' | 'online'>('tracker');
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [consumerOrders, setConsumerOrders] = useState<any[]>(initialConsumerOrders || []);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Detailed View Toggle state
  const [detailedViewB2B, setDetailedViewB2B] = useState(false);
  const [detailedViewB2C, setDetailedViewB2C] = useState(false);

  // Intake Scanner
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState({ text: '', isError: false });
  const [intakeBarcodeVerification, setIntakeBarcodeVerification] = useState('');

  // Delivery Fee Settings
  const [deliveryTiers, setDeliveryTiers] = useState<{ maxKm: number; fee: number }[]>([]);
  const [deliverySettingsSaving, setDeliverySettingsSaving] = useState(false);
  const [deliverySettingsMsg, setDeliverySettingsMsg] = useState({ text: '', isError: false });
  const [deliverySettingsLoaded, setDeliverySettingsLoaded] = useState(false);

  // New B2B Order Placement
  const [selectedWholesalerId, setSelectedWholesalerId] = useState('');
  const [cart, setCart] = useState<{ productId: string; name: string; qtyBoxes: number; pricePerBox: number; availableBoxes: number }[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState({ text: '', isError: false });
  const [needsOverride, setNeedsOverride] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState('');

  // Modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedB2COrder, setSelectedB2COrder] = useState<any | null>(null);
  const [printPreviewOrder, setPrintPreviewOrder] = useState<Order | null>(null);
  const [intakeOrder, setIntakeOrder] = useState<any>(null);
  const [intakeCustomPrices, setIntakeCustomPrices] = useState<Record<string, { buyingPrice: number; sellingPrice: number }>>({});
  const [intakeSettleNow, setIntakeSettleNow] = useState(false);
  const [intakeSettleAmount, setIntakeSettleAmount] = useState('');
  const [intakeSettleMethod, setIntakeSettleMethod] = useState('CASH');

  const selectedWholesaler = wholesalers.find(w => w.id === selectedWholesalerId);

  useRealtimeEvent('ORDER_UPDATE', () => { fetchOrders(); });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const es = new EventSource(`/api/events?retailerId=${profileId}`);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.type === 'ORDER_UPDATE' || parsed.type === 'CONSUMER_ORDER_UPDATE') {
          fetchOrders();
        }
      } catch (err) {}
    };
    return () => { es.close(); };
  }, [profileId]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/retailer/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        if (data.consumerOrders) setConsumerOrders(data.consumerOrders);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setActiveTab('order');
    }
  }, [searchParams]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') { e.preventDefault(); setActiveTab('tracker'); }
      if (e.key === 'F9') { e.preventDefault(); setActiveTab('order'); }
      if (e.key === 'F10') { e.preventDefault(); setActiveTab('intake'); }
      if (e.key === 'Escape') {
        setSelectedOrder(null);
        setSelectedB2COrder(null);
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
        sellingPrice: Math.round(wholesalerPricePerBox * 1.25),
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
      setBarcodeMessage({ text: `No matched order found: ${barcodeInput}`, isError: true });
      return;
    }
    if (matched.status !== 'DISPATCHED') {
      setBarcodeMessage({ text: `Order status is ${matched.status}. Requires DISPATCHED state to verify intake.`, isError: true });
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
        intakeSettleNow ? parseFloat(intakeSettleAmount) || 0 : 0,
        intakeSettleNow ? intakeSettleMethod : 'CASH'
      );
      if (res.success) {
        setIntakeOrder(null);
        setBarcodeInput('');
        setBarcodeMessage({ text: 'Order intake successfully verified & added to inventory stock.', isError: false });
        broadcastUpdate('INVENTORY_UPDATE');
        fetchOrders();
      }
    } catch (err: any) {
      alert(err.message || 'Intake failed');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !selectedWholesalerId) return;
    try {
      setPlacingOrder(true);
      setOrderMessage({ text: '', isError: false });
      const payload = {
        wholesalerId: selectedWholesalerId,
        items: cart.map(c => ({ productId: c.productId, qtyBoxes: c.qtyBoxes })),
        overrideJustification: needsOverride ? overrideMsg : undefined,
      };
      const res = await fetch('/api/retailer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsOverride) {
          setNeedsOverride(true);
          setOrderMessage({ text: data.error || 'Requires credit limit override note.', isError: true });
        } else {
          setOrderMessage({ text: data.error || 'Failed to place B2B order.', isError: true });
        }
        return;
      }
      if (data.success) {
        setCart([]);
        setSelectedWholesalerId('');
        setNeedsOverride(false);
        setOverrideMsg('');
        setOrderMessage({ text: 'B2B Purchase Order successfully submitted to supplier.', isError: false });
        fetchOrders();
      }
    } catch (err: any) {
      setOrderMessage({ text: 'Failed to place B2B order.', isError: true });
    } finally {
      setPlacingOrder(false);
    }
  };

  const addToCart = (product: Product, qtyVal: string) => {
    const qty = parseInt(qtyVal) || 0;
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.productId !== product.id));
      return;
    }
    const tpb = product.tabletsPerStrip * product.stripsPerBox;
    const totalUnits = product.batches.reduce((sum, b) => sum + b.availableBaseUnits, 0);
    const availableBoxes = Math.floor(totalUnits / tpb);
    if (qty > availableBoxes) {
      alert(`Cannot exceed available wholesaler stock (${availableBoxes} boxes)`);
      return;
    }
    const price = product.batches[0]?.sellingPricePerBox || 100;
    const item = {
      productId: product.id,
      name: product.name,
      qtyBoxes: qty,
      pricePerBox: price,
      availableBoxes,
    };
    setCart(prev => {
      const idx = prev.findIndex(c => c.productId === product.id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [...prev, item];
    });
  };

  const handleBulkConfirmDelivery = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`Process delivery confirmation for ${selectedOrderIds.length} selected orders? (Defaults B2B purchase prices to stock)`)) return;
    try {
      setBarcodeLoading(true);
      for (const orderId of selectedOrderIds) {
        const orderObj = orders.find(o => o.id === orderId);
        if (!orderObj) continue;
        const customPricesPayload = orderObj.items.map((item: any) => {
          const wholesalerPricePerBox = item.pricePerUnit * (item.product.tabletsPerStrip * item.product.stripsPerBox);
          return {
            productId: item.productId || (item as any).productId,
            buyingPrice: wholesalerPricePerBox,
            sellingPrice: Math.round(wholesalerPricePerBox * 1.25),
          };
        });
        await confirmB2BDeliveryAction(
          orderId,
          customPricesPayload,
          false,
          0,
          'CASH'
        );
      }
      setSelectedOrderIds([]);
      setBarcodeMessage({ text: `Bulk confirmed ${selectedOrderIds.length} orders successfully.`, isError: false });
      broadcastUpdate('INVENTORY_UPDATE');
      fetchOrders();
    } catch (e: any) {
      alert(e.message || 'Bulk confirmation failed');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleUpdateOnlineStatus = async (orderId: string, status: string) => {
    try {
      const res = await updateConsumerOrderStatusAction(orderId, status);
      if (res.success) {
        fetchOrders();
        broadcastUpdate('CONSUMER_ORDER_UPDATE');
      }
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    }
  };

  const handleSaveDeliverySettings = async () => {
    try {
      setDeliverySettingsSaving(true);
      setDeliverySettingsMsg({ text: '', isError: false });
      const res = await saveDeliveryFeeSettingsAction(profileId, JSON.stringify(deliveryTiers));
      if (res.success) {
        setDeliverySettingsMsg({ text: 'Delivery fee tier configurations updated.', isError: false });
      } else {
        setDeliverySettingsMsg({ text: 'Failed to save settings.', isError: true });
      }
    } catch (e: any) {
      setDeliverySettingsMsg({ text: e.message || 'Save failed', isError: true });
    } finally {
      setDeliverySettingsSaving(false);
    }
  };

  const toggleSelectOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === filtered.length) setSelectedOrderIds([]);
    else setSelectedOrderIds(filtered.map(o => o.id));
  };

  const filtered = orders.filter((o) => {
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchesSearch = o.id.toLowerCase().includes(filterSearch.toLowerCase()) || o.wholesaler.companyName.toLowerCase().includes(filterSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredConsumer = consumerOrders.filter((o) => {
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchesSearch =
      o.trackingCode.toLowerCase().includes(filterSearch.toLowerCase()) ||
      o.buyerName.toLowerCase().includes(filterSearch.toLowerCase()) ||
      o.buyerPhone.toLowerCase().includes(filterSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.qtyBoxes * item.pricePerBox, 0);

  const printOrderVoucher = (order: Order) => {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    const itemRows = order.items.map(item =>
      `<tr><td>${item.product.name}</td><td>${item.product.sku}</td><td style="text-align:right">${item.quantity} units</td><td style="text-align:right">Rs. ${item.pricePerUnit}</td><td style="text-align:right">Rs. ${(item.quantity * item.pricePerUnit).toLocaleString()}</td></tr>`
    ).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>B2B Voucher</title><style>body{font-family:monospace;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid #ddd;font-size:12px;text-align:left}.right{text-align:right}</style></head><body><h2>MEDHUB PURCHASE ORDER</h2><div>Order ID: ${order.id}</div><div>Date: ${new Date(order.createdAt).toLocaleString()}</div><div>Supplier: ${order.wholesaler.companyName}</div><table><thead><tr><th>Item</th><th>SKU</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Total</th></tr></thead><tbody>${itemRows}</tbody></table><h4>Net Payable: Rs. ${order.netAmount.toLocaleString()}</h4><script>window.onload=function(){window.print();window.close();}<\/script></body></html>`);
    win.document.close();
    setPrintPreviewOrder(null);
  };

  const Modal = ({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 580, background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
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
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Purchase &amp; Delivery Panel</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>B2B procurement pipeline · Keyboard: F8 Tracker · F9 Order · F10 Scan Intake</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['tracker', 'order', 'intake', 'online'] as const).map(tab => (
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
              {tab === 'tracker' ? 'My B2B Orders' : tab === 'order' ? 'Create Order' : tab === 'intake' ? 'Scan Intake' : 'Online Sales'}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: Tracker */}
      {activeTab === 'tracker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--table-header-bg)', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <Search style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Search order ID or wholesaler…" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--text-primary)' }} />
            </div>

            {/* Detailed View Toggle */}
            <button
              onClick={() => setDetailedViewB2B(!detailedViewB2B)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <LayoutList style={{ width: 14, height: 14 }} />
              {detailedViewB2B ? 'Simple View' : 'Detailed View'}
            </button>

            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, outline: 'none', background: 'var(--table-header-bg)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              <option value="all">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="PICKING">PICKING</option>
              <option value="DISPATCHED">DISPATCHED</option>
              <option value="DELIVERED">DELIVERED</option>
            </select>
            {selectedOrderIds.length > 0 && (
              <button onClick={handleBulkConfirmDelivery} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#10B981', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <CheckCircle style={{ width: 14, height: 14 }} /> Bulk Intake ({selectedOrderIds.length})
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{filtered.length} matches</span>
          </div>

          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <Truck style={{ width: 40, height: 40, color: '#E2E8F0' }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>No B2B orders found</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>
                      <button onClick={toggleSelectAll} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                        {selectedOrderIds.length === filtered.length ? <CheckSquare style={{ width: 15, height: 15, color: '#F59E0B' }} /> : <Square style={{ width: 15, height: 15, color: '#CBD5E1' }} />}
                      </button>
                    </th>
                    <th style={thStyle}>Order ID</th>
                    <th style={thStyle}>Wholesaler</th>
                    {detailedViewB2B && <th style={thStyle}>Items List</th>}
                    <th style={thStyle}>Items Count</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Date</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => {
                    const sm = STATUS_META[order.status] || { color: 'var(--text-secondary)', bg: 'var(--table-header-bg)', icon: AlertCircle };
                    const StatusIcon = sm.icon;
                    const isSelected = selectedOrderIds.includes(order.id);
                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        style={{ borderBottom: '1px solid var(--card-border)', background: isSelected ? 'var(--table-header-bg)' : '', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--table-header-bg)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? 'var(--table-header-bg)' : '')}
                      >
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => toggleSelectOrder(order.id, e)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                            {isSelected ? <CheckSquare style={{ width: 15, height: 15, color: '#F59E0B' }} /> : <Square style={{ width: 15, height: 15, color: '#CBD5E1' }} />}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>#{order.id.substring(0, 8).toUpperCase()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.wholesaler.companyName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{order.wholesaler.phone}</div>
                        </td>
                        {detailedViewB2B && (
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {order.items.map(item => `${item.product.name} (x${item.quantity})`).join(', ')}
                          </td>
                        )}
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{order.items.length} items</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>Rs. {order.netAmount.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg }}>
                            <StatusIcon style={{ width: 11, height: 11 }} /> {order.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            {order.status === 'DISPATCHED' && (
                              <button onClick={() => openIntakeModalForOrder(order)} style={{ padding: '4px 10px', background: '#F59E0B', border: 'none', borderRadius: 6, color: '#FFFFFF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                Intake
                              </button>
                            )}
                            <button onClick={() => setSelectedOrder(order)} style={{ padding: '5px', background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}>
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

      {/* TAB 2: Place B2B Order */}
      {activeTab === 'order' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Wholesaler selector list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Select Wholesaler</div>
            {wholesalers.map((w) => (
              <button
                key={w.id}
                onClick={() => { setSelectedWholesalerId(w.id); setCart([]); }}
                style={{
                  width: '100%', padding: 12, borderRadius: 8, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                  background: selectedWholesalerId === w.id ? '#FFFBEB' : 'var(--card-bg)',
                  border: selectedWholesalerId === w.id ? '1px solid #F59E0B' : '1px solid var(--card-border)'
                }}
              >
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{w.companyName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{w.address}</div>
              </button>
            ))}
          </div>

          {/* Catalog grid */}
          <div>
            {!selectedWholesaler ? (
              <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', padding: '60px 20px', textAlign: 'center' }}>
                <Building style={{ width: 40, height: 40, color: '#E2E8F0', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No Wholesaler Selected</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Select a wholesaler on the left panel to browse stock catalog</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Cart info */}
                {cart.length > 0 && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px 16px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{cart.length} item(s) selected</div>
                      <div style={{ fontSize: 12, color: '#B45309' }}>Estimated Total: Rs. {cartTotal.toLocaleString()}</div>
                    </div>
                    <form onSubmit={handlePlaceOrder} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {needsOverride && <input type="text" required placeholder="Limit override note..." value={overrideMsg} onChange={(e) => setOverrideMsg(e.target.value)} style={{ ...inputStyle, width: 180 }} />}
                      <button type="submit" disabled={placingOrder} style={{ padding: '8px 16px', background: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        {placingOrder ? 'Submitting…' : 'Submit B2B Order'}
                      </button>
                    </form>
                  </div>
                )}

                {orderMessage.text && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: orderMessage.isError ? '#FEF2F2' : '#F0FDF4', color: orderMessage.isError ? '#EF4444' : '#10B981', border: `1px solid ${orderMessage.isError ? '#FECACA' : '#BBF7D0'}` }}>
                    {orderMessage.text}
                  </div>
                )}

                {/* Stock Table */}
                <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                        <th style={thStyle}>Medicine Name</th>
                        <th style={thStyle}>Category</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Stock (Boxes)</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Price/Box</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: 100 }}>Order Qty</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: 90 }}>Action</th>
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
                          <tr key={prod.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                            <td style={{ padding: '10px 16px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{prod.sku}</div>
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', fontSize: 11, color: 'var(--text-secondary)' }}>{prod.category}</span>
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>{totalBoxes} boxes</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#F59E0B', fontFamily: 'monospace' }}>Rs. {price}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <input id={`qty-${prod.id}`} type="number" min="1" max={totalBoxes} placeholder="0" defaultValue={cartItem ? String(cartItem.qtyBoxes) : ''} style={{ ...inputStyle, textAlign: 'center', width: 80, padding: 5 }} />
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <button onClick={() => addToCart(prod, (document.getElementById(`qty-${prod.id}`) as HTMLInputElement)?.value || '0')} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: cartItem ? '#10B981' : '#F59E0B', color: '#FFFFFF', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                {cartItem ? 'Added' : 'Add'}
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

      {/* TAB 3: Barcode Intake Scanner */}
      {activeTab === 'intake' && (
        <div style={{ maxWidth: 480, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 24, margin: '20px auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <QrCode style={{ width: 20, height: 20, color: '#F59E0B' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Confirm Package Intake</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '18px', margin: '0 0 16px' }}>Scan or type the package barcode (e.g. ORD-XXXX) to verify dispatch details and auto-import batch records.</p>
          <form onSubmit={handleBarcodeIntake} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="text" required placeholder="Scan order barcode…" value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} style={inputStyle} />
            <button type="submit" disabled={barcodeLoading} style={{ padding: '10px', background: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Verify Package Barcode</button>
          </form>
          {barcodeMessage.text && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: barcodeMessage.isError ? '#FEF2F2' : '#F0FDF4', color: barcodeMessage.isError ? '#EF4444' : '#10B981', border: `1px solid ${barcodeMessage.isError ? '#FECACA' : '#BBF7D0'}` }}>
              {barcodeMessage.text}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Consumer Sales */}
      {activeTab === 'online' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setDeliverySettingsLoaded(!deliverySettingsLoaded)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign style={{ width: 16, height: 16, color: '#10B981' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Delivery Fee Tiers Configuration</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{deliverySettingsLoaded ? '▲ Collapse' : '▼ Expand'}</span>
            </div>
            {deliverySettingsLoaded && (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '10px 14px', borderRadius: 8, fontSize: 12, color: '#1E40AF', lineHeight: '16px' }}>
                  ℹ️ Define radius-based shipping fees. Customers located up to the specified distance (km) will be charged the associated rate (Rs). Transactions beyond the maximum defined tier inherit the final tier rate.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {deliveryTiers.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--card-border)', borderRadius: 8 }}>
                      No delivery tiers defined. Add a tier to charge shipping fees.
                    </div>
                  ) : (
                    deliveryTiers.map((tier, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--table-header-bg)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Up to</span>
                          <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flex: 1 }}>
                            <input type="number" min="0.1" step="0.5" value={tier.maxKm} onChange={e => { const u = [...deliveryTiers]; u[idx] = { ...u[idx], maxKm: parseFloat(e.target.value) || 0 }; setDeliveryTiers(u); }} style={{ ...inputStyle, paddingRight: 36 }} />
                            <span style={{ position: 'absolute', right: 10, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>km</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Charge</span>
                          <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flex: 1 }}>
                            <span style={{ position: 'absolute', left: 10, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Rs.</span>
                            <input type="number" min="0" value={tier.fee} onChange={e => { const u = [...deliveryTiers]; u[idx] = { ...u[idx], fee: parseFloat(e.target.value) || 0 }; setDeliveryTiers(u); }} style={{ ...inputStyle, paddingLeft: 32 }} />
                          </div>
                        </div>

                        <button type="button" onClick={() => setDeliveryTiers(prev => prev.filter((_, i) => i !== idx))} style={{ padding: '8px', border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center' }} title="Delete tier">
                          <Trash2 style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--card-border)', paddingTop: 14 }}>
                  <button type="button" onClick={() => setDeliveryTiers([...deliveryTiers, { maxKm: 5, fee: 50 }])} style={{ padding: '8px 14px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Add Fee Tier</button>
                  <button type="button" onClick={handleSaveDeliverySettings} disabled={deliverySettingsSaving} style={{ padding: '8px 16px', border: 'none', background: '#10B981', color: '#FFFFFF', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>{deliverySettingsSaving ? 'Saving…' : 'Save Configuration'}</button>
                </div>
                {deliverySettingsMsg.text && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: deliverySettingsMsg.isError ? '#EF4444' : '#10B981', marginTop: 4 }}>
                    {deliverySettingsMsg.isError ? '❌' : '✅'} {deliverySettingsMsg.text}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Online table list filter header with Detailed view toggle */}
          <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--text-secondary)' }}>Online Orders Registry</span>
            <button
              onClick={() => setDetailedViewB2C(!detailedViewB2C)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}
            >
              <LayoutList style={{ width: 14, height: 14 }} />
              {detailedViewB2C ? 'Simple View' : 'Detailed View'}
            </button>
          </div>

          {/* Online table list */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={thStyle}>Tracking ID</th>
                  <th style={thStyle}>Patient Name</th>
                  {detailedViewB2C && <th style={thStyle}>Medicines List</th>}
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>Delivery Address</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredConsumer.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedB2COrder(o)}
                    style={{ borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--table-header-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{o.trackingCode}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{o.buyerName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.buyerPhone}</div>
                    </td>
                    {detailedViewB2C && (
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.items?.map((item: any) => `${item.product?.name || 'Medicine'} (x${item.quantity})`).join(', ') || '—'}
                      </td>
                    )}
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>Rs. {o.totalAmount}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{o.deliveryAddress || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: o.status === 'DELIVERED' ? '#F0FDF4' : o.status === 'PENDING' ? '#FFFBEB' : '#EFF6FF', color: o.status === 'DELIVERED' ? '#10B981' : o.status === 'PENDING' ? '#D97706' : '#3B82F6' }}>{o.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <select value={o.status} onChange={(e) => handleUpdateOnlineStatus(o.id, e.target.value)} style={{ padding: 4, borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 12 }}>
                        <option value="PENDING">PENDING</option>
                        <option value="SHIPPED">SHIPPED</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="FAILED">FAILED</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Order Detail Modal ── */}
      {selectedOrder && (
        <Modal onClose={() => setSelectedOrder(null)} title={`Purchase Order Details`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Supplier Node</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{selectedOrder.wholesaler.companyName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedOrder.wholesaler.phone}</div>
              </div>
              <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Date Placed</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{new Date(selectedOrder.createdAt).toLocaleDateString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(selectedOrder.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>

            <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Voucher Item List</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedOrder.items.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--card-border)' }}>
                    <span>{item.product.name} (×{item.quantity})</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>Rs. {(item.quantity * item.pricePerUnit).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--card-border)' }}>
                <span>Gross Payable</span>
                <span style={{ color: '#F59E0B', fontFamily: 'monospace' }}>Rs. {selectedOrder.netAmount.toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => printOrderVoucher(selectedOrder)} style={{ padding: '10px', background: '#F59E0B', border: 'none', borderRadius: 8, color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Printer style={{ width: 14, height: 14 }} /> Print Order Invoice
            </button>
          </div>
        </Modal>
      )}

      {/* ── B2C Online Sales Order Detail Modal ── */}
      {selectedB2COrder && (
        <Modal onClose={() => setSelectedB2COrder(null)} title={`B2C Online Order Details`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Patient Details</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{selectedB2COrder.buyerName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedB2COrder.buyerPhone}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedB2COrder.buyerEmail}</div>
              </div>
              <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Delivery Details</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, color: 'var(--text-secondary)' }}>{selectedB2COrder.deliveryAddress || '— No address provided'}</div>
              </div>
            </div>

            <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Itemized Sales List</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedB2COrder.items?.map((item: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--card-border)' }}>
                    <span>{item.product?.name || 'Medicine'} (×{item.quantity})</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>Rs. {(item.quantity * item.pricePerUnit).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--card-border)' }}>
                <span>Order Grand Total</span>
                <span style={{ color: '#10B981', fontFamily: 'monospace' }}>Rs. {selectedB2COrder.totalAmount.toLocaleString()}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 10 }}>
              <select
                value={selectedB2COrder.status}
                onChange={(e) => { handleUpdateOnlineStatus(selectedB2COrder.id, e.target.value); setSelectedB2COrder(null); }}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13 }}
              >
                <option value="PENDING">PENDING</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="FAILED">FAILED</option>
              </select>
              <button onClick={() => setSelectedB2COrder(null)} style={{ flex: 1, padding: '10px', background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Intake Modal ── */}
      {intakeOrder && (
        <Modal onClose={() => setIntakeOrder(null)} title={`Receive B2B Package`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Set purchasing price and selling values below for each medicine:</div>
            {intakeOrder.items.map((item: any) => {
              const priceKey = item.productId || (item as any).productId;
              const val = intakeCustomPrices[priceKey] || { buyingPrice: 0, sellingPrice: 0 };
              return (
                <div key={item.id} style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{item.product.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Buying/Box</label>
                      <input type="number" value={val.buyingPrice} onChange={e => setIntakeCustomPrices({ ...intakeCustomPrices, [priceKey]: { ...val, buyingPrice: parseFloat(e.target.value) || 0 } })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Selling/Box</label>
                      <input type="number" value={val.sellingPrice} onChange={e => setIntakeCustomPrices({ ...intakeCustomPrices, [priceKey]: { ...val, sellingPrice: parseFloat(e.target.value) || 0 } })} style={inputStyle} />
                    </div>
                  </div>
                </div>
              );
            })}

            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: 12, borderRadius: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#92400E', display: 'block', marginBottom: 4 }}>Verify Order Barcode</label>
              <input type="text" placeholder={`Type: ORD-${intakeOrder.id.substring(0, 12).toUpperCase()}`} value={intakeBarcodeVerification} onChange={e => setIntakeBarcodeVerification(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setIntakeOrder(null)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConfirmIntakeSubmit} disabled={intakeBarcodeVerification.trim().toUpperCase() !== `ORD-${intakeOrder.id.substring(0, 12).toUpperCase()}`} style={{ flex: 2, padding: 10, borderRadius: 8, border: 'none', background: '#10B981', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Confirm delivery &amp; ingest</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
