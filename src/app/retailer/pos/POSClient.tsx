'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag, Search, Plus, Trash2, Printer, CheckCircle,
  AlertCircle, Layers, X, DollarSign, User, Phone, Check,
  Minus, Package, Receipt, Barcode, ArrowRight, MapPin,
  Clock, CreditCard, Banknote, Smartphone, ChevronDown
} from 'lucide-react';
import { createPOSSaleAction } from '@/app/actions/retailerActions';
import { broadcastUpdate } from '@/lib/events';

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  availableBaseUnits: number;
  sellingPrice?: number;
  buyingPrice?: number;
  rack?: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
  pricePerBox?: number;
  batches: Batch[];
}

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  batchNumber: string;
  qty: number;
  packaging: 'box' | 'strip' | 'tablet';
  pricePerBox: number;
  qtyBoxes: number;
  totalAmount: number;
  rack?: string | null;
}

interface POSClientProps {
  products: Product[];
}

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

export default function POSClient({ products }: POSClientProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [posUomType, setPosUomType] = useState<'box' | 'strip' | 'tablet'>('box');
  const [posQtyInput, setPosQtyInput] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentStatusType, setPaymentStatusType] = useState<'FULL' | 'HALF' | 'UNPAID'>('FULL');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [taxPercent, setTaxPercent] = useState('0');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedBatch = selectedProduct?.batches.find((b) => b.id === selectedBatchId);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateCartSummary = () => {
    const subtotal = cart.reduce((s, item) => s + item.totalAmount, 0);
    const discPct = parseFloat(discountPercent) || 0;
    const taxPct = parseFloat(taxPercent) || 0;
    const discountAmount = subtotal * (discPct / 100);
    const taxAmount = (subtotal - discountAmount) * (taxPct / 100);
    const netAmount = subtotal - discountAmount + taxAmount;
    return { subtotal, discountAmount, taxAmount, netAmount };
  };

  const { subtotal, discountAmount, taxAmount, netAmount } = calculateCartSummary();

  const getProductPricePerBox = (product: Product, batchId?: string) => {
    if (batchId) {
      const b = product.batches.find((x) => x.id === batchId);
      if (b && b.sellingPrice && b.sellingPrice > 0) return b.sellingPrice;
    }
    if (product.pricePerBox && product.pricePerBox > 0) return product.pricePerBox;
    return 100;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') { e.preventDefault(); searchInputRef.current?.focus(); }
      if (e.key === 'F8') { e.preventDefault(); setPaymentMethod((prev) => prev === 'CASH' ? 'MOBILE_BANKING' : prev === 'MOBILE_BANKING' ? 'CARD' : 'CASH'); }
      if (e.key === 'F7') { e.preventDefault(); setPaymentStatusType('FULL'); setPaidAmountInput(String(netAmount.toFixed(2))); }
      if (e.key === 'F4') { e.preventDefault(); document.getElementById('patient-name-input')?.focus(); }
      if (e.key === 'F3') { e.preventDefault(); document.getElementById('pos-qty-input')?.focus(); }
      if (e.key === 'F2') { e.preventDefault(); setPosUomType((prev) => prev === 'box' ? 'strip' : prev === 'strip' ? 'tablet' : 'box'); }
      if (e.key === 'F1') { e.preventDefault(); document.getElementById('add-to-basket-btn')?.click(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (cart.length > 0) (document.getElementById('pos-checkout-form') as HTMLFormElement)?.requestSubmit(); }
      if (e.key === 'Escape') { setShowSuggestions(false); setShowReceiptModal(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [netAmount, cart]);

  // Adjust paid amount on status change
  useEffect(() => {
    if (paymentStatusType === 'FULL') setPaidAmountInput(String(netAmount.toFixed(2)));
    else if (paymentStatusType === 'HALF') setPaidAmountInput(String((netAmount / 2).toFixed(2)));
    else setPaidAmountInput('0');
  }, [paymentStatusType, netAmount]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-select recommended batch when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setSelectedBatchId('');
      return;
    }
    const product = products.find(p => p.id === selectedProductId);
    if (product && product.batches.length > 0) {
      const sorted = [...product.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
      const recommended = sorted.find(b => b.availableBaseUnits > 0) || sorted[0];
      if (recommended) setSelectedBatchId(recommended.id);
    }
  }, [selectedProductId, products]);

  const adjustCartItemQty = (productId: string, batchNumber: string, packaging: 'box' | 'strip' | 'tablet', amount: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.productId === productId && item.batchNumber === batchNumber && item.packaging === packaging) {
        const newQty = Math.max(item.qty + amount, 1);
        const product = products.find(p => p.id === productId);
        if (!product) return item;
        const batch = product.batches.find(b => b.batchNumber === batchNumber);
        if (!batch) return item;
        const tabletsPerStrip = product.tabletsPerStrip || 10;
        const stripsPerBox = product.stripsPerBox || 10;
        const tabletsPerBox = tabletsPerStrip * stripsPerBox;
        let baseUnits = packaging === 'box' ? newQty * tabletsPerBox : packaging === 'strip' ? newQty * tabletsPerStrip : newQty;
        if (baseUnits > batch.availableBaseUnits) { alert(`Insufficient stock. Only ${batch.availableBaseUnits} units available.`); return item; }
        const pricePerBox = getProductPricePerBox(product, batch.id);
        const totalAmount = baseUnits * (pricePerBox / tabletsPerBox);
        return { ...item, qty: newQty, qtyBoxes: baseUnits / tabletsPerBox, totalAmount };
      }
      return item;
    }));
  };

  const handleAddToBasket = () => {
    if (!selectedProduct || !selectedBatch) { alert('Select a product and batch first.'); return; }
    const qty = posQtyInput;
    if (qty <= 0) return;
    const tabletsPerStrip = selectedProduct.tabletsPerStrip || 10;
    const stripsPerBox = selectedProduct.stripsPerBox || 10;
    const tabletsPerBox = tabletsPerStrip * stripsPerBox;
    let baseUnits = posUomType === 'box' ? qty * tabletsPerBox : posUomType === 'strip' ? qty * tabletsPerStrip : qty;
    if (baseUnits > selectedBatch.availableBaseUnits) { alert(`Insufficient stock. Only ${selectedBatch.availableBaseUnits} units available.`); return; }
    const pricePerBox = getProductPricePerBox(selectedProduct, selectedBatch.id);
    const totalAmount = baseUnits * (pricePerBox / tabletsPerBox);
    const key = `${selectedProduct.id}-${selectedBatch.batchNumber}`;
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => `${item.productId}-${item.batchNumber}` === key && item.packaging === posUomType);
      if (existingIndex > -1) {
        return prev.map((item, idx) => idx === existingIndex ? { ...item, qty: item.qty + qty, qtyBoxes: item.qtyBoxes + (baseUnits / tabletsPerBox), totalAmount: item.totalAmount + totalAmount } : item);
      }
      return [...prev, { productId: selectedProduct.id, name: selectedProduct.name, sku: selectedProduct.sku, batchNumber: selectedBatch.batchNumber, qty, packaging: posUomType, pricePerBox, qtyBoxes: baseUnits / tabletsPerBox, totalAmount, rack: selectedBatch.rack }];
    });
    setSelectedProductId(''); setSelectedBatchId(''); setPosQtyInput(1); setSearchQuery('');
  };

  const removeFromCart = (productId: string, batchNumber: string, packaging: string) => {
    setCart((prev) => prev.filter((item) => !(item.productId === productId && item.batchNumber === batchNumber && item.packaging === packaging)));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    try {
      setLoading(true); setError('');
      const paidAmount = parseFloat(paidAmountInput) || 0;
      const res = await createPOSSaleAction({ items: cart.map((c) => ({ productId: c.productId, qty: c.qty, packaging: c.packaging })), customerName: customerName || 'Walk-in Customer', customerPhone: customerPhone || 'N/A', paidAmount, paymentMethod, discountAmount, taxAmount });
      if (res.success) {
        setReceipt({ order: res.order, paidAmount: res.paidAmount, dueAmount: res.dueAmount, subtotal, discountAmount, taxAmount, netAmount, paymentMethod, customerName: customerName || 'Walk-in Customer', customerPhone: customerPhone || 'N/A' });
        setShowReceiptModal(true);
        setCart([]); setCustomerName(''); setCustomerPhone(''); setPaidAmountInput(''); setPaymentStatusType('FULL');
        broadcastUpdate('INVENTORY_UPDATE'); broadcastUpdate('BILLING_UPDATE');
      }
    } catch (err: any) { setError(err.message || 'POS checkout failed'); } finally { setLoading(false); }
  };

  const printThermalInvoice = (receiptData: any) => {
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    const itemRows = receiptData.order.items?.map((item: any) => {
      const product = products.find(p => p.id === item.productId) || item.product;
      return `<tr><td style="padding:4px 0">${product?.name || 'Medicine'}<br/><span style="font-size:9px;color:#555">SKU: ${product?.sku}</span></td><td style="text-align:right;padding:4px 0">${item.quantity} Tab</td><td style="text-align:right;padding:4px 0">Rs. ${(item.quantity * item.pricePerUnit).toLocaleString()}</td></tr>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:monospace;font-size:11px;padding:10px;color:#000;line-height:1.4}.center{text-align:center}.bold{font-weight:bold}.dashed{border-top:1px dashed #000;margin:8px 0}table{width:100%;border-collapse:collapse}td,th{text-align:left;vertical-align:top;font-size:10px}.right{text-align:right}</style></head><body><div class="center bold" style="font-size:12px">MEDHUB RETAIL PHARMACY</div><div class="center">B2C Sales Receipt</div><div class="dashed"></div><div><strong>Ref #:</strong> ${receiptData.order.id.substring(0,12).toUpperCase()}</div><div><strong>Date:</strong> ${new Date(receiptData.order.createdAt).toLocaleString()}</div><div><strong>Customer:</strong> ${receiptData.customerName}</div><div><strong>Phone:</strong> ${receiptData.customerPhone}</div><div class="dashed"></div><table><thead><tr style="border-bottom:1px dashed #000"><th>Item</th><th class="right">Qty</th><th class="right">Total</th></tr></thead><tbody>${itemRows}</tbody></table><div class="dashed"></div><div class="right"><div>Subtotal: Rs. ${receiptData.subtotal.toLocaleString()}</div>${receiptData.discountAmount > 0 ? `<div>Discount: -Rs. ${receiptData.discountAmount.toLocaleString()}</div>` : ''}${receiptData.taxAmount > 0 ? `<div>Tax: Rs. ${receiptData.taxAmount.toLocaleString()}</div>` : ''}<div class="bold" style="font-size:12px">Net: Rs. ${receiptData.netAmount.toLocaleString()}</div><div>Paid: Rs. ${receiptData.paidAmount.toLocaleString()}</div>${receiptData.dueAmount > 0 ? `<div class="bold">Due: Rs. ${receiptData.dueAmount.toLocaleString()}</div>` : ''}</div><div class="dashed"></div><div class="center" style="font-size:9px">Thank you! · MedHub Pharmacy POS</div><script>window.onload=function(){window.print();window.close();}<\/script></body></html>`);
    win.document.close();
  };

  const payMethodIcons: Record<string, any> = { CASH: Banknote, MOBILE_BANKING: Smartphone, CARD: CreditCard };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100vh' }} className="pos-shell">

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>POS Billing Counter</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Retail dispensing · Keyboard shortcuts: F9 Search · F1 Add · F2 Unit · F3 Qty · F7 Full Pay · Ctrl+Enter Checkout</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {cart.length > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 20, padding: '3px 12px' }}>
              {cart.length} item{cart.length > 1 ? 's' : ''} in cart
            </span>
          )}
        </div>
      </div>

      {/* ── FULL WIDTH POS CASHIER LAYOUT ── */}
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Catalog Finder Panel (Top position full-width, clean and matching wholesaler design) */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: 10, marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Search style={{ width: 18, height: 18, color: '#F59E0B' }} /> Advanced Catalog Medicine Finder
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, margin: 0 }}>Search medicines, allocate batches, verify stock, and configure transaction unit choices.</p>
            </div>
            <div style={{ padding: '5px 12px', borderRadius: 6, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 12, fontWeight: 600, color: '#B45309' }}>
              Auto Recommended Batch Enabled
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Search Input Box */}
            <div ref={suggestionsRef} style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Search Medicine SKU or Name</label>
              {selectedProduct ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '10px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#D97706' }}>{selectedProduct.name} [{selectedProduct.sku}]</div>
                  <button type="button" onClick={() => { setSelectedProductId(''); setSelectedBatchId(''); setSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Start typing medicine name or SKU... (F9 to focus)"
                    style={{ width: '100%', fontSize: 14, padding: '10px 14px', border: '1px solid var(--card-border)', borderRadius: 6, outline: 'none', background: 'var(--card-bg)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                  {showSuggestions && searchQuery && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.1)', zIndex: 9999, maxHeight: 240, overflowY: 'auto' }}>
                      {filteredProducts.length === 0 ? (
                        <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>No medicines found</div>
                      ) : (
                        filteredProducts.map(p => {
                          const totalUnits = p.batches.reduce((s, b) => s + b.availableBaseUnits, 0);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => { setSelectedProductId(p.id); setSearchQuery(''); setShowSuggestions(false); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', borderBottom: '1px solid var(--card-border)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--table-header-bg)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                SKU: {p.sku} | Category: {p.category} | Stock: {totalUnits} units ({p.batches.length} batches)
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Batch Selection */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Batch Allocation (Expiry Suggested)</label>
              <select
                disabled={!selectedProductId}
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                style={{ ...inputStyle, padding: '10px 14px', fontSize: 14 }}
              >
                <option value="">-- Choose batch --</option>
                {selectedProduct?.batches.map((b, idx) => {
                  return (
                    <option key={b.id} value={b.id}>
                      {b.batchNumber} (Exp: {new Date(b.expiryDate).toLocaleDateString()}) - {b.availableBaseUnits} units {idx === 0 ? '⭐ Recommended' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Selected Medicine Info Box & Actions */}
          {selectedProduct && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: 12, fontSize: 12, display: 'flex', justifyContent: 'space-between', color: '#92400E' }}>
                <div>Selected: <strong>{selectedProduct.name}</strong></div>
                <div>Default Price per Box: <strong>Rs. {selectedProduct.pricePerBox || 100}</strong></div>
                {selectedBatch && <div>Selected Batch Price: <strong>Rs. {selectedBatch.sellingPrice || selectedProduct.pricePerBox || 100}/box</strong></div>}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={posQtyInput}
                      onChange={(e) => setPosQtyInput(parseInt(e.target.value) || 1)}
                      style={{ width: 80, padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 6, textAlign: 'center', fontWeight: 'bold', fontSize: 14, background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>UOM Choice</label>
                    <select
                      value={posUomType}
                      onChange={(e) => setPosUomType(e.target.value as any)}
                      style={{ padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 6, fontSize: 13, background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                    >
                      <option value="box">Boxes</option>
                      <option value="strip">Strips</option>
                      <option value="tablet">Tablets</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  id="add-to-basket-btn"
                  onClick={handleAddToBasket}
                  style={{ padding: '10px 24px', fontSize: 13, fontWeight: 600, background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  ➕ Add to Basket (F1)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM ROW: Cart & Checkout Basket side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 16 }}>
          {/* Patient Info Card */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--card-border)', paddingBottom: 8, margin: 0 }}>
              <User style={{ width: 14, height: 14, color: '#F59E0B' }} /> Patient Details (F4)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Patient Name</label>
                <input id="patient-name-input" type="text" placeholder="Walk-in Patient" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Phone Number</label>
                <input type="text" placeholder="N/A" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Barcode Quick Scan */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--card-border)', paddingBottom: 8, margin: 0 }}>
              <Barcode style={{ width: 14, height: 14, color: '#F59E0B' }} /> Barcode Scan / SKU Quick Ingest
            </h3>
            <form onSubmit={e => {
              e.preventDefault();
              const val = barcodeInput.trim().toUpperCase();
              if (!val) return;
              const found = products.find(p => p.sku.toUpperCase() === val || p.id === val);
              if (found) { setSelectedProductId(found.id); setSelectedBatchId(found.batches[0]?.id || ''); setBarcodeInput(''); }
              else alert(`No product found for: ${val}`);
            }} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan barcode or type exact SKU..."
                style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: 13, padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 6, outline: 'none', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
              />
              <button type="submit" style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Ingest</button>
            </form>
          </div>
        </div>

        {/* BOTTOM ROW: Items Table & Checkout summary panel side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>
          
          {/* Cart Table Container */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 18, minHeight: 280 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--card-border)', paddingBottom: 10, marginBottom: 14, margin: 0 }}>
              <ShoppingBag style={{ width: 14, height: 14, color: '#F59E0B' }} /> Items in Basket
            </h3>
            {cart.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <ShoppingBag style={{ width: 24, height: 24, color: 'var(--card-border)', margin: '0 auto 10px' }} />
                <div>Basket is empty. Scan a barcode or search medicines above.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <th style={{ padding: '8px 4px' }}>Medicine Name</th>
                      <th style={{ padding: '8px 4px' }}>Batch</th>
                      <th style={{ padding: '8px 4px', width: 100, textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right' }}>Price/Box</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '8px 4px', width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={`${item.productId}-${item.batchNumber}-${item.packaging}`} style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <td style={{ padding: '8px 4px', fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: '8px 4px', fontFamily: 'monospace', fontSize: 11 }}>{item.batchNumber}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--card-border)', borderRadius: 6, padding: '2px 4px', background: 'var(--card-bg)' }}>
                            <button type="button" onClick={() => adjustCartItemQty(item.productId, item.batchNumber, item.packaging, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 4px', fontWeight: 700, color: 'var(--text-secondary)' }}>−</button>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{item.qty}{item.packaging[0]}</span>
                            <button type="button" onClick={() => adjustCartItemQty(item.productId, item.batchNumber, item.packaging, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 4px', fontWeight: 700, color: 'var(--text-secondary)' }}>+</button>
                          </div>
                        </td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace' }}>Rs. {item.pricePerBox.toFixed(2)}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>Rs. {item.totalAmount.toLocaleString()}</td>
                        <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                          <button type="button" onClick={() => removeFromCart(item.productId, item.batchNumber, item.packaging)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 4 }}>
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Checkout Basket Controls Panel */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag style={{ width: 16, height: 16, color: '#F59E0B' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Checkout Summary</span>
            </div>

            <form id="pos-checkout-form" onSubmit={handleCheckout} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cart.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <div>Basket is empty.</div>
                </div>
              ) : (
                <>
                  {/* Discount & Tax */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Discount %</label>
                      <input type="number" min="0" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>VAT / Tax %</label>
                      <input type="number" min="0" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} style={inputStyle} />
                    </div>
                  </div>

                  {/* Payment Method & Settle type */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Pay Method (F8)</label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={inputStyle}>
                        <option value="CASH">💵 Cash</option>
                        <option value="MOBILE_BANKING">📱 Mobile / QR</option>
                        <option value="CARD">💳 Card Payment</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Settle State (F7)</label>
                      <select value={paymentStatusType} onChange={e => setPaymentStatusType(e.target.value as any)} style={inputStyle}>
                        <option value="FULL">Fully Paid</option>
                        <option value="HALF">Half Paid</option>
                        <option value="UNPAID">Credit / Unpaid</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>Amount Paid Today (Rs.)</label>
                    <input type="number" value={paidAmountInput} onChange={e => setPaidAmountInput(e.target.value)} style={{ ...inputStyle, color: '#10B981', fontWeight: 700 }} />
                  </div>

                  {/* Order Summary */}
                  <div style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Subtotal:</span><span>Rs. {subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10B981' }}>
                      <span>Discount ({discountPercent}%):</span><span>− Rs. {discountAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Tax/VAT ({taxPercent}%):</span><span>+ Rs. {taxAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 750, color: 'var(--text-primary)', borderTop: '1px solid var(--card-border)', paddingTop: 6, marginTop: 2 }}>
                      <span>NET DUE:</span><span>Rs. {netAmount.toFixed(2)}</span>
                    </div>
                    {parseFloat(paidAmountInput) < netAmount && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 750, color: '#EF4444', borderTop: '1px dashed var(--card-border)', paddingTop: 4, marginTop: 2 }}>
                        <span>DUE BALANCE:</span><span>Rs. {(netAmount - (parseFloat(paidAmountInput) || 0)).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', padding: '11px', fontSize: 13, fontWeight: 600, background: '#10B981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {loading ? 'Processing…' : 'Finalize Counter Sale (Ctrl+Enter)'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts bar */}
      <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, border: '1px solid var(--card-border)' }} className="no-print">
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Shortcuts</span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[['F9', 'Search'], ['F1', 'Add'], ['F2', 'Unit'], ['F3', 'Qty'], ['F4', 'Patient'], ['F7', 'Full Pay'], ['F8', 'Method'], ['Ctrl+↵', 'Checkout']].map(([key, label]) => (
            <span key={key} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <kbd style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontFamily: 'monospace', fontWeight: 700, marginRight: 4 }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Receipt Modal ── */}
      {showReceiptModal && receipt && (
        <div onClick={() => setShowReceiptModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '90vh' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle style={{ width: 16, height: 16, color: '#10B981' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Sale Complete</span>
              </div>
              <button onClick={() => setShowReceiptModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: '14px 18px', background: '#F0FDF4', borderBottom: '1px solid #BBF7D0', fontSize: 13, color: '#15803D', fontWeight: 600 }}>
              ✓ POS sale recorded successfully
            </div>
            <div style={{ padding: '14px 18px', overflowY: 'auto', flex: 1 }}>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '14px 16px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-primary)' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 13, marginBottom: 3 }}>MEDHUB RETAIL PHARMACY</div>
                <div style={{ textAlign: 'center', fontSize: 11, borderBottom: '1px dashed #94A3B8', paddingBottom: 6, marginBottom: 10 }}>B2C Counter Invoice</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8, fontSize: 11 }}>
                  <div><strong>Ref:</strong> {receipt.order.id.substring(0, 12).toUpperCase()}</div>
                  <div><strong>Date:</strong> {new Date(receipt.order.createdAt).toLocaleString()}</div>
                  <div><strong>Patient:</strong> {receipt.customerName}</div>
                  <div><strong>Phone:</strong> {receipt.customerPhone}</div>
                  <div><strong>Method:</strong> {receipt.paymentMethod}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                  <thead><tr style={{ borderBottom: '1px dashed #94A3B8' }}><th style={{ textAlign: 'left', padding: '3px 0', fontSize: 10 }}>Medicine</th><th style={{ textAlign: 'right', padding: '3px 0', fontSize: 10 }}>Qty</th><th style={{ textAlign: 'right', padding: '3px 0', fontSize: 10 }}>Total</th></tr></thead>
                  <tbody>
                    {receipt.order.items?.map((item: any, idx: number) => {
                      const product = products.find(p => p.id === item.productId) || item.product;
                      return (<tr key={idx}><td style={{ padding: '3px 0', fontSize: 10 }}>{product?.name || 'Medicine'}</td><td style={{ textAlign: 'right', padding: '3px 0', fontSize: 10 }}>{item.quantity}</td><td style={{ textAlign: 'right', padding: '3px 0', fontSize: 10 }}>Rs. {(item.quantity * item.pricePerUnit).toLocaleString()}</td></tr>);
                    })}
                  </tbody>
                </table>
                <div style={{ textAlign: 'right', borderTop: '1px dashed #94A3B8', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
                  <div>Subtotal: Rs. {receipt.subtotal.toLocaleString()}</div>
                  {receipt.discountAmount > 0 && <div>Discount: −Rs. {receipt.discountAmount.toLocaleString()}</div>}
                  {receipt.taxAmount > 0 && <div>Tax: +Rs. {receipt.taxAmount.toLocaleString()}</div>}
                  <div style={{ fontWeight: 'bold', fontSize: 13, marginTop: 2 }}>Grand Total: Rs. {receipt.netAmount.toLocaleString()}</div>
                  <div style={{ borderTop: '1px dashed #94A3B8', margin: '4px 0 2px' }}></div>
                  <div style={{ color: '#10B981', fontWeight: 'bold' }}>Paid: Rs. {receipt.paidAmount.toLocaleString()}</div>
                  {receipt.dueAmount > 0 && <div style={{ color: '#EF4444', fontWeight: 'bold' }}>Due: Rs. {receipt.dueAmount.toLocaleString()}</div>}
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReceiptModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
              <button onClick={() => printThermalInvoice(receipt)} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: '#10B981', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Printer style={{ width: 14, height: 14 }} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
