'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag, Search, Plus, Trash2, Printer, CheckCircle,
  AlertCircle, Layers, X, DollarSign, User, Phone, Check, RefreshCw
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
  pricePerBox?: number; // Optional: price hint from server
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

export default function POSClient({ products }: POSClientProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Search and select product/batch states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [posUomType, setPosUomType] = useState<'box' | 'strip' | 'tablet'>('box');
  const [posQtyInput, setPosQtyInput] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Advanced payment inputs
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentStatusType, setPaymentStatusType] = useState<'FULL' | 'HALF' | 'UNPAID'>('FULL');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [taxPercent, setTaxPercent] = useState('0'); // default 0% or custom

  // Statuses
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [receipt, setReceipt] = useState<any | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedBatch = selectedProduct?.batches.find((b) => b.id === selectedBatchId);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculateCartSummary = () => {
    let subtotal = 0;
    cart.forEach((item) => {
      subtotal += item.totalAmount;
    });

    const discPct = parseFloat(discountPercent) || 0;
    const taxPct = parseFloat(taxPercent) || 0;

    const discountAmount = subtotal * (discPct / 100);
    const taxAmount = (subtotal - discountAmount) * (taxPct / 100);
    const netAmount = subtotal - discountAmount + taxAmount;

    return { subtotal, discountAmount, taxAmount, netAmount };
  };

  const { subtotal, discountAmount, taxAmount, netAmount } = calculateCartSummary();

  // Manage UOM pricing and base units calculations
  const getProductPricePerBox = (product: Product, batchId?: string) => {
    if (batchId) {
      const b = product.batches.find((x) => x.id === batchId);
      if (b && b.sellingPrice && b.sellingPrice > 0) {
        return b.sellingPrice;
      }
    }
    // Use pre-computed price hint from server if available, else fallback
    if (product.pricePerBox && product.pricePerBox > 0) return product.pricePerBox;
    return 100; // fallback
  };

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        setPaymentMethod((prev) => {
          if (prev === 'CASH') return 'MOBILE_BANKING';
          if (prev === 'MOBILE_BANKING') return 'CARD';
          return 'CASH';
        });
      }
      if (e.key === 'F7') {
        e.preventDefault();
        setPaymentStatusType('FULL');
        setPaidAmountInput(String(netAmount.toFixed(2)));
      }
      if (e.key === 'F4') {
        e.preventDefault();
        const el = document.getElementById('patient-name-input');
        el?.focus();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        const el = document.getElementById('pos-qty-input');
        el?.focus();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setPosUomType((prev) => {
          if (prev === 'box') return 'strip';
          if (prev === 'strip') return 'tablet';
          return 'box';
        });
      }
      if (e.key === 'F1') {
        e.preventDefault();
        const el = document.getElementById('add-to-basket-btn');
        el?.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0) {
          const form = document.getElementById('pos-checkout-form') as HTMLFormElement;
          form?.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [netAmount, cart]);

  // Adjust paid amount based on payment status changes
  useEffect(() => {
    if (paymentStatusType === 'FULL') {
      setPaidAmountInput(String(netAmount.toFixed(2)));
    } else if (paymentStatusType === 'HALF') {
      setPaidAmountInput(String((netAmount / 2).toFixed(2)));
    } else {
      setPaidAmountInput('0');
    }
  }, [paymentStatusType, netAmount]);

  const adjustCartItemQty = (productId: string, batchNumber: string, packaging: 'box' | 'strip' | 'tablet', amount: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.productId === productId && item.batchNumber === batchNumber && item.packaging === packaging) {
          const newQty = Math.max(item.qty + amount, 1);
          
          const product = products.find(p => p.id === productId);
          if (!product) return item;
          
          const batch = product.batches.find(b => b.batchNumber === batchNumber);
          if (!batch) return item;
          
          const tabletsPerStrip = product.tabletsPerStrip || 10;
          const stripsPerBox = product.stripsPerBox || 10;
          const tabletsPerBox = tabletsPerStrip * stripsPerBox;
          
          let baseUnits = 0;
          if (packaging === 'box') {
            baseUnits = newQty * tabletsPerBox;
          } else if (packaging === 'strip') {
            baseUnits = newQty * tabletsPerStrip;
          } else {
            baseUnits = newQty;
          }
          
          if (baseUnits > batch.availableBaseUnits) {
            alert(`Cannot increase quantity: Insufficient stock. Only ${batch.availableBaseUnits} units available.`);
            return item;
          }
          
          const pricePerBox = getProductPricePerBox(product, batch.id);
          const pricePerUnit = pricePerBox / tabletsPerBox;
          const totalAmount = baseUnits * pricePerUnit;
          
          return {
            ...item,
            qty: newQty,
            qtyBoxes: baseUnits / tabletsPerBox,
            totalAmount
          };
        }
        return item;
      });
    });
  };

  const handleAddToBasket = () => {
    if (!selectedProduct || !selectedBatch) {
      alert('Please select a product and batch first.');
      return;
    }

    const qty = posQtyInput;
    if (qty <= 0) return;

    const tabletsPerStrip = selectedProduct.tabletsPerStrip || 10;
    const stripsPerBox = selectedProduct.stripsPerBox || 10;
    const tabletsPerBox = tabletsPerStrip * stripsPerBox;

    let baseUnits = 0;
    if (posUomType === 'box') {
      baseUnits = qty * tabletsPerBox;
    } else if (posUomType === 'strip') {
      baseUnits = qty * tabletsPerStrip;
    } else {
      baseUnits = qty;
    }

    if (baseUnits > selectedBatch.availableBaseUnits) {
      alert(`Insufficient stock. Only ${selectedBatch.availableBaseUnits} units available in selected batch.`);
      return;
    }

    const pricePerBox = getProductPricePerBox(selectedProduct, selectedBatch.id);
    const pricePerUnit = pricePerBox / tabletsPerBox;
    const totalAmount = baseUnits * pricePerUnit;

    const key = `${selectedProduct.id}-${selectedBatch.batchNumber}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => `${item.productId}-${item.batchNumber}` === key && item.packaging === posUomType);
      
      if (existingIndex > -1) {
        return prev.map((item, idx) =>
          idx === existingIndex
            ? { ...item, qty: item.qty + qty, qtyBoxes: item.qtyBoxes + (baseUnits / tabletsPerBox), totalAmount: item.totalAmount + totalAmount }
            : item
        );
      } else {
        return [
          ...prev,
          {
            productId: selectedProduct.id,
            name: selectedProduct.name,
            sku: selectedProduct.sku,
            batchNumber: selectedBatch.batchNumber,
            qty,
            packaging: posUomType,
            pricePerBox,
            qtyBoxes: baseUnits / tabletsPerBox,
            totalAmount,
            rack: selectedBatch.rack,
          },
        ];
      }
    });

    // Reset selection
    setSelectedProductId('');
    setSelectedBatchId('');
    setPosQtyInput(1);
  };

  const removeFromCart = (productId: string, batchNumber: string, packaging: string) => {
    setCart((prev) => prev.filter((item) => !(item.productId === productId && item.batchNumber === batchNumber && item.packaging === packaging)));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setReceipt(null);

      const paidAmount = parseFloat(paidAmountInput) || 0;

      const res = await createPOSSaleAction({
        items: cart.map((c) => ({
          productId: c.productId,
          qty: c.qty,
          packaging: c.packaging,
        })),
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || 'N/A',
        paidAmount,
        paymentMethod,
        discountAmount,
        taxAmount,
      });

      if (res.success) {
        setSuccess('POS Sale completed successfully!');
        setReceipt({
          order: res.order,
          paidAmount: res.paidAmount,
          dueAmount: res.dueAmount,
          subtotal,
          discountAmount,
          taxAmount,
          netAmount,
          paymentMethod,
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || 'N/A',
        });
        
        setShowReceiptModal(true);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setPaidAmountInput('');
        setPaymentStatusType('FULL');
        
        // Broadcast update
        broadcastUpdate('INVENTORY_UPDATE');
        broadcastUpdate('BILLING_UPDATE');
      }
    } catch (err: any) {
      setError(err.message || 'POS checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const printThermalInvoice = (receiptData: any) => {
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;

    const itemRows = receiptData.order.items?.map((item: any) => {
      const product = products.find(p => p.id === item.productId) || item.product;
      const uName = product?.name || 'Medicine';
      return `
        <tr>
          <td style="padding: 4px 0;">${uName}<br/><span style="font-size: 9px; color: #555;">SKU: ${product?.sku}</span></td>
          <td style="text-align: right; padding: 4px 0;">${item.quantity} Tab</td>
          <td style="text-align: right; padding: 4px 0;">Rs. ${(item.quantity * item.pricePerUnit).toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Thermal Receipt</title>
        <style>
          body { font-family: monospace; font-size: 11px; padding: 10px; color: #000; line-height: 1.4; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .dashed-line { border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td, th { text-align: left; vertical-align: top; font-size: 10px; }
          .right { text-align: right; }
          .invoice-title { font-size: 12px; font-weight: bold; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <div class="center bold invoice-title">MEDHUB RETAIL PHARMACY</div>
        <div class="center">B2C Sales Receipt</div>
        <div class="dashed-line"></div>
        <div><strong>Ref #:</strong> ${receiptData.order.id.substring(0, 12).toUpperCase()}</div>
        <div><strong>Date:</strong> ${new Date(receiptData.order.createdAt).toLocaleString()}</div>
        <div><strong>Customer:</strong> ${receiptData.customerName}</div>
        <div><strong>Phone:</strong> ${receiptData.customerPhone}</div>
        <div class="dashed-line"></div>
        <table>
          <thead>
            <tr style="border-bottom: 1px dashed #000;">
              <th>Item</th>
              <th class="right">Qty</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
        <div class="dashed-line"></div>
        <div class="right">
          <div>Subtotal: Rs. ${receiptData.subtotal.toLocaleString()}</div>
          ${receiptData.discountAmount > 0 ? `<div>Discount: -Rs. ${receiptData.discountAmount.toLocaleString()}</div>` : ''}
          ${receiptData.taxAmount > 0 ? `<div>Tax: Rs. ${receiptData.taxAmount.toLocaleString()}</div>` : ''}
          <div class="bold" style="font-size: 12px; margin-top: 2px;">Net Payable: Rs. ${receiptData.netAmount.toLocaleString()}</div>
          <div class="dashed-line" style="margin-left: auto; width: 50%;"></div>
          <div>Paid: Rs. ${receiptData.paidAmount.toLocaleString()}</div>
          <div class="bold">Due Amount: Rs. ${receiptData.dueAmount.toLocaleString()}</div>
        </div>
        <div class="dashed-line"></div>
        <div class="center" style="font-size: 9px;">Thank you for your visit!<br/>MedHub Pharmacy POS</div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '10px 0' }} className="pos-shell">
      
      {/* ── Main Layout grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }} className="no-print">
        
        {/* Left Column: Search & Add Products */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.01))', border: '1.5px solid rgba(245,158,11,0.2)', padding: 18, borderRadius: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>POS Billing Center</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
              Verify inventory batches and dispense directly to patients. Use the keyboard shortcuts below for rapid data entry.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Barcode Scanner Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card-bg)', padding: '12px 16px', borderRadius: 12, border: '1.5px solid #F59E0B', boxShadow: '0 2px 6px rgba(245,158,11,0.06)' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scan Barcode / SKU:</span>
              <input
                type="text"
                placeholder="Focus here & scan barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = barcodeInput.trim().toUpperCase();
                    if (!val) return;
                    const found = products.find(p => p.sku.toUpperCase() === val || p.id === val);
                    if (found) {
                      setSelectedProductId(found.id);
                      setSelectedBatchId(found.batches[0]?.id || '');
                      setBarcodeInput('');
                    } else {
                      alert(`No product found with barcode or SKU: ${val}`);
                    }
                  }
                }}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 14, fontFamily: 'monospace', fontWeight: 700 }}
              />
            </div>

            {/* Autocomplete Search input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card-bg)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--card-border)', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <Search style={{ width: 16, height: 16, color: 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search medicine by name or SKU... (Press F9)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 14 }}
              />

              {showSuggestions && searchQuery && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: 320, overflowY: 'auto', marginTop: 6 }}>
                  {filteredProducts.length === 0 ? (
                    <div style={{ padding: 14, fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>No medicines found</div>
                  ) : (
                    filteredProducts.map((p) => {
                        const totalUnits = p.batches.reduce((sum, b) => sum + b.availableBaseUnits, 0);
                        const nearestExpiry = p.batches.reduce<string | null>((min, b) => {
                          if (!min) return b.expiryDate;
                          return new Date(b.expiryDate) < new Date(min) ? b.expiryDate : min;
                        }, null);
                        const racks = [...new Set(p.batches.map(b => b.rack).filter(Boolean))] as string[];
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setSelectedBatchId(p.batches[0]?.id || '');
                              setSearchQuery('');
                              setShowSuggestions(false);
                            }}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', fontSize: 14 }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>SKU: {p.sku} · {p.category}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                                  <span style={{ fontSize: 12, background: '#F1F5F9', color: 'var(--text-secondary)', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>
                                    {p.batches.length} batch{p.batches.length !== 1 ? 'es' : ''}
                                  </span>
                                  {nearestExpiry && (
                                    <span style={{ fontSize: 12, background: new Date(nearestExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? '#FEF3C7' : '#F0FDF4', color: new Date(nearestExpiry) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? '#92400E' : '#15803D', padding: '1px 7px', borderRadius: 4, fontWeight: 700 }}>
                                      Exp: {new Date(nearestExpiry).toLocaleDateString()}
                                    </span>
                                  )}
                                  {racks.map(rack => (
                                    <span key={rack} style={{ fontSize: 12, background: '#FCD34D', color: '#78350F', padding: '1px 7px', borderRadius: 4, fontWeight: 900, fontFamily: 'monospace' }}>
                                      📍 {rack}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <span style={{ fontSize: 14, color: '#D97706', fontWeight: 700, background: '#FEF3C7', padding: '2px 8px', borderRadius: 6, flexShrink: 0, marginLeft: 10 }}>
                                {totalUnits} units
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Catalog Selector */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>1. SELECT MEDICINE</label>
              <select
                value={selectedProductId}
                onChange={(e) => { setSelectedProductId(e.target.value); setSelectedBatchId(''); }}
                style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid var(--card-border)', outline: 'none', fontSize: 14, background: 'var(--card-bg)' }}
              >
                <option value="">-- Choose Medicine --</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>2. SELECT BATCH</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  style={{ padding: '11px 14px', borderRadius: 8, border: '1px solid var(--card-border)', outline: 'none', fontSize: 14, background: 'var(--card-bg)' }}
                >
                  <option value="">-- Choose Batch --</option>
                  {selectedProduct.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      Batch {b.batchNumber} (Stock: {b.availableBaseUnits} tabs) - Exp: {new Date(b.expiryDate).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedProduct && selectedBatch && (
              <div style={{ borderTop: '1.5px solid #F1F5F9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 850, color: 'var(--text-secondary)' }}>PACKAGING UNIT (F2)</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([
                        { id: 'box', label: 'Boxes' },
                        { id: 'strip', label: 'Strips' },
                        { id: 'tablet', label: 'Tablets' }
                      ] as const).map((unit) => (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => setPosUomType(unit.id)}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: 'pointer', border: posUomType === unit.id ? 'none' : '1.5px solid #E2E8F0', background: posUomType === unit.id ? '#D97706' : '#FFFFFF', color: posUomType === unit.id ? '#FFFFFF' : '#475569', transition: 'all 0.15s' }}
                        >
                          {unit.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 850, color: 'var(--text-secondary)' }}>QTY (F3)</label>
                    <input
                      id="pos-qty-input"
                      type="number"
                      min="1"
                      value={posQtyInput}
                      onChange={(e) => setPosQtyInput(parseInt(e.target.value) || 1)}
                      style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--card-border)', fontSize: 14, outline: 'none' }}
                    />
                  </div>
                </div>
                {selectedBatch.rack && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FEF3C7', border: '1.5px solid #FDE68A', borderRadius: 8 }}>
                    <svg style={{ width: 13, height: 13, color: '#B45309', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#92400E' }}>Rack Location:</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#B45309', fontFamily: 'monospace', background: '#FCD34D', padding: '1px 8px', borderRadius: 6 }}>{selectedBatch.rack}</span>
                  </div>
                )}
                <button
                  id="add-to-basket-btn"
                  type="button"
                  onClick={handleAddToBasket}
                  style={{ background: '#D97706', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#B45309')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#D97706')}
                >
                  Dispense to Basket (F1)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Checkout Basket */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {cart.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', padding: '90px 24px', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
              <ShoppingBag style={{ width: 44, height: 44, color: '#E2E8F0', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Basket is Empty</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>Select products on the left side to compile patient bill</p>
            </div>
          ) : (
            <form id="pos-checkout-form" onSubmit={handleCheckout} style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                <ShoppingBag style={{ width: 18, height: 18, color: '#D97706' }} />
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Dispensed Items Basket</h3>
              </div>

              {/* List items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--table-header-bg)', borderRadius: 10, fontSize: 14, border: '1px solid #F1F5F9' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Batch: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.batchNumber}</span>
                      </div>
                      {item.rack && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#92400E' }}>RACK:</span>
                          <span style={{ fontSize: 12, fontWeight: 900, fontFamily: 'monospace', background: '#FCD34D', color: '#78350F', padding: '0px 6px', borderRadius: 4 }}>{item.rack}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Quantity adjustments */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '2px 4px' }}>
                        <button type="button" onClick={() => adjustCartItemQty(item.productId, item.batchNumber, item.packaging, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px', fontWeight: 850, color: 'var(--text-secondary)' }}>-</button>
                        <span style={{ fontSize: 11, fontWeight: 800, minWidth: 20, textAlign: 'center' }}>{item.qty} {item.packaging[0]}</span>
                        <button type="button" onClick={() => adjustCartItemQty(item.productId, item.batchNumber, item.packaging, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px', fontWeight: 850, color: 'var(--text-secondary)' }}>+</button>
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--text-primary)', minWidth: 70, textAlign: 'right' }}>Rs. {item.totalAmount.toLocaleString()}</span>
                      <button type="button" onClick={() => removeFromCart(item.productId, item.batchNumber, item.packaging)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals, Tax, discount */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <span>Subtotal:</span>
                  <span>Rs. {subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 800 }}>DISCOUNT (%)</label>
                    <input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--card-border)', fontSize: 14, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 800 }}>TAX / VAT (%)</label>
                    <input type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--card-border)', fontSize: 14, outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 950, fontSize: 16, borderTop: '1px solid #F1F5F9', paddingTop: 10, marginTop: 4 }}>
                  <span>Net Payable:</span>
                  <span style={{ color: '#D97706' }}>Rs. {netAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Customer Information */}
              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Patient Name (F4)</label>
                    <input id="patient-name-input" type="text" placeholder="Walk-in Patient" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 14, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Patient Phone</label>
                    <input type="text" placeholder="N/A" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 14, outline: 'none' }} />
                  </div>
                </div>

                {/* Payment Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>PAYMENT STATE (F7)</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {([
                      { id: 'FULL', label: 'Full Pay' },
                      { id: 'HALF', label: 'Half Pay' },
                      { id: 'UNPAID', label: 'Unpaid / Credit' }
                    ] as const).map((pay) => (
                      <button
                        key={pay.id}
                        type="button"
                        onClick={() => setPaymentStatusType(pay.id)}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 11, fontWeight: 850, cursor: 'pointer', border: paymentStatusType === pay.id ? 'none' : '1.5px solid #E2E8F0', background: paymentStatusType === pay.id ? '#10B981' : '#FFFFFF', color: paymentStatusType === pay.id ? '#FFFFFF' : '#475569', transition: 'all 0.15s' }}
                      >
                        {pay.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Payment Method (F8)</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 14, background: 'var(--card-bg)', outline: 'none' }}>
                      <option value="CASH">CASH</option>
                      <option value="MOBILE_BANKING">MOBILE BANKING / QR</option>
                      <option value="CARD">CARD</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>Paid Amount (Rs.)</label>
                    <input
                      type="number"
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: '#FFFFFF', border: 'none', padding: '13px', borderRadius: 10, fontWeight: 950, fontSize: 14, cursor: 'pointer', marginTop: 8, boxShadow: '0 4px 14px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <DollarSign style={{ width: 16, height: 16 }} />
                {loading ? 'Processing POS Sale…' : 'Finalize POS Checkout (Ctrl+Enter)'}
              </button>
            </form>
          )}

          {error && (
            <div style={{ display: 'flex', gap: 8, padding: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 8, color: '#EF4444', fontSize: 14, fontWeight: 600 }}>
              <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Keyboard Shortcuts Status Bar ── */}
      <div style={{ background: '#1E293B', borderRadius: 12, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, color: 'var(--text-muted)', fontSize: 11, fontWeight: 700 }} className="no-print">
        <span style={{ color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Keyboard Shortcuts:</span>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><kbd style={{ background: '#334155', color: '#F8FAFC', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>F9</kbd> Search</span>
          <span><kbd style={{ background: '#334155', color: '#F8FAFC', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>F1</kbd> Add Item</span>
          <span><kbd style={{ background: '#334155', color: '#F8FAFC', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>F2</kbd> Unit</span>
          <span><kbd style={{ background: '#334155', color: '#F8FAFC', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>F3</kbd> Qty</span>
          <span><kbd style={{ background: '#334155', color: '#F8FAFC', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>F4</kbd> Patient</span>
          <span><kbd style={{ background: '#334155', color: '#F8FAFC', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>F7</kbd> Full Pay</span>
          <span><kbd style={{ background: '#334155', color: '#F8FAFC', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>F8</kbd> Method</span>
          <span><kbd style={{ background: '#334155', color: '#F8FAFC', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>Ctrl+Enter</kbd> Checkout</span>
        </div>
      </div>

      {/* Receipt Print Preview Modal */}
      {showReceiptModal && receipt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'var(--card-bg)', borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
            
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>POS Receipt Preview</span>
              <button onClick={() => setShowReceiptModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ padding: 20, background: 'var(--table-header-bg)', flex: 1, overflowY: 'auto' }}>
              {/* Styled receipt */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: 20, fontFamily: 'monospace', color: '#000', fontSize: 11, borderRadius: 8 }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>MEDHUB RETAIL PHARMACY</div>
                <div style={{ textAlign: 'center', fontSize: 12, borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 12 }}>B2C COUNTER SALE INVOICE</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                  <div><strong>Ref ID:</strong> {receipt.order.id.substring(0, 12).toUpperCase()}</div>
                  <div><strong>Date:</strong> {new Date(receipt.order.createdAt).toLocaleString()}</div>
                  <div><strong>Patient:</strong> {receipt.customerName}</div>
                  {receipt.customerPhone && <div><strong>Phone:</strong> {receipt.customerPhone}</div>}
                  <div><strong>Payment:</strong> {receipt.paymentMethod}</div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px dashed #000' }}>
                      <th style={{ textAlign: 'left', padding: '4px 0' }}>Medicine</th>
                      <th style={{ textAlign: 'right', padding: '4px 0' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.order.items?.map((item: any, idx: number) => {
                      const product = products.find(p => p.id === item.productId) || item.product;
                      return (
                        <tr key={idx}>
                          <td style={{ padding: '4px 0' }}>{product?.name || 'Medicine'}</td>
                          <td style={{ textAlign: 'right', padding: '4px 0' }}>{item.quantity} Tab</td>
                          <td style={{ textAlign: 'right', padding: '4px 0' }}>Rs. ${(item.quantity * item.pricePerUnit).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={{ textAlign: 'right', borderTop: '1px dashed #000', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div>Subtotal: Rs. {receipt.subtotal.toLocaleString()}</div>
                  {receipt.discountAmount > 0 && <div style={{ color: 'red' }}>Discount: -Rs. {receipt.discountAmount.toLocaleString()}</div>}
                  {receipt.taxAmount > 0 && <div>Tax (13%): Rs. {receipt.taxAmount.toLocaleString()}</div>}
                  <div style={{ fontWeight: 'bold', fontSize: 14, marginTop: 4 }}>Grand Total: Rs. {receipt.netAmount.toLocaleString()}</div>
                  <div style={{ borderTop: '1px dashed #000', margin: '4px 0 2px', width: '60%', marginLeft: 'auto' }}></div>
                  <div style={{ color: '#10B981' }}>Paid: Rs. {receipt.paidAmount.toLocaleString()}</div>
                  {receipt.dueAmount > 0 && <div style={{ color: 'red', fontWeight: 'bold' }}>Due: Rs. {receipt.dueAmount.toLocaleString()}</div>}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReceiptModal(false)} style={{ flex: 1, padding: 11, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Close
              </button>
              <button onClick={() => printThermalInvoice(receipt)} style={{ flex: 2, padding: 11, borderRadius: 8, border: 'none', background: '#10B981', color: '#FFFFFF', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Printer style={{ width: 14, height: 14 }} />
                Print Voucher
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
