'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Truck, Search, QrCode, CheckCircle,
  Eye, Trash2, Printer, X,
  Building, Square, CheckSquare,
  DollarSign, ChevronDown,
  History, Store, Activity, Plus,
} from 'lucide-react';
import { confirmB2BDeliveryAction } from '@/app/actions/retailerActions';
import { updateConsumerOrderStatusAction, saveDeliveryFeeSettingsAction } from '@/app/actions/consumerActions';
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
  product: { name: string; sku: string; category: string };
}

interface Order {
  id: string;
  wholesaler: { companyName: string; phone: string; address: string };
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

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  PENDING:    { color: '#D97706', bg: '#FFFBEB', label: 'Pending' },
  PICKING:    { color: '#2563EB', bg: '#EFF6FF', label: 'Picking' },
  DISPATCHED: { color: '#7C3AED', bg: '#F5F3FF', label: 'Dispatched' },
  DELIVERED:  { color: '#059669', bg: '#F0FDF4', label: 'Delivered' },
  RETURNED:   { color: '#DC2626', bg: '#FEF2F2', label: 'Returned' },
  SHIPPED:    { color: '#7C3AED', bg: '#F5F3FF', label: 'Shipped' },
  FAILED:     { color: '#DC2626', bg: '#FEF2F2', label: 'Failed' },
};

const ACTIVE_STATUSES = new Set(['PENDING', 'PICKING', 'DISPATCHED']);
const COMPLETED_STATUSES = new Set(['DELIVERED', 'RETURNED', 'FAILED']);

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 6,
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
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  textAlign: 'left' as const,
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { color: 'var(--text-muted)', bg: 'var(--table-header-bg)', label: status };
  return (
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: meta.color, background: meta.bg }}>
      {meta.label.toUpperCase()}
    </span>
  );
}

