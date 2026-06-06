'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Truck, Database, Package, ShoppingCart, User, Clock, 
  CreditCard, ShieldAlert, CheckCircle, AlertCircle, RefreshCw, Trash2, ArrowRight, Barcode, HelpCircle
} from 'lucide-react';
import { logActivity } from '@/components/WholesalerLayout';

interface Retailer {
  id: string;
  pharmacyName: string;
  creditLimit: number;
  lifetimeSpend: number;
  registrationNumber: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
  tierPricingJson: string;
}

interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  pricePerUnit: number;
}

interface Order {
  id: string;
  retailer: Retailer;
  status: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  overrideJustification?: string;
  createdAt: string;
  items: OrderItem[];
}

interface OrdersClientProps {
  profileId: string;
  retailers: Retailer[];
}

export default function OrdersClient({ profileId, retailers }: OrdersClientProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [selectedRetailerId, setSelectedRetailerId] = useState('');
  const [basket, setBasket] = useState<Array<{ productId: string; qtyBoxes: number }>>([]);
  const [currentProductId, setCurrentProductId] = useState('');
  const [currentQtyBoxes, setCurrentQtyBoxes] = useState('5');
  
  // Barcode scanner simulator state
  const [barcodeInput, setBarcodeInput] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);
  
  const [creditBlockMessage, setCreditBlockMessage] = useState('');
  const [overrideJustification, setOverrideJustification] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);

  const fetchOrdersAndProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const prodRes = await fetch('/api/wholesaler/products');
      const prodData = await prodRes.json();
      if (!prodRes.ok) throw new Error(prodData.error || 'Failed to fetch products');
      setProducts(prodData.products);

      const orderRes = await fetch(`/api/orders?wholesalerId=${profileId}`);
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to fetch orders');
      setOrders(orderData.orders);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching orders data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersAndProducts();
    if (retailers.length > 0) {
      setSelectedRetailerId(retailers[0].id);
    }
  }, []);

  const addToBasket = (prodId: string, qtyToAdd: number) => {
    if (!prodId || qtyToAdd <= 0) return;

    const existing = basket.find(item => item.productId === prodId);
    if (existing) {
      setBasket(basket.map(item => 
        item.productId === prodId ? { ...item, qtyBoxes: item.qtyBoxes + qtyToAdd } : item
      ));
    } else {
      setBasket([...basket, { productId: prodId, qtyBoxes: qtyToAdd }]);
    }
  };

  // Barcode scan scanner handler (USB keyboard scanner sends keys then 'Enter')
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!barcodeInput.trim()) return;

    const cleanedInput = barcodeInput.trim().toUpperCase();
    
    // Attempt to match SKU first
    let matchedProduct = products.find(p => p.sku.toUpperCase() === cleanedInput);
    
    // Or attempt to parse generated barcode identifier (e.g. PRODUCTID-BATCHID)
    if (!matchedProduct) {
      // Barcode generators write: `${productId.substring(0,8)}-${batchNumber}`
      // Check if input fits that pattern by checking products
      matchedProduct = products.find(p => p.id.substring(0, 8).toUpperCase() === cleanedInput.split('-')[0]);
    }

    if (matchedProduct) {
      addToBasket(matchedProduct.id, 1);
      setSuccessMsg(`Scanned: Added 1 Box of "${matchedProduct.name}" to order basket.`);
      setBarcodeInput('');
      logActivity('BARCODE_SCAN', `Scanned medicine barcode: ${matchedProduct.sku} - ${matchedProduct.name}`);
      
      // Clear success flash after 3 seconds
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setError(`No product registered with code/SKU: "${cleanedInput}"`);
    }

    // Keep focus in scanner input box
    if (scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  };

  const removeFromBasket = (productId: string) => {
    setBasket(basket.filter(item => item.productId !== productId));
  };

  const calculateBasketSummary = () => {
    let total = 0;
    const basketItems = basket.map(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return { name: '', sku: '', qty: 0, pricePerBox: 0, subtotal: 0 };

      let pricePerBox = 100; 
      try {
        const tiers = JSON.parse(prod.tierPricingJson || '[]');
        const matchingTier = tiers.find(
          (t: any) => item.qtyBoxes >= t.minQty && item.qtyBoxes <= (t.maxQty || 999999)
        );
        if (matchingTier) {
          pricePerBox = matchingTier.pricePerBox;
        } else if (tiers.length > 0) {
          pricePerBox = tiers[0].pricePerBox;
        }
      } catch (e) {}

      const subtotal = item.qtyBoxes * pricePerBox;
      total += subtotal;

      return {
        name: prod.name,
        sku: prod.sku,
        qty: item.qtyBoxes,
        pricePerBox,
        subtotal
      };
    });

    const retailer = retailers.find(r => r.id === selectedRetailerId);
    let discountPercent = 0;
    let loyaltyTier = 'BRONZE (0%)';
    if (retailer) {
      if (retailer.lifetimeSpend >= 500000) {
        discountPercent = 0.10;
        loyaltyTier = 'GOLD (10% Discount)';
      } else if (retailer.lifetimeSpend >= 100000) {
        discountPercent = 0.05;
        loyaltyTier = 'SILVER (5% Discount)';
      }
    }

    const discountAmount = total * discountPercent;
    const netAmount = total - discountAmount;

    return {
      basketItems,
      total,
      discountAmount,
      netAmount,
      loyaltyTier
    };
  };

  const { basketItems, total, discountAmount, netAmount, loyaltyTier } = calculateBasketSummary();

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setCreditBlockMessage('');

    if (basket.length === 0) {
      setError('Please add at least one product to the basket.');
      return;
    }

    try {
      const payload: Record<string, any> = {
        retailerId: selectedRetailerId,
        wholesalerId: profileId,
        items: basket,
      };

      if (showOverrideInput && overrideJustification) {
        payload.overrideJustification = overrideJustification;
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'CREDIT_BLOCKED') {
          setCreditBlockMessage(data.reason);
          setShowOverrideInput(true);
          logActivity('CREDIT_BLOCK_WARNING', `Order blocked for retailer due to credit safeguards.`);
          return;
        }
        throw new Error(data.error || 'Failed to submit B2B order.');
      }

      setSuccessMsg(`B2B Order successfully submitted. Transaction ID: ${data.order.id}`);
      logActivity('SUBMIT_ORDER', `Created sales bill for retailer. Transaction ID: ${data.order.id}`);
      setBasket([]);
      setOverrideJustification('');
      setShowOverrideInput(false);
      setCreditBlockMessage('');
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to checkout order.');
    }
  };

  const handleDispatchOrder = async (orderId: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/orders/${orderId}/dispatch`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch shipment');

      setSuccessMsg(`Order ${orderId.substring(0, 8)} successfully dispatched for transport.`);
      logActivity('DISPATCH_SHIPMENT', `Dispatched sales order shipment: ${orderId}`);
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch order.');
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm delivery');

      setSuccessMsg(`Simulated delivery confirmed for Order ${orderId.substring(0, 8)}. Stock transferred to Retailer.`);
      logActivity('SIMULATE_DELIVERY', `Simulated delivery confirmation for order: ${orderId}`);
      fetchOrdersAndProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm delivery.');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(14,165,233,0.2)', borderRadius: 20,
        padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.06)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Truck style={{ width: 22, height: 22, color: '#0EA5E9' }} />
            B2B Sales & Order Management
          </h1>
          <p style={{ fontSize: 12, color: '#64748B' }}>Create, dispatch, and track B2B pharmacy orders with credit limit enforcement.</p>
        </div>
        <button onClick={fetchOrdersAndProducts} className="btn-ghost" title="Refresh Data">
          <RefreshCw style={{ width: 14, height: 14, color: '#0EA5E9' }} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && <div className="alert alert-error"><AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /><span>{error}</span></div>}
      {successMsg && <div className="alert alert-success"><CheckCircle style={{ width: 14, height: 14, flexShrink: 0 }} /><span>{successMsg}</span></div>}

      {/* Main 2-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Orders Table */}
        <div style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <h2 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ width: 13, height: 13, color: '#0EA5E9' }} /> Recent Orders Log
            </h2>
            <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: '#94A3B8', textTransform: 'uppercase' }}>
              {orders.length} orders
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <RefreshCw style={{ width: 22, height: 22, color: '#0EA5E9' }} className="animate-spin" />
              <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Loading sales log...</span>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <Package style={{ width: 28, height: 28, color: '#CBD5E1', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' }}>NO SALES ORDERS IN LOG</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order / Date</th>
                    <th>Customer</th>
                    <th>Medicines</th>
                    <th>Status</th>
                    <th>Net Payable</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const orderDate = new Date(order.createdAt).toLocaleString();
                    const sMap: Record<string, { bg: string; color: string; border: string }> = {
                      PENDING:    { bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
                      PICKING:    { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
                      DISPATCHED: { bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
                      DELIVERED:  { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
                    };
                    const s = sMap[order.status] || { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' };
                    return (
                      <tr key={order.id}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1E293B', fontSize: 11, display: 'block' }}>
                            ORD-{order.id.substring(0, 8).toUpperCase()}
                          </span>
                          <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', display: 'block', marginTop: 2 }}>
                            {orderDate}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <User style={{ width: 12, height: 12, color: '#0EA5E9', flexShrink: 0 }} />
                            <span style={{ fontWeight: 700, fontSize: 12, color: '#1E293B' }}>{order.retailer.pharmacyName}</span>
                          </div>
                        </td>
                        <td style={{ maxWidth: 180 }}>
                          {order.items.map((item) => (
                            <div key={item.id} style={{ fontSize: 10, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.product.name} ({item.quantity} tabs)
                            </div>
                          ))}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                            fontFamily: 'monospace', background: s.bg, color: s.color,
                            border: `1px solid ${s.border}`, padding: '3px 10px', borderRadius: 20
                          }}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#1E293B', display: 'block', fontSize: 12 }}>
                            Rs. {order.netAmount.toFixed(2)}
                          </span>
                          {order.overrideJustification && (
                            <span style={{ fontSize: 9, color: '#DC2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                              <ShieldAlert style={{ width: 10, height: 10 }} /> Hold Bypassed
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {order.status === 'PENDING' && (
                              <button onClick={() => handleDispatchOrder(order.id)} className="btn-primary"
                                style={{ padding: '5px 12px', fontSize: 10, gap: 4 }}>
                                <Truck style={{ width: 11, height: 11 }} /> Ship
                              </button>
                            )}
                            {order.status === 'DISPATCHED' && (
                              <button onClick={() => handleConfirmOrder(order.id)}
                                style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderRadius: 8, border: '1.5px solid #A7F3D0', background: '#ECFDF5', color: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                                <CheckCircle style={{ width: 11, height: 11 }} /> Fulfill
                              </button>
                            )}
                            {order.status === 'DELIVERED' && (
                              <span style={{ fontSize: 10, color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CheckCircle style={{ width: 13, height: 13 }} /> Fulfilled
                              </span>
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

        {/* RIGHT — Order Creator Panel */}
        <div style={{ background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(14,165,233,0.25)', borderRadius: 18, padding: 20, boxShadow: '0 4px 20px rgba(14,165,233,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
            <h2 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingCart style={{ width: 14, height: 14, color: '#0EA5E9' }} /> B2B Order Creator
            </h2>
            <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Scan barcodes or select medicines to create a pharmacy order.</p>
          </div>

          {retailers.length === 0 ? (
            <div style={{ padding: 16, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
              No registered pharmacy found. Register a Pharmacy on the landing page first.
            </div>
          ) : (
            <>
              {/* Barcode Scanner */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Barcode style={{ width: 12, height: 12, color: '#0EA5E9' }} /> Barcode Scanner
                </div>
                <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: 6 }}>
                  <input ref={scannerInputRef} type="text" placeholder="Scan SKU or barcode..."
                    value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)}
                    className="input-crisp" style={{ fontFamily: 'monospace', fontSize: 11, flex: 1 }} />
                  <button type="submit" className="btn-primary" style={{ padding: '8px 14px', fontSize: 10, whiteSpace: 'nowrap' }}>Scan</button>
                </form>
                <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Tip: Type <strong style={{ fontFamily: 'monospace' }}>PARA-500</strong> and click Scan</p>
              </div>

              {/* Customer Select */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B', marginBottom: 6 }}>Customer Pharmacy</label>
                <select value={selectedRetailerId}
                  onChange={(e) => { logActivity('CHANGE_ORDER_CUSTOMER', `Selected: ${e.target.value}`); setSelectedRetailerId(e.target.value); setBasket([]); }}
                  className="input-crisp" style={{ width: '100%' }}>
                  {retailers.map(r => (
                    <option key={r.id} value={r.id}>{r.pharmacyName} (Limit: Rs. {r.creditLimit.toLocaleString()})</option>
                  ))}
                </select>
              </div>

              {/* Manual Add */}
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94A3B8', marginBottom: 8 }}>Add Medicine Manually</div>
                <select value={currentProductId} onChange={(e) => setCurrentProductId(e.target.value)}
                  className="input-crisp" style={{ width: '100%', marginBottom: 8 }}>
                  <option value="">-- select medicine --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" min="1" placeholder="Qty (boxes)" value={currentQtyBoxes}
                    onChange={(e) => setCurrentQtyBoxes(e.target.value)}
                    className="input-crisp" style={{ width: 90, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }} />
                  <button type="button" className="btn-primary"
                    style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: 11 }}
                    onClick={() => {
                      if (currentProductId) {
                        addToBasket(currentProductId, parseInt(currentQtyBoxes) || 1);
                        setCurrentProductId('');
                        setCurrentQtyBoxes('5');
                        logActivity('ADD_BASKET_MANUAL', 'Added item to basket manually');
                      }
                    }}>
                    Add to Order
                  </button>
                </div>
              </div>

              {/* Basket */}
              {basket.length > 0 && (
                <div style={{ background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284C7', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #BAE6FD', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Order Basket</span><span>Qty × Price</span>
                  </div>
                  {basketItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{item.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748B' }}>{item.qty} × Rs.{item.pricePerBox}</span>
                        <button type="button"
                          onClick={() => { logActivity('REMOVE_BASKET_ITEM', 'Removed item from basket'); removeFromBasket(basket[idx].productId); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}>
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              {basket.length > 0 && (
                <div style={{ background: '#1E293B', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', marginBottom: 6 }}>
                    <span>List Price:</span><span>Rs. {total.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#FCD34D', fontFamily: 'monospace', marginBottom: 6 }}>
                    <span>Loyalty ({loyaltyTier}):</span><span>- Rs. {discountAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, color: 'white', fontFamily: 'monospace', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <span>NET DUE:</span><span style={{ color: '#FB923C' }}>Rs. {netAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Credit Block */}
              {creditBlockMessage && (
                <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', borderRadius: 12, padding: 14 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <ShieldAlert style={{ width: 16, height: 16, color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#DC2626', marginBottom: 4 }}>Credit Block Active</div>
                      <p style={{ fontSize: 11, color: '#7F1D1D', lineHeight: 1.6 }}>{creditBlockMessage}</p>
                    </div>
                  </div>
                  {showOverrideInput && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 4 }}>Manager Override Reason</label>
                      <textarea rows={2} value={overrideJustification} onChange={(e) => setOverrideJustification(e.target.value)}
                        placeholder="e.g. Approved by manager — partial cash payment received"
                        className="input-crisp" style={{ lineHeight: 1.5, width: '100%' }} />
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <form onSubmit={handlePlaceOrder}>
                <button type="submit" disabled={basket.length === 0} className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 12, opacity: basket.length === 0 ? 0.5 : 1, cursor: basket.length === 0 ? 'not-allowed' : 'pointer' }}>
                  {showOverrideInput && overrideJustification ? 'Bypass Hold & Create Invoice' : 'Confirm Order & Create Invoice'}
                  <ArrowRight style={{ width: 14, height: 14 }} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
