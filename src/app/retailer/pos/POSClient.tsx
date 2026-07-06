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

      {/* Main 2-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 18, flex: 1 }} className="no-print">

        {/* ── LEFT: Product selection ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── STEP 1: Find Medicine ── */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)' }}>

            {/* Card header */}
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--table-header-bg)' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#F59E0B', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>1</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Find Medicine</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>F9 to focus search</span>
            </div>

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Barcode row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 8, border: '1px solid #FDE68A', overflow: 'hidden', background: '#FFFDF7' }}>
                <div style={{ padding: '9px 12px', borderRight: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <Receipt style={{ width: 14, height: 14, color: '#D97706' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', whiteSpace: 'nowrap' }}>SCAN</span>
                </div>
                <input
                  type="text"
                  placeholder="Scan barcode or type SKU, press Enter…"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = barcodeInput.trim().toUpperCase();
                      if (!val) return;
                      const found = products.find(p => p.sku.toUpperCase() === val || p.id === val);
                      if (found) { setSelectedProductId(found.id); setSelectedBatchId(found.batches[0]?.id || ''); setBarcodeInput(''); }
                      else alert(`No product found for: ${val}`);
                    }
                  }}
                  style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, padding: '9px 12px', fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: '#92400E' }}
                />
              </div>

              {/* Search row */}
              <div style={{ position: 'relative' }} ref={suggestionsRef}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 8, border: '1px solid var(--card-border)', overflow: 'hidden', background: 'var(--card-bg)' }}>
                  <div style={{ padding: '9px 12px', borderRight: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <Search style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Type medicine name or SKU to search…"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)' }}
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setShowSuggestions(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 10px' }}>
                      <X style={{ width: 13, height: 13 }} />
                    </button>
                  )}
                </div>

                {showSuggestions && searchQuery && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, zIndex: 9999, maxHeight: 300, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.09)' }}>
                    {filteredProducts.length === 0 ? (
                      <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>No medicines found</div>
                    ) : filteredProducts.map((p) => {
                      const totalUnits = p.batches.reduce((s, b) => s + b.availableBaseUnits, 0);
                      const nearestExpiry = p.batches.reduce<string | null>((min, b) => !min ? b.expiryDate : new Date(b.expiryDate) < new Date(min) ? b.expiryDate : min, null);
                      const racks = [...new Set(p.batches.map(b => b.rack).filter(Boolean))] as string[];
                      const isExpiringSoon = nearestExpiry ? new Date(nearestExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : false;
                      return (
                        <div key={p.id}
                          onClick={() => { setSelectedProductId(p.id); setSelectedBatchId(p.batches[0]?.id || ''); setSearchQuery(''); setShowSuggestions(false); }}
                          style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--card-border)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--table-header-bg)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.sku}</span>
                                {' · '}{p.category}
                                {' · '}{p.batches.length} batch{p.batches.length !== 1 ? 'es' : ''}
                              </div>
                              {(nearestExpiry || racks.length > 0) && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                                  {nearestExpiry && (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: isExpiringSoon ? '#FFFBEB' : '#F0FDF4', color: isExpiringSoon ? '#92400E' : '#15803D', border: `1px solid ${isExpiringSoon ? '#FDE68A' : '#BBF7D0'}` }}>
                                      Exp {new Date(nearestExpiry).toLocaleDateString()}
                                    </span>
                                  )}
                                  {racks.map(r => (
                                    <span key={r} style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#FEF9C3', color: '#713F12', border: '1px solid #FEF08A' }}>📍 {r}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: totalUnits > 0 ? '#D97706' : '#EF4444' }}>{totalUnits}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>units</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── STEP 2: Select Product + Batch ── */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: `1px solid ${selectedProductId ? 'var(--card-border)' : 'var(--card-border)'}`, overflow: 'hidden' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--table-header-bg)' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: selectedProductId ? '#10B981' : '#CBD5E1', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, transition: 'background 0.2s' }}>2</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Select Product &amp; Batch</span>
              {selectedProduct && (
                <button type="button" onClick={() => { setSelectedProductId(''); setSelectedBatchId(''); }} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <X style={{ width: 12, height: 12 }} /> Clear
                </button>
              )}
            </div>

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Medicine dropdown */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>Medicine</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => { setSelectedProductId(e.target.value); setSelectedBatchId(''); }}
                  style={{ ...inputStyle, fontWeight: selectedProductId ? 700 : 400, color: selectedProductId ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <option value="">— Choose Medicine —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}  ·  SKU: {p.sku}</option>)}
                </select>
              </div>

              {/* Selected product info card */}
              {selectedProduct && (
                <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedProduct.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedProduct.sku}</span>
                        {' · '}{selectedProduct.category}
                        {' · '}{selectedProduct.tabletsPerStrip}t × {selectedProduct.stripsPerBox}s/box
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                      {selectedProduct.batches.length} batch{selectedProduct.batches.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Batch list as clickable rows */}
              {selectedProduct && selectedProduct.batches.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Choose Batch</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {selectedProduct.batches.map((b) => {
                      const isSelected = selectedBatchId === b.id;
                      const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      const expColor = daysLeft < 0 ? '#EF4444' : daysLeft <= 30 ? '#D97706' : '#10B981';
                      const expBg = daysLeft < 0 ? '#FEF2F2' : daysLeft <= 30 ? '#FFFBEB' : '#F0FDF4';
                      const expLabel = daysLeft < 0 ? 'EXPIRED' : daysLeft <= 30 ? `${daysLeft}d left` : new Date(b.expiryDate).toLocaleDateString();
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBatchId(b.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', border: `1.5px solid ${isSelected ? '#F59E0B' : 'var(--card-border)'}`, background: isSelected ? '#FFFDF7' : 'var(--card-bg)', transition: 'all 0.15s' }}
                        >
                          {/* Radio circle */}
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${isSelected ? '#F59E0B' : '#CBD5E1'}`, background: isSelected ? '#F59E0B' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                            {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{b.batchNumber}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                              {b.availableBaseUnits.toLocaleString()} units
                              {b.rack && <> · 📍 <span style={{ fontWeight: 700 }}>{b.rack}</span></>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: expColor, background: expBg, padding: '2px 7px', borderRadius: 5 }}>{expLabel}</div>
                            {b.sellingPrice && b.sellingPrice > 0 && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Rs. {b.sellingPrice}/box</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedProduct && selectedProduct.batches.length === 0 && (
                <div style={{ padding: '12px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA', fontSize: 13, color: '#DC2626', fontWeight: 600 }}>No available batches for this medicine</div>
              )}
            </div>
          </div>

          {/* ── STEP 3: Quantity & Add ── */}
          {selectedProduct && selectedBatch && (() => {
            const pricePerBox = getProductPricePerBox(selectedProduct, selectedBatch.id);
            const tabletsPerBox = selectedProduct.tabletsPerStrip * selectedProduct.stripsPerBox;
            let baseUnitsPreview = posUomType === 'box' ? posQtyInput * tabletsPerBox : posUomType === 'strip' ? posQtyInput * selectedProduct.tabletsPerStrip : posQtyInput;
            const lineTotal = baseUnitsPreview * (pricePerBox / tabletsPerBox);
            const stockOk = baseUnitsPreview <= selectedBatch.availableBaseUnits;

            return (
              <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--table-header-bg)' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#3B82F6', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>3</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Set Quantity &amp; Dispense</span>
                </div>

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* UOM toggle */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Unit of Measure · F2 to cycle</label>
                    <div style={{ display: 'flex', border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                      {([{ id: 'box', label: 'Box', sub: `=${tabletsPerBox} tabs` }, { id: 'strip', label: 'Strip', sub: `=${selectedProduct.tabletsPerStrip} tabs` }, { id: 'tablet', label: 'Tablet', sub: '=1 tab' }] as const).map((u, i) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setPosUomType(u.id)}
                          style={{
                            flex: 1, padding: '10px 6px', border: 'none',
                            borderRight: i < 2 ? '1px solid var(--card-border)' : 'none',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            background: posUomType === u.id ? '#FFFBEB' : 'var(--card-bg)',
                            color: posUomType === u.id ? '#D97706' : 'var(--text-secondary)',
                            transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2
                          }}
                        >
                          <span>{u.label}</span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: posUomType === u.id ? '#D97706' : 'var(--text-muted)', opacity: 0.8 }}>{u.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Qty stepper */}
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>Quantity · F3 to focus</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => setPosQtyInput(q => Math.max(1, q - 1))}
                        style={{ padding: '10px 16px', border: 'none', borderRight: '1px solid var(--card-border)', background: 'var(--table-header-bg)', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-border)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--table-header-bg)')}
                      >−</button>
                      <input
                        id="pos-qty-input"
                        type="number"
                        min="1"
                        value={posQtyInput}
                        onChange={(e) => setPosQtyInput(parseInt(e.target.value) || 1)}
                        style={{ flex: 1, border: 'none', outline: 'none', textAlign: 'center', fontSize: 18, fontWeight: 800, padding: '10px 0', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                      />
                      <button
                        type="button"
                        onClick={() => setPosQtyInput(q => q + 1)}
                        style={{ padding: '10px 16px', border: 'none', borderLeft: '1px solid var(--card-border)', background: 'var(--table-header-bg)', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: 'var(--text-secondary)', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-border)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--table-header-bg)')}
                      >+</button>
                    </div>
                  </div>

                  {/* Price preview */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: stockOk ? 'var(--table-header-bg)' : '#FEF2F2', borderRadius: 8, border: `1px solid ${stockOk ? 'var(--card-border)' : '#FECACA'}` }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 700 }}>{posQtyInput} {posUomType}{posQtyInput > 1 ? 's' : ''}</span>
                      {' = '}<span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{baseUnitsPreview}</span> tabs
                      {!stockOk && <span style={{ color: '#DC2626', fontWeight: 700, marginLeft: 8 }}>⚠ Exceeds stock</span>}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: stockOk ? '#D97706' : '#DC2626' }}>Rs. {lineTotal.toFixed(2)}</div>
                  </div>

                  {/* Quick presets */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 5, 10].map(n => (
                      <button key={n} type="button" onClick={() => setPosQtyInput(n)} style={{ flex: 1, padding: '6px 4px', borderRadius: 7, border: `1px solid ${posQtyInput === n ? '#F59E0B' : 'var(--card-border)'}`, background: posQtyInput === n ? '#FFFBEB' : 'var(--card-bg)', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: posQtyInput === n ? '#D97706' : 'var(--text-secondary)' }}>{n}</button>
                    ))}
                  </div>

                  {/* CTA */}
                  <button
                    id="add-to-basket-btn"
                    type="button"
                    onClick={handleAddToBasket}
                    disabled={!stockOk}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 8, background: stockOk ? '#F59E0B' : '#CBD5E1', color: '#FFFFFF', border: 'none', fontSize: 14, fontWeight: 700, cursor: stockOk ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}
                  >
                    <Plus style={{ width: 16, height: 16 }} />
                    Add to Cart &nbsp;<kbd style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontFamily: 'monospace' }}>F1</kbd>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA', color: '#DC2626', fontSize: 13, fontWeight: 600 }}>
              <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} /> <span>{error}</span>
            </div>
          )}
        </div>

        {/* ── RIGHT: Cart & Checkout ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {cart.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: '60px 24px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <ShoppingBag style={{ width: 40, height: 40, color: '#E2E8F0' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Cart is Empty</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Search and select medicines on the left to bill a patient</div>
            </div>
          ) : (
            <form id="pos-checkout-form" onSubmit={handleCheckout} style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', flex: 1 }}>

              {/* Cart header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingBag style={{ width: 16, height: 16, color: '#D97706' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Cart ({cart.length} item{cart.length > 1 ? 's' : ''})</span>
                <button type="button" onClick={() => setCart([])} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Trash2 style={{ width: 12, height: 12 }} /> Clear All
                </button>
              </div>

              {/* Cart items */}
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--table-header-bg)', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        Batch: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.batchNumber}</span>
                        {item.rack && <> · <span style={{ color: '#D97706' }}>📍 {item.rack}</span></>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--card-border)', borderRadius: 6, padding: '2px 2px', background: 'var(--card-bg)' }}>
                        <button type="button" onClick={() => adjustCartItemQty(item.productId, item.batchNumber, item.packaging, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 14 }}>−</button>
                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 28, textAlign: 'center', color: 'var(--text-primary)' }}>{item.qty}{item.packaging[0]}</span>
                        <button type="button" onClick={() => adjustCartItemQty(item.productId, item.batchNumber, item.packaging, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 14 }}>+</button>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: 72, textAlign: 'right', fontSize: 13 }}>Rs. {item.totalAmount.toFixed(0)}</span>
                      <button type="button" onClick={() => removeFromCart(item.productId, item.batchNumber, item.packaging)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}>
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals + adjustments */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span><span style={{ fontWeight: 600 }}>Rs. {subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>DISCOUNT (%)</label>
                    <input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>TAX / VAT (%)</label>
                    <input type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                {discountAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#10B981' }}><span>Discount</span><span>−Rs. {discountAmount.toFixed(2)}</span></div>}
                {taxAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}><span>Tax</span><span>+Rs. {taxAmount.toFixed(2)}</span></div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', paddingTop: 8, borderTop: '1px solid var(--card-border)' }}>
                  <span>Net Payable</span><span style={{ color: '#D97706' }}>Rs. {netAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Customer + payment */}
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PATIENT (F4)</label>
                    <input id="patient-name-input" type="text" placeholder="Walk-in Patient" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PHONE</label>
                    <input type="text" placeholder="N/A" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={inputStyle} />
                  </div>
                </div>

                {/* Payment state toggle */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PAYMENT STATE (F7)</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {([{ id: 'FULL', label: 'Full', color: '#10B981' }, { id: 'HALF', label: 'Half', color: '#F59E0B' }, { id: 'UNPAID', label: 'Credit', color: '#EF4444' }] as const).map((pay) => (
                      <button key={pay.id} type="button" onClick={() => setPaymentStatusType(pay.id)} style={{ flex: 1, padding: '7px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${paymentStatusType === pay.id ? pay.color : 'var(--card-border)'}`, background: paymentStatusType === pay.id ? `${pay.color}12` : 'var(--card-bg)', color: paymentStatusType === pay.id ? pay.color : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                        {pay.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>METHOD (F8)</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={inputStyle}>
                      <option value="CASH">Cash</option>
                      <option value="MOBILE_BANKING">Mobile / QR</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>PAID (Rs.)</label>
                    <input type="number" value={paidAmountInput} onChange={(e) => setPaidAmountInput(e.target.value)} style={{ ...inputStyle, fontWeight: 700, color: '#10B981' }} />
                  </div>
                </div>

                {paidAmountInput && parseFloat(paidAmountInput) < netAmount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#EF4444', fontWeight: 700 }}>
                    <span>Due Amount</span><span>Rs. {(netAmount - parseFloat(paidAmountInput)).toFixed(2)}</span>
                  </div>
                )}

                <button type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 8, background: loading ? '#CBD5E1' : '#10B981', color: '#FFFFFF', border: 'none', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                  <CheckCircle style={{ width: 16, height: 16 }} />
                  {loading ? 'Processing…' : 'Finalize Checkout (Ctrl+Enter)'}
                </button>
              </div>
            </form>
          )}
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