export default function OrdersClient({ initialOrders, wholesalers, profileId, initialConsumerOrders }: OrdersClientProps) {
  const searchParams = useSearchParams();

  const [mainTab, setMainTab] = useState<'status' | 'history'>('status');
  const [statusSubTab, setStatusSubTab] = useState<'b2b' | 'order' | 'intake' | 'online'>('b2b');

  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [consumerOrders, setConsumerOrders] = useState<any[]>(initialConsumerOrders || []);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState({ text: '', isError: false });
  const [intakeBarcodeVerification, setIntakeBarcodeVerification] = useState('');

  const [deliveryTiers, setDeliveryTiers] = useState<{ maxKm: number; fee: number }[]>([]);
  const [deliverySettingsSaving, setDeliverySettingsSaving] = useState(false);
  const [deliverySettingsMsg, setDeliverySettingsMsg] = useState({ text: '', isError: false });
  const [deliverySettingsLoaded, setDeliverySettingsLoaded] = useState(false);

  const [selectedWholesalerId, setSelectedWholesalerId] = useState('');
  const [cart, setCart] = useState<{ productId: string; name: string; qtyBoxes: number; pricePerBox: number; availableBoxes: number; batchId: string }[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<Record<string, string>>({});
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState({ text: '', isError: false });
  const [needsOverride, setNeedsOverride] = useState(false);
  const [overrideMsg, setOverrideMsg] = useState('');
  const [b2bSearchQuery, setB2bSearchQuery] = useState('');
  const [b2bSearchResults, setB2bSearchResults] = useState<{ product: Product; wholesaler: Wholesaler }[]>([]);
  const [b2bSearched, setB2bSearched] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedB2COrder, setSelectedB2COrder] = useState<any | null>(null);
  const [intakeOrder, setIntakeOrder] = useState<any>(null);
  const [intakeCustomPrices, setIntakeCustomPrices] = useState<Record<string, { buyingPrice: number; sellingPrice: number }>>({});
  const [intakeSettleNow, setIntakeSettleNow] = useState(false);
  const [intakeSettleAmount, setIntakeSettleAmount] = useState('');
  const [intakeSettleMethod, setIntakeSettleMethod] = useState('CASH');

  const selectedWholesaler = wholesalers.find(w => w.id === selectedWholesalerId);

  useEffect(() => {
    if (selectedWholesaler) {
      const initialBatches: Record<string, string> = {};
      selectedWholesaler.products.forEach(prod => {
        if (prod.batches && prod.batches.length > 0) {
          const sorted = [...prod.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
          const recommended = sorted.find(b => b.availableBaseUnits > 0) || sorted[0];
          initialBatches[prod.id] = recommended.id;
        }
      });
      setSelectedBatches(initialBatches);
    }
  }, [selectedWholesalerId, wholesalers, selectedWholesaler]);

  useRealtimeEvent('ORDER_UPDATE', () => { fetchOrders(); });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const es = new EventSource(`/api/events?retailerId=${profileId}`);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.type === 'ORDER_UPDATE' || parsed.type === 'CONSUMER_ORDER_UPDATE') fetchOrders();
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
    if (searchParams.get('new') === 'true') { setMainTab('status'); setStatusSubTab('order'); }
  }, [searchParams]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedOrder(null); setSelectedB2COrder(null); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const openIntakeModalForOrder = (order: any) => {
    const initialPrices: Record<string, { buyingPrice: number; sellingPrice: number }> = {};
    order.items.forEach((item: any) => {
      const p = item.pricePerUnit * (item.product.tabletsPerStrip * item.product.stripsPerBox);
      initialPrices[item.productId] = { buyingPrice: p, sellingPrice: Math.round(p * 1.25) };
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
    if (searchId.toUpperCase().startsWith('ORD-')) searchId = searchId.substring(4);
    const matched = orders.find(o =>
      o.id.toLowerCase() === searchId.toLowerCase() ||
      o.id.toLowerCase().startsWith(searchId.toLowerCase()) ||
      o.id.toLowerCase().includes(searchId.toLowerCase())
    );
    if (!matched) { setBarcodeMessage({ text: `No order found: ${barcodeInput}`, isError: true }); return; }
    if (matched.status !== 'DISPATCHED') { setBarcodeMessage({ text: `Order is ${matched.status}. Requires DISPATCHED status.`, isError: true }); return; }
    openIntakeModalForOrder(matched);
  };

  const handleConfirmIntakeSubmit = async () => {
    if (!intakeOrder) return;
    try {
      setBarcodeLoading(true);
      const payload = Object.entries(intakeCustomPrices).map(([productId, val]) => ({ productId, buyingPrice: val.buyingPrice, sellingPrice: val.sellingPrice }));
      const res = await confirmB2BDeliveryAction(intakeOrder.id, payload, intakeSettleNow, intakeSettleNow ? parseFloat(intakeSettleAmount) || 0 : 0, intakeSettleNow ? intakeSettleMethod : 'CASH');
      if (res.success) {
        setIntakeOrder(null);
        setBarcodeInput('');
        setBarcodeMessage({ text: 'Intake verified & stock updated.', isError: false });
        broadcastUpdate('INVENTORY_UPDATE');
        fetchOrders();
      }
    } catch (err: any) { alert(err.message || 'Intake failed'); }
    finally { setBarcodeLoading(false); }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !selectedWholesalerId) return;
    try {
      setPlacingOrder(true);
      setOrderMessage({ text: '', isError: false });
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailerId: profileId,
          wholesalerId: selectedWholesalerId,
          items: cart.map(c => ({ productId: c.productId, qtyBoxes: c.qtyBoxes, batchId: c.batchId })),
          overrideJustification: needsOverride ? overrideMsg : undefined
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'CREDIT_BLOCKED') {
          setNeedsOverride(true);
          setOrderMessage({ text: data.reason || 'Requires credit limit override note.', isError: true });
        } else {
          setOrderMessage({ text: data.error || 'Failed to place order.', isError: true });
        }
        return;
      }
      if (data.success) {
        setCart([]); setSelectedWholesalerId(''); setNeedsOverride(false); setOverrideMsg('');
        setOrderMessage({ text: 'B2B Purchase Order submitted to supplier.', isError: false });
        fetchOrders();
      }
    } catch (err: any) { setOrderMessage({ text: 'Failed to place order.', isError: true }); }
    finally { setPlacingOrder(false); }
  };

  const addToCart = (product: Product, qtyVal: string, batchId: string) => {
    const qty = parseInt(qtyVal) || 0;
    if (qty <= 0) { setCart(prev => prev.filter(c => !(c.productId === product.id && c.batchId === batchId))); return; }
    const tpb = product.tabletsPerStrip * product.stripsPerBox;
    const batch = product.batches.find(b => b.id === batchId);
    if (!batch) { alert('Selected batch not found'); return; }
    const availableBoxes = Math.floor(batch.availableBaseUnits / tpb);
    if (qty > availableBoxes) { alert(`Max available in batch: ${availableBoxes} boxes`); return; }
    const price = batch.sellingPricePerBox;
    const item = { productId: product.id, name: product.name, qtyBoxes: qty, pricePerBox: price, availableBoxes, batchId };
    setCart(prev => {
      const idx = prev.findIndex(c => c.productId === product.id && c.batchId === batchId);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [...prev, item];
    });
  };

  const handleB2bSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!b2bSearchQuery.trim()) {
      setB2bSearchResults([]);
      setB2bSearched(false);
      return;
    }
    const query = b2bSearchQuery.toLowerCase().trim();
    const results: { product: Product; wholesaler: Wholesaler }[] = [];
    wholesalers.forEach(w => {
      w.products.forEach(p => {
        if (p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)) {
          results.push({ product: p, wholesaler: w });
        }
      });
    });
    const batchMapCopy = { ...selectedBatches };
    results.forEach(({ product }) => {
      if (!batchMapCopy[product.id] && product.batches && product.batches.length > 0) {
        const sorted = [...product.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        const recommended = sorted.find(b => b.availableBaseUnits > 0) || sorted[0];
        if (recommended) {
          batchMapCopy[product.id] = recommended.id;
        }
      }
    });
    setSelectedBatches(batchMapCopy);
    setB2bSearchResults(results);
    setB2bSearched(true);
  };

  const handleBulkConfirmDelivery = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!confirm(`Confirm intake for ${selectedOrderIds.length} orders?`)) return;
    try {
      setBarcodeLoading(true);
      for (const orderId of selectedOrderIds) {
        const o = orders.find(x => x.id === orderId);
        if (!o) continue;
        const p = o.items.map((item: any) => {
          const pb = item.pricePerUnit * (item.product.tabletsPerStrip * item.product.stripsPerBox);
          return { productId: item.productId || (item as any).productId, buyingPrice: pb, sellingPrice: Math.round(pb * 1.25) };
        });
        await confirmB2BDeliveryAction(orderId, p, false, 0, 'CASH');
      }
      setSelectedOrderIds([]);
      setBarcodeMessage({ text: `Bulk confirmed ${selectedOrderIds.length} orders.`, isError: false });
      broadcastUpdate('INVENTORY_UPDATE');
      fetchOrders();
    } catch (e: any) { alert(e.message || 'Bulk confirmation failed'); }
    finally { setBarcodeLoading(false); }
  };

  const handleUpdateOnlineStatus = async (orderId: string, status: string) => {
    try {
      const res = await updateConsumerOrderStatusAction(orderId, status);
      if (res.success) { fetchOrders(); broadcastUpdate('CONSUMER_ORDER_UPDATE'); }
    } catch (err: any) { alert(err.message || 'Status update failed'); }
  };

  const handleSaveDeliverySettings = async () => {
    try {
      setDeliverySettingsSaving(true);
      setDeliverySettingsMsg({ text: '', isError: false });
      const res = await saveDeliveryFeeSettingsAction(profileId, JSON.stringify(deliveryTiers));
      if (res.success) setDeliverySettingsMsg({ text: 'Delivery fee tiers saved.', isError: false });
      else setDeliverySettingsMsg({ text: 'Failed to save.', isError: true });
    } catch (e: any) { setDeliverySettingsMsg({ text: e.message || 'Save failed', isError: true }); }
    finally { setDeliverySettingsSaving(false); }
  };

  const toggleSelectOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.has(o.status));
  const historyOrders = orders.filter(o => COMPLETED_STATUSES.has(o.status));

  const filteredActive = activeOrders.filter(o => {
    const matchSt = filterStatus === 'all' || o.status === filterStatus;
    const matchSr = o.id.toLowerCase().includes(filterSearch.toLowerCase()) || o.wholesaler.companyName.toLowerCase().includes(filterSearch.toLowerCase());
    return matchSt && matchSr;
  });

  const filteredHistory = historyOrders.filter(o => {
    const q = historySearch.toLowerCase();
    return o.id.toLowerCase().includes(q) || o.wholesaler.companyName.toLowerCase().includes(q);
  });

  const filteredConsumer = consumerOrders.filter(o => {
    const matchSt = filterStatus === 'all' || o.status === filterStatus;
    const matchSr = o.trackingCode.toLowerCase().includes(filterSearch.toLowerCase()) || o.buyerName.toLowerCase().includes(filterSearch.toLowerCase()) || o.buyerPhone.toLowerCase().includes(filterSearch.toLowerCase());
    return matchSt && matchSr;
  });

  const cartTotal = cart.reduce((s, i) => s + i.qtyBoxes * i.pricePerBox, 0);

  const printOrderVoucher = (order: Order) => {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    const rows = order.items.map(i => `<tr><td>${i.product.name}</td><td>${i.product.sku}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">Rs.${i.pricePerUnit}</td><td style="text-align:right">Rs.${(i.quantity * i.pricePerUnit).toLocaleString()}</td></tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Invoice</title><style>body{font-family:monospace;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid #ddd;font-size:12px}</style></head><body><h2>MEDHUB PURCHASE ORDER</h2><p>ID: ${order.id}</p><p>Date: ${new Date(order.createdAt).toLocaleString()}</p><p>Supplier: ${order.wholesaler.companyName}</p><table><thead><tr><th>Medicine</th><th>SKU</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><h4>Net Payable: Rs. ${order.netAmount.toLocaleString()}</h4><script>window.onload=function(){window.print();window.close();}<\/script></body></html>`);
    win.document.close();
  };

  const Modal = ({ children, onClose, title, maxWidth = 580 }: { children: React.ReactNode; onClose: () => void; title: string; maxWidth?: number }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth, background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );

  const subTabs = [
    { key: 'b2b' as const,    label: 'Active Orders', icon: <Activity style={{ width: 13, height: 13 }} /> },
    { key: 'order' as const,  label: 'New Order',     icon: <Plus style={{ width: 13, height: 13 }} /> },
    { key: 'intake' as const, label: 'Scan Intake',   icon: <QrCode style={{ width: 13, height: 13 }} /> },
    { key: 'online' as const, label: 'Online Sales',  icon: <Store style={{ width: 13, height: 13 }} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 'calc(100vh - 80px)' }}>

      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Purchase & Orders</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0 0' }}>Manage B2B procurement, track delivery status, and view order history</p>
      </div>

      {/* Main Tab Bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--card-border)', marginBottom: 24 }}>
        {([
          { key: 'status' as const,  label: 'Order Status & Procurement', icon: <Activity style={{ width: 14, height: 14 }} />, badge: activeOrders.length },
          { key: 'history' as const, label: 'Order History',              icon: <History style={{ width: 14, height: 14 }} />,  badge: historyOrders.length },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px', background: 'none', border: 'none', borderBottom: mainTab === tab.key ? '2px solid var(--text-primary)' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', fontSize: 13, fontWeight: mainTab === tab.key ? 700 : 500, color: mainTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
            {tab.icon}
            {tab.label}
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 10, background: mainTab === tab.key ? 'var(--text-primary)' : 'var(--card-border)', color: mainTab === tab.key ? 'var(--card-bg)' : 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>
              {tab.badge}
            </span>
          </button>
        ))}
      </div>

      {/* ── TAB: STATUS ── */}
      {mainTab === 'status' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Sub-tab pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {subTabs.map(t => (
              <button key={t.key} onClick={() => setStatusSubTab(t.key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, border: statusSubTab === t.key ? '1px solid var(--text-primary)' : '1px solid var(--card-border)', background: statusSubTab === t.key ? 'var(--text-primary)' : 'var(--card-bg)', color: statusSubTab === t.key ? 'var(--card-bg)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ACTIVE B2B ORDERS */}
          {statusSubTab === 'b2b' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                  <Search style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input type="text" placeholder="Search by order ID or wholesaler…" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--text-primary)' }} />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--card-border)', fontSize: 13, outline: 'none', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>
                  <option value="all">All Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="PICKING">Picking</option>
                  <option value="DISPATCHED">Dispatched</option>
                </select>
                {selectedOrderIds.length > 0 && (
                  <button onClick={handleBulkConfirmDelivery} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <CheckCircle style={{ width: 13, height: 13 }} /> Bulk Intake ({selectedOrderIds.length})
                  </button>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 'auto' }}>{filteredActive.length} order{filteredActive.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Status summary */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(['PENDING', 'PICKING', 'DISPATCHED'] as const).map(s => {
                  const cnt = orders.filter(o => o.status === s).length;
                  const meta = STATUS_META[s];
                  return (
                    <div key={s} style={{ flex: 1, minWidth: 110, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meta.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{cnt}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                {filteredActive.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <Truck style={{ width: 36, height: 36, color: 'var(--card-border)' }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No active orders</div>
                    <div style={{ fontSize: 13 }}>Place a new B2B order using the "New Order" tab</div>
                    <button onClick={() => setStatusSubTab('order')} style={{ marginTop: 6, padding: '8px 16px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>Go to New Order</button>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                        <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>
                          <button onClick={() => { if (selectedOrderIds.length === filteredActive.length) setSelectedOrderIds([]); else setSelectedOrderIds(filteredActive.map(o => o.id)); }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {selectedOrderIds.length === filteredActive.length && filteredActive.length > 0 ? <CheckSquare style={{ width: 14, height: 14, color: 'var(--text-primary)' }} /> : <Square style={{ width: 14, height: 14, color: 'var(--card-border)' }} />}
                          </button>
                        </th>
                        <th style={thStyle}>Order ID</th>
                        <th style={thStyle}>Wholesaler</th>
                        <th style={thStyle}>Items</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Date</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActive.map(order => {
                        const isSelected = selectedOrderIds.includes(order.id);
                        return (
                          <tr key={order.id} onClick={() => setSelectedOrder(order)} style={{ borderBottom: '1px solid var(--card-border)', background: isSelected ? 'var(--table-header-bg)' : '', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--table-header-bg)')} onMouseLeave={e => (e.currentTarget.style.background = isSelected ? 'var(--table-header-bg)' : '')}>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <button onClick={e => toggleSelectOrder(order.id, e)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected ? <CheckSquare style={{ width: 14, height: 14, color: 'var(--text-primary)' }} /> : <Square style={{ width: 14, height: 14, color: 'var(--card-border)' }} />}
                              </button>
                            </td>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>#{order.id.substring(0, 8).toUpperCase()}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.wholesaler.companyName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{order.wholesaler.phone}</div>
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', textAlign: 'right' }}>Rs.&nbsp;{order.netAmount.toLocaleString()}</td>
                            <td style={{ padding: '12px 16px' }}><StatusBadge status={order.status} /></td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12 }}>{new Date(order.createdAt).toLocaleDateString()}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                {order.status === 'DISPATCHED' && (
                                  <button onClick={() => openIntakeModalForOrder(order)} style={{ padding: '5px 10px', background: 'var(--text-primary)', border: 'none', borderRadius: 5, color: 'var(--card-bg)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Intake</button>
                                )}
                                <button onClick={() => setSelectedOrder(order)} style={{ padding: '5px 8px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
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

          {/* NEW B2B ORDER */}
          {statusSubTab === 'order' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
              
              {/* Medicine search panel */}
              <form onSubmit={handleB2bSearch} style={{ display: 'flex', gap: 8, background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: 14, borderRadius: 8, alignItems: 'center' }}>
                <Search style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search medicine name or SKU across all suppliers..."
                  value={b2bSearchQuery}
                  onChange={e => {
                    setB2bSearchQuery(e.target.value);
                    if (!e.target.value.trim()) {
                      setB2bSearchResults([]);
                      setB2bSearched(false);
                    }
                  }}
                  style={{ ...inputStyle, flex: 1, border: 'none', background: 'transparent' }}
                />
                {b2bSearched && (
                  <button type="button" onClick={() => { setB2bSearchQuery(''); setB2bSearchResults([]); setB2bSearched(false); }} style={{ padding: '6px 12px', border: 'none', background: 'none', color: '#EF4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
                )}
                <button type="submit" style={{ padding: '8px 18px', background: 'var(--text-primary)', color: 'var(--card-bg)', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Search</button>
              </form>

              {b2bSearched ? (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Matching Supplier Products ({b2bSearchResults.length} found)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                        <th style={thStyle}>Medicine</th>
                        <th style={thStyle}>Category</th>
                        <th style={thStyle}>Supplier</th>
                        <th style={thStyle}>Batch</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Stock (Boxes)</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Price / Box</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: 110 }}>Quantity</th>
                        <th style={{ ...thStyle, textAlign: 'center', width: 180 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b2bSearchResults.length === 0 ? (
                        <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No matching products found from any wholesalers.</td></tr>
                      ) : b2bSearchResults.map(({ product, wholesaler }) => {
                        const tpb = product.tabletsPerStrip * product.stripsPerBox;
                        const selectedBatchId = selectedBatches[product.id] || '';
                        const selectedBatch = product.batches.find(b => b.id === selectedBatchId);
                        const price = selectedBatch?.sellingPricePerBox || product.batches[0]?.sellingPricePerBox || 100;
                        const totalUnits = selectedBatch ? selectedBatch.availableBaseUnits : product.batches.reduce((s, b) => s + b.availableBaseUnits, 0);
                        const totalBoxes = Math.floor(totalUnits / tpb);
                        const cartItem = cart.find(c => c.productId === product.id && c.batchId === selectedBatchId);

                        const prices = Array.from(new Set(product.batches.map(b => b.sellingPricePerBox)));
                        const hasMultiplePrices = prices.length > 1;

                        return (
                          <tr key={`${product.id}-${wholesaler.id}`} style={{ borderBottom: '1px solid var(--card-border)', background: cartItem ? 'var(--table-header-bg)' : '' }}>
                            <td style={{ padding: '10px 16px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{product.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{product.sku}</div>
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <span style={{ padding: '2px 7px', borderRadius: 4, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', fontSize: 11, color: 'var(--text-secondary)' }}>{product.category}</span>
                            </td>
                            <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {wholesaler.companyName}
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              {product.batches.length > 0 ? (
                                <select
                                  value={selectedBatchId}
                                  onChange={e => setSelectedBatches({ ...selectedBatches, [product.id]: e.target.value })}
                                  style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, width: 'auto' }}
                                >
                                  {product.batches.map((b, idx) => (
                                    <option key={b.id} value={b.id}>
                                      {b.batchNumber} (Rs. {b.sellingPricePerBox}/box) {idx === 0 ? '⭐' : ''}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ color: '#DC2626', fontWeight: 600, fontSize: 12 }}>Out of Stock</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', color: totalBoxes === 0 ? '#DC2626' : 'var(--text-secondary)', fontWeight: 600 }}>{totalBoxes}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>Rs. {price}</div>
                              {hasMultiplePrices && (
                                <div style={{ fontSize: 10, color: '#D97706', marginTop: 2 }}>* prices vary by batch</div>
                              )}
                              {(() => {
                                try {
                                  const tiers = JSON.parse(product.tierPricingJson || '[]');
                                  if (tiers.length > 0) {
                                    return (
                                      <div style={{ fontSize: 10, color: '#2563EB', marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                                        <span style={{ fontWeight: 700 }}>Tiers:</span>
                                        {tiers.map((t: any, idx: number) => (
                                          <span key={idx} style={{ whiteSpace: 'nowrap' }}>
                                            {t.minQty}{t.maxQty ? `-${t.maxQty}` : '+'} boxes: Rs. {t.pricePerBox}
                                          </span>
                                        ))}
                                      </div>
                                    );
                                  }
                                } catch (e) {}
                                return null;
                              })()}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <input id={`search-qty-${product.id}-${selectedBatchId}`} type="number" min="1" max={totalBoxes} placeholder="0" defaultValue={cartItem ? String(cartItem.qtyBoxes) : ''} style={{ ...inputStyle, textAlign: 'center', width: 80, padding: '6px 8px' }} />
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  if (selectedWholesalerId !== wholesaler.id) {
                                    setSelectedWholesalerId(wholesaler.id);
                                    setCart([]);
                                  }
                                  const qty = (document.getElementById(`search-qty-${product.id}-${selectedBatchId}`) as HTMLInputElement)?.value || '0';
                                  addToCart(product, qty, selectedBatchId);
                                }}
                                style={{ padding: '6px 12px', borderRadius: 5, border: 'none', background: cartItem ? '#059669' : 'var(--text-primary)', color: 'var(--card-bg)', fontSize: 11, fontWeight: 700, cursor: 'pointer', width: '100%' }}
                              >
                                {selectedWholesalerId === wholesaler.id && cartItem ? 'Added' : 'Select Wholesaler & Add'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 18, alignItems: 'start', width: '100%' }}>
                  <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Select Supplier</div>
                    {wholesalers.map(w => (
                      <button key={w.id} onClick={() => { setSelectedWholesalerId(w.id); setCart([]); }} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, textAlign: 'left', cursor: 'pointer', background: 'var(--card-bg)', border: selectedWholesalerId === w.id ? '1px solid var(--text-primary)' : '1px solid var(--card-border)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{w.companyName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{w.address}</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {!selectedWholesaler ? (
                      <div style={{ background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--card-border)', padding: '64px 20px', textAlign: 'center' }}>
                        <Building style={{ width: 36, height: 36, color: 'var(--card-border)', margin: '0 auto 12px' }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Select a Supplier</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Choose a supplier on the left to browse their stock catalogue</div>
                      </div>
                    ) : (
                      <>
                        {cart.length > 0 && (
                          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '14px 18px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{cart.length} item{cart.length !== 1 ? 's' : ''} in cart</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Estimated total: Rs. {cartTotal.toLocaleString()}</div>
                            </div>
                            <form onSubmit={handlePlaceOrder} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              {needsOverride && <input type="text" required placeholder="Credit limit override note…" value={overrideMsg} onChange={e => setOverrideMsg(e.target.value)} style={{ ...inputStyle, width: 200 }} />}
                              <button type="submit" disabled={placingOrder} style={{ padding: '9px 18px', background: 'var(--text-primary)', color: 'var(--card-bg)', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                                {placingOrder ? 'Submitting…' : 'Submit Order'}
                              </button>
                            </form>
                          </div>
                        )}
                        {orderMessage.text && (
                          <div style={{ padding: '10px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: orderMessage.isError ? '#FEF2F2' : '#F0FDF4', color: orderMessage.isError ? '#DC2626' : '#059669', border: `1px solid ${orderMessage.isError ? '#FECACA' : '#BBF7D0'}` }}>
                            {orderMessage.text}
                          </div>
                        )}
                        <div style={{ background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedWholesaler.companyName} — Product Catalogue</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedWholesaler.products.length} products</span>
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                                <th style={thStyle}>Medicine</th>
                                <th style={thStyle}>Category</th>
                                <th style={thStyle}>Batch</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Stock (Boxes)</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Price / Box</th>
                                <th style={{ ...thStyle, textAlign: 'center', width: 110 }}>Quantity</th>
                                <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>Add</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedWholesaler.products.map(prod => {
                                const tpb = prod.tabletsPerStrip * prod.stripsPerBox;
                                
                                // Batch selection logic
                                const selectedBatchId = selectedBatches[prod.id] || '';
                                const selectedBatch = prod.batches.find(b => b.id === selectedBatchId);
                                const price = selectedBatch?.sellingPricePerBox || prod.batches[0]?.sellingPricePerBox || 100;
                                
                                const totalUnits = selectedBatch ? selectedBatch.availableBaseUnits : prod.batches.reduce((s, b) => s + b.availableBaseUnits, 0);
                                const totalBoxes = Math.floor(totalUnits / tpb);
                                
                                const cartItem = cart.find(c => c.productId === prod.id && c.batchId === selectedBatchId);
                                
                                // Check if different batches have different prices to show
                                const prices = Array.from(new Set(prod.batches.map(b => b.sellingPricePerBox)));
                                const hasMultiplePrices = prices.length > 1;

                                return (
                                  <tr key={prod.id} style={{ borderBottom: '1px solid var(--card-border)', background: cartItem ? 'var(--table-header-bg)' : '' }}>
                                    <td style={{ padding: '10px 16px' }}>
                                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name}</div>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{prod.sku}</div>
                                    </td>
                                    <td style={{ padding: '10px 16px' }}>
                                      <span style={{ padding: '2px 7px', borderRadius: 4, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', fontSize: 11, color: 'var(--text-secondary)' }}>{prod.category}</span>
                                    </td>
                                    <td style={{ padding: '10px 16px' }}>
                                      {prod.batches.length > 0 ? (
                                        <select
                                          value={selectedBatchId}
                                          onChange={e => {
                                            setSelectedBatches({ ...selectedBatches, [prod.id]: e.target.value });
                                          }}
                                          style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, width: 'auto' }}
                                        >
                                          {prod.batches.map((b, idx) => {
                                            const bBoxes = Math.floor(b.availableBaseUnits / tpb);
                                            return (
                                              <option key={b.id} value={b.id}>
                                                {b.batchNumber} (Rs. {b.sellingPricePerBox}/box) {idx === 0 ? '⭐' : ''}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      ) : (
                                        <span style={{ color: '#DC2626', fontWeight: 600, fontSize: 12 }}>Out of Stock</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right', color: totalBoxes === 0 ? '#DC2626' : 'var(--text-secondary)', fontWeight: 600 }}>{totalBoxes}</td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>Rs. {price}</div>
                                      {hasMultiplePrices && (
                                        <div style={{ fontSize: 10, color: '#D97706', marginTop: 2 }}>* prices vary by batch</div>
                                      )}
                                      {(() => {
                                        try {
                                          const tiers = JSON.parse(prod.tierPricingJson || '[]');
                                          if (tiers.length > 0) {
                                            return (
                                              <div style={{ fontSize: 10, color: '#2563EB', marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                                                <span style={{ fontWeight: 700 }}>Tiers:</span>
                                                {tiers.map((t: any, idx: number) => (
                                                  <span key={idx} style={{ whiteSpace: 'nowrap' }}>
                                                    {t.minQty}{t.maxQty ? `-${t.maxQty}` : '+'} boxes: Rs. {t.pricePerBox}
                                                  </span>
                                                ))}
                                              </div>
                                            );
                                          }
                                        } catch (e) {}
                                        return null;
                                      })()}
                                    </td>
                                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                      <input id={`qty-${prod.id}-${selectedBatchId}`} type="number" min="1" max={totalBoxes} placeholder="0" defaultValue={cartItem ? String(cartItem.qtyBoxes) : ''} style={{ ...inputStyle, textAlign: 'center', width: 80, padding: '6px 8px' }} />
                                    </td>
                                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                                      <button onClick={() => addToCart(prod, (document.getElementById(`qty-${prod.id}-${selectedBatchId}`) as HTMLInputElement)?.value || '0', selectedBatchId)} style={{ padding: '6px 12px', borderRadius: 5, border: 'none', background: cartItem ? '#059669' : 'var(--text-primary)', color: 'var(--card-bg)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                        {cartItem ? 'Added' : 'Add'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SCAN INTAKE */}
          {statusSubTab === 'intake' && (
            <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <QrCode style={{ width: 20, height: 20, color: 'var(--text-primary)' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Confirm Package Intake</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '20px', margin: '0 0 18px' }}>
                  Scan or enter the order barcode (e.g. <code>ORD-XXXX</code>) to verify dispatch and import batch records to inventory.
                </p>
                <form onSubmit={handleBarcodeIntake} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input type="text" required placeholder="Scan or type order barcode…" value={barcodeInput} onChange={e => setBarcodeInput(e.target.value)} style={inputStyle} />
                  <button type="submit" disabled={barcodeLoading} style={{ padding: '10px', background: 'var(--text-primary)', color: 'var(--card-bg)', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {barcodeLoading ? 'Verifying…' : 'Verify Barcode'}
                  </button>
                </form>
                {barcodeMessage.text && (
                  <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, background: barcodeMessage.isError ? '#FEF2F2' : '#F0FDF4', color: barcodeMessage.isError ? '#DC2626' : '#059669', border: `1px solid ${barcodeMessage.isError ? '#FECACA' : '#BBF7D0'}` }}>
                    {barcodeMessage.text}
                  </div>
                )}
              </div>
              {orders.filter(o => o.status === 'DISPATCHED').length > 0 && (
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Awaiting Intake ({orders.filter(o => o.status === 'DISPATCHED').length})
                  </div>
                  {orders.filter(o => o.status === 'DISPATCHED').map(order => (
                    <div key={order.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{order.wholesaler.companyName}</div>
                      </div>
                      <button onClick={() => openIntakeModalForOrder(order)} style={{ padding: '6px 12px', borderRadius: 5, border: 'none', background: 'var(--text-primary)', color: 'var(--card-bg)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Intake</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ONLINE SALES */}
          {statusSubTab === 'online' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                <button style={{ width: '100%', padding: '12px 16px', background: 'var(--table-header-bg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: 'none', textAlign: 'left', borderBottom: deliverySettingsLoaded ? '1px solid var(--card-border)' : 'none' }} onClick={() => setDeliverySettingsLoaded(!deliverySettingsLoaded)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DollarSign style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Delivery Fee Tiers</span>
                  </div>
                  <ChevronDown style={{ width: 14, height: 14, color: 'var(--text-muted)', transform: deliverySettingsLoaded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {deliverySettingsLoaded && (
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '10px 14px', borderRadius: 6, fontSize: 12, color: '#1E40AF' }}>
                      Define radius-based shipping fees. Orders beyond the last tier inherit the final tier's rate.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {deliveryTiers.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--card-border)', borderRadius: 6 }}>No tiers defined. Add a tier to configure shipping fees.</div>
                      ) : deliveryTiers.map((tier, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--table-header-bg)', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Up to</span>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <input type="number" min="0.1" step="0.5" value={tier.maxKm} onChange={e => { const u = [...deliveryTiers]; u[idx] = { ...u[idx], maxKm: parseFloat(e.target.value) || 0 }; setDeliveryTiers(u); }} style={{ ...inputStyle, paddingRight: 36 }} />
                            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>km</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>charge</span>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Rs.</span>
                            <input type="number" min="0" value={tier.fee} onChange={e => { const u = [...deliveryTiers]; u[idx] = { ...u[idx], fee: parseFloat(e.target.value) || 0 }; setDeliveryTiers(u); }} style={{ ...inputStyle, paddingLeft: 34 }} />
                          </div>
                          <button type="button" onClick={() => setDeliveryTiers(prev => prev.filter((_, i) => i !== idx))} style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center' }}>
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', borderTop: '1px solid var(--card-border)', paddingTop: 14 }}>
                      <button type="button" onClick={() => setDeliveryTiers([...deliveryTiers, { maxKm: 5, fee: 50 }])} style={{ padding: '8px 14px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Add Tier</button>
                      <button type="button" onClick={handleSaveDeliverySettings} disabled={deliverySettingsSaving} style={{ marginLeft: 'auto', padding: '8px 18px', border: 'none', background: 'var(--text-primary)', color: 'var(--card-bg)', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{deliverySettingsSaving ? 'Saving…' : 'Save Configuration'}</button>
                    </div>
                    {deliverySettingsMsg.text && <div style={{ fontSize: 12, fontWeight: 600, color: deliverySettingsMsg.isError ? '#DC2626' : '#059669' }}>{deliverySettingsMsg.isError ? '✗' : '✓'} {deliverySettingsMsg.text}</div>}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Online Orders Registry</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filteredConsumer.length} orders</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                      <th style={thStyle}>Tracking ID</th>
                      <th style={thStyle}>Patient</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                      <th style={thStyle}>Address</th>
                      <th style={thStyle}>Status</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConsumer.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No online orders yet</td></tr>
                    ) : filteredConsumer.map(o => (
                      <tr key={o.id} onClick={() => setSelectedB2COrder(o)} style={{ borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--table-header-bg)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{o.trackingCode}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{o.buyerName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.buyerPhone}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right', fontFamily: 'monospace' }}>Rs. {o.totalAmount}</td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.deliveryAddress || '—'}</td>
                        <td style={{ padding: '12px 16px' }}><StatusBadge status={o.status} /></td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <select value={o.status} onChange={e => handleUpdateOnlineStatus(o.id, e.target.value)} style={{ padding: '5px 8px', borderRadius: 5, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}>
                            <option value="PENDING">Pending</option>
                            <option value="SHIPPED">Shipped</option>
                            <option value="DELIVERED">Delivered</option>
                            <option value="FAILED">Failed</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: HISTORY ── */}
      {mainTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(['DELIVERED', 'RETURNED', 'FAILED'] as const).map(s => {
              const cnt = orders.filter(o => o.status === s).length;
              const total = orders.filter(o => o.status === s).reduce((sum, o) => sum + o.netAmount, 0);
              const meta = STATUS_META[s];
              return (
                <div key={s} style={{ flex: 1, minWidth: 150, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '14px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{meta.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>{cnt}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Rs. {total.toLocaleString()} total</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--card-border)' }}>
              <Search style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
              <input type="text" placeholder="Search by order ID or wholesaler…" value={historySearch} onChange={e => setHistorySearch(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--text-primary)' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 'auto' }}>{filteredHistory.length} record{filteredHistory.length !== 1 ? 's' : ''}</span>
          </div>

          <div style={{ background: 'var(--card-bg)', borderRadius: 8, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            {filteredHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <History style={{ width: 36, height: 36, color: 'var(--card-border)' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>No order history yet</div>
                <div style={{ fontSize: 13 }}>Completed, returned, and failed orders will appear here</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={thStyle}>Order ID</th>
                    <th style={thStyle}>Wholesaler</th>
                    <th style={thStyle}>Items</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Net Amount</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Order Date</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(order => (
                    <tr key={order.id} onClick={() => setSelectedOrder(order)} style={{ borderBottom: '1px solid var(--card-border)', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--table-header-bg)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>#{order.id.substring(0, 8).toUpperCase()}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.wholesaler.companyName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{order.wholesaler.phone}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        <div>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.items.map(i => i.product.name).join(', ')}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>Rs. {order.netAmount.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge status={order.status} /></td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(order.createdAt).toLocaleDateString()}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => printOrderVoucher(order)} style={{ padding: '5px 10px', border: '1px solid var(--card-border)', borderRadius: 5, background: 'var(--card-bg)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                          <Printer style={{ width: 12, height: 12 }} /> Print
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <Modal onClose={() => setSelectedOrder(null)} title="Purchase Order Details">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--table-header-bg)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Supplier</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>{selectedOrder.wholesaler.companyName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selectedOrder.wholesaler.phone}</div>
              </div>
              <div style={{ background: 'var(--table-header-bg)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Date Placed</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>{new Date(selectedOrder.createdAt).toLocaleDateString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(selectedOrder.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>
            <div style={{ border: '1px solid var(--card-border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Itemised List</div>
              {selectedOrder.items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '10px 14px', borderBottom: '1px solid var(--card-border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.quantity} units × Rs. {item.pricePerUnit}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>Rs. {(item.quantity * item.pricePerUnit).toLocaleString()}</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, padding: '12px 14px', background: 'var(--table-header-bg)' }}>
                <span>Net Payable</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>Rs. {selectedOrder.netAmount.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => printOrderVoucher(selectedOrder)} style={{ flex: 1, padding: 10, background: 'var(--text-primary)', border: 'none', borderRadius: 6, color: 'var(--card-bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Printer style={{ width: 14, height: 14 }} /> Print Invoice
              </button>
              <button onClick={() => setSelectedOrder(null)} style={{ flex: 1, padding: 10, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* B2C Modal */}
      {selectedB2COrder && (
        <Modal onClose={() => setSelectedB2COrder(null)} title="Online Order Details">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--table-header-bg)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Patient</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: 'var(--text-primary)' }}>{selectedB2COrder.buyerName}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selectedB2COrder.buyerPhone}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedB2COrder.buyerEmail}</div>
              </div>
              <div style={{ background: 'var(--table-header-bg)', borderRadius: 6, padding: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Delivery Address</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: 'var(--text-secondary)' }}>{selectedB2COrder.deliveryAddress || '— No address provided'}</div>
              </div>
            </div>
            <div style={{ border: '1px solid var(--card-border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Medicines</div>
              {selectedB2COrder.items?.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '10px 14px', borderBottom: '1px solid var(--card-border)' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.product?.name || 'Medicine'} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>×{item.quantity}</span></span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>Rs. {(item.quantity * item.pricePerUnit).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, padding: '12px 14px', background: 'var(--table-header-bg)' }}>
                <span>Grand Total</span>
                <span style={{ fontFamily: 'monospace', color: '#059669' }}>Rs. {selectedB2COrder.totalAmount.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <select value={selectedB2COrder.status} onChange={e => { handleUpdateOnlineStatus(selectedB2COrder.id, e.target.value); setSelectedB2COrder(null); }} style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}>
                <option value="PENDING">Pending</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
              </select>
              <button onClick={() => setSelectedB2COrder(null)} style={{ flex: 1, padding: 10, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Intake Modal */}
      {intakeOrder && (
        <Modal onClose={() => setIntakeOrder(null)} title="Receive B2B Package" maxWidth={600}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Set the buying and selling price for each medicine in this delivery:
            </div>
            {intakeOrder.items.map((item: any) => {
              const priceKey = item.productId;
              const val = intakeCustomPrices[priceKey] || { buyingPrice: 0, sellingPrice: 0 };
              return (
                <div key={item.id} style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 7, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.product.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Buying Price / Box</label>
                      <input type="number" step="any" value={val.buyingPrice} onChange={e => setIntakeCustomPrices({ ...intakeCustomPrices, [priceKey]: { ...val, buyingPrice: parseFloat(e.target.value) || 0 } })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Selling Price / Box</label>
                      <input type="number" step="any" value={val.sellingPrice} onChange={e => setIntakeCustomPrices({ ...intakeCustomPrices, [priceKey]: { ...val, sellingPrice: parseFloat(e.target.value) || 0 } })} style={inputStyle} />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Settle Bill / Payment Info */}
            <div style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 7, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Payment Settlement (Cash on Delivery)</div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="intake-settle-now"
                  checked={intakeSettleNow}
                  onChange={e => setIntakeSettleNow(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="intake-settle-now" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Pay / Settle this bill now
                </label>
              </div>

              {intakeSettleNow && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Paid Amount (Rs.)</label>
                    <input
                      type="number"
                      step="any"
                      value={intakeSettleAmount}
                      onChange={e => setIntakeSettleAmount(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Payment Method</label>
                    <select
                      value={intakeSettleMethod}
                      onChange={e => setIntakeSettleMethod(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="CASH">💵 Cash</option>
                      <option value="MOBILE_BANKING">📱 Mobile Banking</option>
                      <option value="CARD">💳 Card</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>Verify Order Barcode</label>
              <input type="text" placeholder="Scan or type order barcode to confirm…" value={intakeBarcodeVerification} onChange={e => setIntakeBarcodeVerification(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setIntakeOrder(null)} style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleConfirmIntakeSubmit} disabled={intakeBarcodeVerification.trim().toUpperCase() !== `ORD-${intakeOrder.id.substring(0, 12).toUpperCase()}`} style={{ flex: 2, padding: 10, borderRadius: 6, border: 'none', background: 'var(--text-primary)', color: 'var(--card-bg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: intakeBarcodeVerification.trim().toUpperCase() !== `ORD-${intakeOrder.id.substring(0, 12).toUpperCase()}` ? 0.5 : 1 }}>
                {barcodeLoading ? 'Processing…' : 'Confirm Delivery & Ingest'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
