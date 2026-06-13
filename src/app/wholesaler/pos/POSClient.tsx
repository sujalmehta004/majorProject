'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Receipt, ShoppingBag, User, Phone, Search, Plus, Trash2, Printer, 
  CheckCircle, AlertCircle, RefreshCw, Barcode, Minimize2, ArrowLeft, ArrowRight, X, Percent, DollarSign, Bookmark, Layers
} from 'lucide-react';
import { logActivity } from '@/components/WholesalerLayout';

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

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  availableBaseUnits: number;
  purchasePricePerBox?: number;
  sellingPricePerBox?: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
  tierPricingJson: string;
  batches: Batch[];
}

interface Profile {
  id: string;
  companyName: string;
  taxId: string;
  address: string;
  phone: string;
  registrationNumber: string | null;
  contactPerson: string | null;
  latitude: number | null;
  longitude: number | null;
  customFieldsJson?: string | null;
}

interface CartItem {
  product: Product;
  qtyBoxes: number;
  selectedBatchId: string;
  pricePerBox: number;
}

interface POSClientProps {
  profile: Profile;
  products: Product[];
}

export default function POSClient({ profile, products }: POSClientProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Customers List States
  const [registeredCustomers, setRegisteredCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerSearchDropdown, setShowCustomerSearchDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Modal forms
  const [newPharmacyName, setNewPharmacyName] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  
  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  
  // Pricing mode: false = use flat selling price, true = apply volume tier pricing
  const [useTierPricing, setUseTierPricing] = useState(false);
  
  // Advanced Ingestion Quantities & UOM
  const [posUomType, setPosUomType] = useState<'BOXES' | 'STRIPS' | 'TABLETS'>('BOXES');
  const [posQtyInput, setPosQtyInput] = useState(1);

  // Advanced POS Settlement State
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MOBILE_BANKING' | 'CARD'>('CASH');
  const [paymentPaidAmt, setPaymentPaidAmt] = useState('');
  const [paymentFullyPaid, setPaymentFullyPaid] = useState(true);

  // Custom Discount and VAT/Tax inputs
  const [discountPercent, setDiscountPercent] = useState('0');
  const [taxPercent, setTaxPercent] = useState('13'); // default 13% VAT

  // Statuses
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [finalizedOrder, setFinalizedOrder] = useState<any | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const medicineSearchRef = useRef<HTMLDivElement>(null);

  // Settle drawer for unpaid invoice
  const [unpaidSettleOrder, setUnpaidSettleOrder] = useState<any | null>(null);
  const [unpaidPaidAmount, setUnpaidPaidAmount] = useState('');

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/wholesaler/customers');
      const data = await res.json();
      if (data.success) {
        setRegisteredCustomers(data.customers || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Click outside listener
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerSearchDropdown(false);
      }
      if (medicineSearchRef.current && !medicineSearchRef.current.contains(e.target as Node)) {
        setShowMedicineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    try {
      const res = await fetch('/api/wholesaler/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyName: newPharmacyName,
          fullName: newContactName,
          phone: newPhone,
          email: newEmail,
          address: newAddress,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');

      setModalSuccess('Customer created successfully.');
      setSelectedCustomerId(data.customer.id);
      setCustomerSearchQuery(data.customer.pharmacyName);
      
      // Refresh list
      await fetchCustomers();

      // Clear form
      setNewPharmacyName('');
      setNewContactName('');
      setNewPhone('');
      setNewEmail('');
      setNewAddress('');

      setTimeout(() => {
        setShowAddCustomerModal(false);
        setModalSuccess('');
      }, 1000);
    } catch (err: any) {
      setModalError(err.message);
    }
  };

  // Filter products for dropdown autocomplete
  const filteredProducts = searchTerm
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const filteredCustomers = customerSearchQuery
    ? registeredCustomers.filter(c =>
        c.pharmacyName.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        c.phone.includes(customerSearchQuery)
      )
    : registeredCustomers;

  // Evaluate tiered pricing per Box — falls back to batch sellingPricePerBox, not a hardcoded value
  const getPricePerBox = (product: Product, qty: number) => {
    // Determine base selling price from the earliest (recommended) batch
    const sortedBatches = [...product.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    const activeBatch = sortedBatches.find(b => b.availableBaseUnits > 0);
    const baseSellPrice = activeBatch?.sellingPricePerBox ?? (sortedBatches[0]?.sellingPricePerBox ?? 0);

    // When flat pricing mode is active, always return the selling price directly
    if (!useTierPricing) return baseSellPrice;

    let price = baseSellPrice;
    try {
      const tiers = JSON.parse(product.tierPricingJson || '[]');
      const matchingTier = tiers.find(
        (t: any) => qty >= t.minQty && qty <= (t.maxQty || 999999)
      );
      if (matchingTier) {
        price = matchingTier.pricePerBox;
      }
      // If no tier matched, keep base selling price
    } catch (e) {
      console.error('Failed to evaluate price tiers', e);
    }
    return price;
  };

  // Add to basket
  const addToCart = (product: Product, inputQty: number, targetBatchId?: string) => {
    setError('');
    const sortedBatches = [...product.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    const fallbackBatch = sortedBatches.find(b => b.availableBaseUnits > 0);
    const batchId = targetBatchId || fallbackBatch?.id || '';
    
    if (!batchId) {
      setError(`No active stock batches found for "${product.name}".`);
      return;
    }

    const tabletsPerBox = product.tabletsPerStrip * product.stripsPerBox;
    
    // Convert input quantity depending on chosen UOM to fractional boxes count
    let qtyBoxes = inputQty;
    if (posUomType === 'STRIPS') {
      qtyBoxes = inputQty / product.stripsPerBox;
    } else if (posUomType === 'TABLETS') {
      qtyBoxes = inputQty / tabletsPerBox;
    }

    const pricePerBox = getPricePerBox(product, qtyBoxes);
    const existing = cart.find(item => item.product.id === product.id && item.selectedBatchId === batchId);
    const totalQty = existing ? existing.qtyBoxes + qtyBoxes : qtyBoxes;

    const selectedBatch = product.batches.find(b => b.id === batchId);
    if (!selectedBatch) return;

    const availableBoxes = selectedBatch.availableBaseUnits / tabletsPerBox;

    if (totalQty > availableBoxes) {
      setError(`Only ${availableBoxes.toFixed(1)} boxes available in selected batch ${selectedBatch.batchNumber} for "${product.name}".`);
      return;
    }

    if (existing) {
      setCart(cart.map(item => 
        (item.product.id === product.id && item.selectedBatchId === batchId)
          ? { ...item, qtyBoxes: totalQty, pricePerBox: getPricePerBox(product, totalQty) }
          : item
      ));
    } else {
      setCart([...cart, { product, qtyBoxes, selectedBatchId: batchId, pricePerBox }]);
    }

    // Reset inputs
    setSearchTerm('');
    setSelectedProductId('');
    setSelectedBatchId('');
    setPosQtyInput(1);
    setPosUomType('BOXES');
    logActivity('POS_ADD_ITEM', `Added ${inputQty} ${posUomType.toLowerCase()} of ${product.name} to POS cart`);
  };

  // Barcode quick submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!barcodeInput) return;

    const matched = products.find(p => p.sku.toLowerCase() === barcodeInput.toLowerCase().trim());
    if (matched) {
      addToCart(matched, 1);
      setBarcodeInput('');
      setSuccessMsg(`Barcode "${matched.sku}" matched and added to checkout.`);
      setTimeout(() => setSuccessMsg(''), 2000);
    } else {
      setError(`Barcode / SKU "${barcodeInput}" not found in inventory.`);
      setBarcodeInput('');
    }
  };

  const removeFromCart = (productId: string, batchId: string) => {
    setCart(cart.filter(item => !(item.product.id === productId && item.selectedBatchId === batchId)));
  };

  const updateCartQty = (productId: string, batchId: string, newQty: number) => {
    setError('');
    if (newQty <= 0) {
      removeFromCart(productId, batchId);
      return;
    }

    const item = cart.find(c => c.product.id === productId && c.selectedBatchId === batchId);
    if (!item) return;

    const targetBatch = item.product.batches.find(b => b.id === batchId);
    if (!targetBatch) return;

    const tabletsPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
    const availableBoxes = Math.floor(targetBatch.availableBaseUnits / tabletsPerBox);

    if (newQty > availableBoxes) {
      setError(`Only ${availableBoxes} boxes available in batch ${targetBatch.batchNumber} for "${item.product.name}".`);
      return;
    }

    setCart(cart.map(c => 
      (c.product.id === productId && c.selectedBatchId === batchId)
        ? { ...c, qtyBoxes: newQty, pricePerBox: getPricePerBox(c.product, newQty) }
        : c
    ));
  };

  // Calculate totals
  const getSubtotal = () => {
    return cart.reduce((acc, item) => acc + (item.pricePerBox * item.qtyBoxes), 0);
  };

  const calculateFinalSummary = () => {
    const subtotal = getSubtotal();
    const discPct = parseFloat(discountPercent) || 0;
    const taxPct = parseFloat(taxPercent) || 0;

    const discountAmount = subtotal * (discPct / 100);
    const taxAmount = (subtotal - discountAmount) * (taxPct / 100);
    const netAmount = subtotal - discountAmount + taxAmount;

    return { subtotal, discountAmount, taxAmount, netAmount };
  };

  const { subtotal, discountAmount, taxAmount, netAmount } = calculateFinalSummary();

  // Checkout POST
  const handleCheckout = async () => {
    setError('');
    setLoading(true);
    try {
      const checkoutItems = cart.map(item => ({
        productId: item.product.id,
        qtyBoxes: item.qtyBoxes,
        batchId: item.selectedBatchId
      }));

      const actualPaid = paymentFullyPaid ? netAmount : (parseFloat(paymentPaidAmt) || 0);

      const res = await fetch('/api/wholesaler/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems,
          customerName: selectedCustomerId ? undefined : customerName,
          customerPhone: selectedCustomerId ? undefined : customerPhone,
          retailerId: selectedCustomerId || undefined,
          discountAmount,
          netAmount,
          paidAmount: actualPaid,
          paymentMethod
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete sale.');

      setSuccessMsg('POS Counter transaction completed successfully.');
      // Merge payment info (returned separately from API, not on the Order model) into the order object
      setFinalizedOrder({ ...data.order, paidAmount: data.paidAmount ?? data.order.netAmount, dueAmount: data.dueAmount ?? 0, paymentMethod: data.paymentMethod ?? 'CASH' });

      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setSelectedCustomerId('');
      setCustomerSearchQuery('');
      setPaymentPaidAmt('');
      setPaymentFullyPaid(true);
      setPaymentMethod('CASH');
      logActivity('POS_CHECKOUT_COMPLETE', `Finalized POS Cash order INV-${data.order.id.substring(0,8).toUpperCase()} via ${paymentMethod}. Paid Rs. ${actualPaid}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred during cashier checkout.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!finalizedOrder) return;
    const order = finalizedOrder;
    const customerName = order.retailer?.pharmacyName === "Walk-in Customer (POS)" 
      ? getWalkInName(order.overrideJustification) 
      : (order.retailer?.pharmacyName || 'Walk-in Customer');
    const customerPhone = order.retailer?.pharmacyName === "Walk-in Customer (POS)" 
      ? getWalkInPhone(order.overrideJustification) 
      : (order.retailer?.phone || '');
    
    const itemRows = order.items.map((item: any) => {
      const totalPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
      const qtyBoxes = item.quantity / totalPerBox;
      const pricePerBox = item.pricePerUnit * totalPerBox;
      return `<tr>
        <td style="padding:8px 4px;border-bottom:1px solid #E2E8F0;">${item.product.name} (${item.product.sku})</td>
        <td style="padding:8px 4px;border-bottom:1px solid #E2E8F0;text-align:center;">${qtyBoxes} boxes</td>
        <td style="padding:8px 4px;border-bottom:1px solid #E2E8F0;text-align:right;">Rs. ${pricePerBox.toFixed(2)}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:700;">Rs. ${(item.quantity * item.pricePerUnit).toFixed(2)}</td>
      </tr>`;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>TAX INVOICE - POS-${order.id.substring(0, 8).toUpperCase()}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1E293B; padding: 20px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #F8FAFC; padding: 10px; border-radius: 8px; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th { padding: 6px; background: #F1F5F9; border-bottom: 1px solid #000; font-size: 10px; }
    td { padding: 6px; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-inner { width: 50%; display: flex; flex-direction: column; gap: 4px; font-family: monospace; }
    .row { display: flex; justify-content: space-between; }
    .net-due { font-weight: 900; font-size: 13px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:16px;font-weight:900;">${profile.companyName}</div>
      <div>${profile.address}</div>
      <div>Phone: ${profile.phone}</div>
    </div>
    <div style="text-align:right;">
      <h2>TAX INVOICE</h2>
      <div>PAN / VAT ID: ${profile.taxId}</div>
    </div>
  </div>
  <div class="grid">
    <div>
      <strong>Billed Customer:</strong>
      <div>${customerName}</div>
      ${customerPhone ? `<div>Phone: ${customerPhone}</div>` : ''}
    </div>
    <div>
      <strong>Invoice details:</strong>
      <div>Ref: POS-${order.id.substring(0, 8).toUpperCase()}</div>
      <div>Date: ${new Date(order.createdAt).toLocaleString()}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Item</th>
        <th>Qty</th>
        <th style="text-align:right;">Rate</th>
        <th style="text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>
  <div class="totals">
    <div class="totals-inner">
      <div class="row"><span>Subtotal:</span><span>Rs. ${order.totalAmount.toFixed(2)}</span></div>
      <div class="row"><span>Discount:</span><span>- Rs. ${order.discountAmount.toFixed(2)}</span></div>
      <div class="row"><span>VAT/Tax:</span><span>+ Rs. ${((order.netAmount - order.totalAmount) > 0 ? (order.netAmount - order.totalAmount) : 0).toFixed(2)}</span></div>
      <div class="net-due"><span>NET TOTAL:</span><span>Rs. ${order.netAmount.toFixed(2)}</span></div>
      <div class="row" style="color:#059669;font-weight:700;"><span>Amount Paid (${order.paymentMethod || 'CASH'}):</span><span>Rs. ${(order.paidAmount ?? order.netAmount).toFixed(2)}</span></div>
      ${(order.dueAmount ?? 0) > 0 ? `<div class="row" style="color:#DC2626;font-weight:700;"><span>Due Balance:</span><span>Rs. ${(order.dueAmount).toFixed(2)}</span></div>` : ''}
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 300);
    };
  </script>
</body>
</html>`;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  // Parse custom fields
  let customFields: Array<{ label: string; value: string }> = [];
  if (profile.customFieldsJson) {
    try {
      customFields = JSON.parse(profile.customFieldsJson);
    } catch (e) {
      console.error('Failed to parse profile custom fields', e);
    }
  }

  // Derive the full product object from the ID
  const selectedProduct = products.find(p => p.id === selectedProductId) ?? null;

  // Selected product batch info
  const selectedProductBatches = selectedProduct
    ? [...selectedProduct.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
    : [];

  return (
    <div className="space-y-6 animate-fadeIn" style={{ maxWidth: 1280 }}>
      {/* Page Header */}
      <div
        className="no-print"
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(14,165,233,0.2)', borderRadius: 20,
          padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.07)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ShoppingBag style={{ width: 22, height: 22, color: '#0EA5E9' }} />
            POS Terminal & Cash Register
          </h1>
          <p style={{ fontSize: 12, color: '#64748B' }}>Process walk-in physical customer sales and print standard A4 billing receipts.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-600 text-xs rounded-2xl flex items-center gap-2 font-mono no-print">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 border border-emerald-200 bg-emerald-50 text-emerald-600 text-xs rounded-2xl flex items-center gap-2 font-mono no-print">
          <CheckCircle className="w-4 h-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* ── TWO-PANEL CASHIER LAYOUT ── */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 400px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* ════════════════════════════════════════
            LEFT PANEL — Customer + Catalog Forms
            ════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Customer selection */}
          <div style={{ background: 'rgba(255,255,255,0.92)', border: '1.5px solid rgba(14,165,233,0.15)', borderRadius: 20, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 14 }}>
              <h3 style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User style={{ width: 15, height: 15, color: '#0EA5E9' }} /> Customer Selection
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                style={{ fontSize: 10, fontWeight: 800, color: '#0EA5E9', border: '1px solid #BAE6FD', background: '#F0F9FF', borderRadius: 7, padding: '3px 10px', cursor: 'pointer' }}
              >
                ＋ New Customer
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div ref={customerSearchRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 5 }}>Search Customer Pharmacy</label>
                {selectedCustomerId ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 10, padding: '8px 12px' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0284C7' }}>
                        {registeredCustomers.find(c => c.id === selectedCustomerId)?.pharmacyName}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                        Phone: {registeredCustomers.find(c => c.id === selectedCustomerId)?.phone}
                      </div>
                    </div>
                    <button onClick={() => { setSelectedCustomerId(''); setCustomerSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => { setCustomerSearchQuery(e.target.value); setShowCustomerSearchDropdown(true); }}
                      onFocus={() => setShowCustomerSearchDropdown(true)}
                      placeholder="Type to search customers..."
                      className="input-crisp"
                      style={{ width: '100%', fontSize: 12 }}
                    />
                    {showCustomerSearchDropdown && filteredCustomers.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1.5px solid #BAE6FD', borderRadius: 10, boxShadow: '0 8px 24px rgba(14,165,233,0.15)', zIndex: 20, maxHeight: 150, overflowY: 'auto' }}>
                        <button
                          onClick={() => { setSelectedCustomerId(''); setCustomerSearchQuery(''); setShowCustomerSearchDropdown(false); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold', color: '#475569' }}
                        >
                          -- Walk-in Cash Customer --
                        </button>
                        {filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCustomerId(c.id); setCustomerSearchQuery(c.pharmacyName); setShowCustomerSearchDropdown(false); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F0F9FF')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{c.pharmacyName}</div>
                            <div style={{ fontSize: 10, color: '#64748B' }}>Phone: {c.phone}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {!selectedCustomerId && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Walk-in Name</label>
                    <input type="text" placeholder="John Doe" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-crisp" style={{ fontSize: 11, padding: 6, width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Walk-in Phone</label>
                    <input type="text" placeholder="98XXXXXXXX" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input-crisp" style={{ fontSize: 11, padding: 6, width: '100%' }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Barcode Scanner */}
          <div style={{ background: 'rgba(255,255,255,0.92)', border: '1.5px solid rgba(14,165,233,0.15)', borderRadius: 20, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 12 }}>
              <Barcode style={{ width: 15, height: 15, color: '#0EA5E9' }} /> Barcode Scanner / SKU Quick Ingest
            </h3>
            <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan medicine barcode or type exact SKU..."
                className="input-crisp"
                style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: 12 }}
              />
              <button type="submit" className="btn-primary" style={{ padding: '10px 20px', fontSize: 11 }}>Ingest</button>
            </form>
          </div>

          {/* Medicine Autocomplete Finder */}
          <div style={{ background: 'rgba(255,255,255,0.92)', border: '1.5px solid rgba(14,165,233,0.15)', borderRadius: 20, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 14 }}>
              <h3 style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search style={{ width: 15, height: 15, color: '#F97316' }} /> Medicine Catalog Finder
              </h3>
              {/* Pricing Mode Toggle */}
              <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => setUseTierPricing(false)}
                  style={{
                    padding: '4px 10px', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    background: !useTierPricing ? 'white' : 'transparent',
                    color: !useTierPricing ? '#0EA5E9' : '#64748B',
                    boxShadow: !useTierPricing ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Flat Price
                </button>
                <button
                  type="button"
                  onClick={() => setUseTierPricing(true)}
                  style={{
                    padding: '4px 10px', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                    background: useTierPricing ? 'white' : 'transparent',
                    color: useTierPricing ? '#F97316' : '#64748B',
                    boxShadow: useTierPricing ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Tier Pricing
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div ref={medicineSearchRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Search Medicine SKU/Name</label>
                {selectedProduct ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 10, padding: '8px 12px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0284C7' }}>{selectedProduct.name} [{selectedProduct.sku}]</div>
                    <button onClick={() => { setSelectedProductId(''); setSelectedBatchId(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setShowMedicineDropdown(true); }}
                      onFocus={() => setShowMedicineDropdown(true)}
                      placeholder="Type to show suggestions..."
                      className="input-crisp"
                      style={{ width: '100%', fontSize: 12 }}
                    />
                    {showMedicineDropdown && filteredProducts.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1.5px solid #BAE6FD', borderRadius: 10, boxShadow: '0 8px 24px rgba(14,165,233,0.15)', zIndex: 20, maxHeight: 200, overflowY: 'auto' }}>
                        {filteredProducts.map(p => {
                          const tabletsPerBox = p.tabletsPerStrip * p.stripsPerBox;
                          return (
                            <button
                              key={p.id}
                              onClick={() => { setSelectedProductId(p.id); setSearchTerm(''); setShowMedicineDropdown(false); }}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', fontFamily: 'inherit' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F0F9FF')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{p.name}</div>
                              <div style={{ fontSize: 10, color: '#64748B', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                                <div>SKU: {p.sku}</div>
                                {p.batches && p.batches.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 4, borderLeft: '2px solid #E2E8F0', marginTop: 2 }}>
                                    {p.batches.map((b: any) => {
                                      const bx = Math.floor(b.availableBaseUnits / tabletsPerBox);
                                      const remaining = b.availableBaseUnits % tabletsPerBox;
                                      const st = Math.floor(remaining / p.tabletsPerStrip);
                                      const tb = remaining % p.tabletsPerStrip;
                                      const expStr = new Date(b.expiryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                                      return (
                                        <span key={b.id} style={{ fontSize: 9, color: '#475569' }}>
                                          Batch: <strong>{b.batchNumber}</strong> | Stock: {bx} Bx, {st} St, {tb} Tb | Exp: {expStr}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 9, color: '#EF4444' }}>Out of Stock</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Batch Allocation (Expiry Suggested)</label>
                <select
                  disabled={!selectedProductId}
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="input-crisp"
                  style={{ width: '100%', fontSize: 12 }}
                >
                  <option value="">-- Choose batch --</option>
                  {selectedProductBatches.map((b, idx) => {
                    const totalBox = Math.floor(b.availableBaseUnits / (selectedProduct!.tabletsPerStrip * selectedProduct!.stripsPerBox));
                    return (
                      <option key={b.id} value={b.id}>
                        {b.batchNumber} (Exp: {new Date(b.expiryDate).toLocaleDateString()}) - {totalBox} boxes {idx === 0 ? '⭐ Recommended' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Selected Medicine Info Box */}
            {selectedProduct && (() => {
              const latestBatch = selectedProduct.batches?.length > 0 ? selectedProduct.batches[selectedProduct.batches.length - 1] : null;
              const buyPrice = latestBatch ? latestBatch.purchasePricePerBox : 'N/A';
              const defaultSellPrice = latestBatch ? latestBatch.sellingPricePerBox : 100;
              const tiers = JSON.parse(selectedProduct.tierPricingJson || '[]');

              return (
                <div style={{ marginTop: 14, background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: 10, padding: 12, fontSize: 11 }}>
                  <div style={{ fontWeight: 800, color: '#C2410C', marginBottom: 6 }}>Selected Medicine Price Sheet:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>Buying Price: <strong>Rs. {buyPrice}</strong></div>
                    <div>Default Selling Price: <strong>Rs. {defaultSellPrice}</strong></div>
                  </div>
                  {tiers.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 700, color: '#EA580C', marginBottom: 4 }}>Volume Pricing Tiers:</div>
                      {tiers.map((t: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 6, color: '#7C2D12', fontSize: 10 }}>
                          <span>{t.minQty}-{t.maxQty || '∞'} boxes:</span>
                          <span style={{ fontWeight: 700 }}>Rs. {t.pricePerBox} / box</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {selectedProductId && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={posQtyInput}
                      onChange={(e) => setPosQtyInput(parseInt(e.target.value) || 1)}
                      onFocus={(e) => e.target.select()}
                      className="input-crisp"
                      style={{ width: 80, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>UOM Choice</label>
                    <select
                      value={posUomType}
                      onChange={(e) => setPosUomType(e.target.value as any)}
                      className="select-crisp"
                      style={{ paddingRight: 28, fontSize: 11 }}
                    >
                      <option value="BOXES">Boxes</option>
                      <option value="STRIPS">Strips</option>
                      <option value="TABLETS">Tablets</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedProduct) addToCart(selectedProduct, posQtyInput, selectedBatchId);
                  }}
                  className="btn-primary"
                  style={{ padding: '10px 24px', fontSize: 11 }}
                >
                  ➕ Add to Cart
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════
            RIGHT PANEL — Cart / Checkout Basket
            ════════════════════════════════════════ */}
        <div style={{ position: 'sticky', top: 20 }}>
          <div style={{
            background: 'rgba(255,255,255,0.95)',
            border: '1.5px solid rgba(14,165,233,0.2)',
            borderRadius: 20,
            boxShadow: '0 4px 24px rgba(14,165,233,0.08)',
            overflow: 'hidden',
          }}>
            {/* Basket Header */}
            <div style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag style={{ width: 18, height: 18, color: 'white' }} />
              <span style={{ fontSize: 12, fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Checkout Basket</span>
              {cart.length > 0 && (
                <span style={{ marginLeft: 'auto', background: 'white', color: '#0EA5E9', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 900 }}>
                  {cart.length} item{cart.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cart.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>
                  <ShoppingBag style={{ width: 32, height: 32, color: '#E2E8F0', margin: '0 auto 10px' }} />
                  <div>Basket is empty.</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Scan a barcode or search medicines.</div>
                </div>
              ) : (
                <>
                  {/* Cart Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 2 }}>
                    {cart.map((item) => {
                      const batchNum = item.product.batches.find(b => b.id === item.selectedBatchId)?.batchNumber || 'N/A';
                      return (
                        <div key={`${item.product.id}-${item.selectedBatchId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px 10px', borderRadius: 10 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</div>
                            <div style={{ fontSize: 9, color: '#64748B' }}>Batch: {batchNum}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <input
                              type="number"
                              min="1"
                              value={item.qtyBoxes}
                              onChange={(e) => updateCartQty(item.product.id, item.selectedBatchId, parseInt(e.target.value) || 1)}
                              onFocus={(e) => e.target.select()}
                              style={{ width: 44, textAlign: 'center', fontSize: 11, padding: '3px 4px', border: '1px solid #E2E8F0', borderRadius: 6, fontFamily: 'monospace' }}
                            />
                            <span style={{ fontSize: 9, color: '#94A3B8' }}>bx</span>
                            <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#1E293B', minWidth: 70, textAlign: 'right' }}>Rs. {(item.pricePerBox * item.qtyBoxes).toLocaleString()}</div>
                            <button onClick={() => removeFromCart(item.product.id, item.selectedBatchId)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 2 }}>
                              <Trash2 style={{ width: 13, height: 13 }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Discount & Tax */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 10, borderTop: '1px dashed #E2E8F0' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Discount %</label>
                      <input
                        type="number" min="0" max="100" value={discountPercent}
                        onChange={e => setDiscountPercent(e.target.value)}
                        className="input-crisp" style={{ fontSize: 11, padding: 4, width: '100%', textAlign: 'center' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>VAT / Tax %</label>
                      <input
                        type="number" min="0" max="100" value={taxPercent}
                        onChange={e => setTaxPercent(e.target.value)}
                        className="input-crisp" style={{ fontSize: 11, padding: 4, width: '100%', textAlign: 'center' }}
                      />
                    </div>
                  </div>

                  {/* Payment Method & Settlement */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Pay Method</label>
                      <select
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value as any)}
                        className="select-crisp"
                        style={{ fontSize: 11, padding: '4px 20px 4px 8px', width: '100%' }}
                      >
                        <option value="CASH">💵 Cash</option>
                        <option value="MOBILE_BANKING">📱 Mobile Banking</option>
                        <option value="CARD">💳 Card Payment</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Full Settle?</label>
                      <select
                        value={paymentFullyPaid ? 'YES' : 'NO'}
                        onChange={e => setPaymentFullyPaid(e.target.value === 'YES')}
                        className="select-crisp"
                        style={{ fontSize: 11, padding: '4px 20px 4px 8px', width: '100%' }}
                      >
                        <option value="YES">Fully Paid</option>
                        <option value="NO">Partial Payment</option>
                      </select>
                    </div>
                  </div>

                  {!paymentFullyPaid && (
                    <div>
                      <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Amount Paid Today (Rs.)</label>
                      <input
                        type="number"
                        placeholder="e.g. 500"
                        value={paymentPaidAmt}
                        onChange={e => setPaymentPaidAmt(e.target.value)}
                        className="input-crisp"
                        style={{ fontSize: 12, padding: '7px 10px', width: '100%' }}
                      />
                    </div>
                  )}

                  {/* Order Summary */}
                  <div style={{ background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)', border: '1px solid #BAE6FD', borderRadius: 12, padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                      <span>Gross Value:</span><span>Rs. {subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
                      <span>Discount ({discountPercent}%):</span><span>− Rs. {discountAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                      <span>VAT / Tax ({taxPercent}%):</span><span>+ Rs. {taxAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, color: '#1E293B', borderTop: '1.5px solid #BAE6FD', paddingTop: 6, marginTop: 2 }}>
                      <span>NET DUE:</span><span>Rs. {netAmount.toFixed(2)}</span>
                    </div>
                    {!paymentFullyPaid && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 900, color: '#D97706', borderTop: '1px dashed #CBD5E1', paddingTop: 4, marginTop: 2 }}>
                        <span>REMAINING:</span><span>Rs. {(netAmount - (parseFloat(paymentPaidAmt) || 0)).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={loading}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 13, fontWeight: 900, background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', boxShadow: '0 4px 12px rgba(14,165,233,0.3)' }}
                  >
                    {loading ? <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" /> : <CheckCircle style={{ width: 14, height: 14 }} />}
                    Finalize Counter Sale
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* FINALIZED INVOICE MODAL */}
      {finalizedOrder && (
        <div className="modal-overlay" onClick={() => setFinalizedOrder(null)}>
          <div 
            className="modal-card animate-scaleIn"
            style={{
              '--modal-max-width': '960px',
              padding: 24,
              flexDirection: 'row',
              gap: 24
            } as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0 }} className="border-r border-slate-100 pr-6 no-print">
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Receipt style={{ width: 16, height: 16, color: '#0EA5E9' }} /> Cash Sale Completed
                </h3>
                <p style={{ fontSize: 11, color: '#64748B', marginTop: 6, lineHeight: 1.5 }}>
                  Invoice recorded successfully. Press print receipt below.
                </p>
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: 10, fontSize: 11, color: '#059669', marginTop: 10, fontFamily: 'monospace' }}>
                  Invoice Ref: POS-{finalizedOrder.id.substring(0, 8).toUpperCase()}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
                <button onClick={handlePrintReceipt} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 12 }}>
                  <Printer style={{ width: 14, height: 14 }} /> Print A4 Invoice
                </button>
                <button onClick={() => setFinalizedOrder(null)} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: 10, fontSize: 12 }}>
                  Close Counter
                </button>
              </div>
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', padding: 16, border: '1px solid #E2E8F0', borderRadius: 16, background: '#F8FAFC' }}>
              {/* Document Printable */}
              <div id="print-area" style={{ padding: '32px', color: '#1E293B', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ borderBottom: '2px solid #000', paddingBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase' }}>{profile.companyName}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{profile.address}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>Phone: {profile.phone}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <h2 style={{ fontSize: 14, fontWeight: 900, textTransform: 'uppercase', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6 }}>TAX INVOICE</h2>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>PAN / VAT ID: {profile.taxId}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, background: '#F8FAFC', padding: 12, borderRadius: 12, fontSize: 11 }}>
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Billed Customer</span>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', marginTop: 2 }}>
                      {finalizedOrder.retailer?.pharmacyName === "Walk-in Customer (POS)" ? (
                        <span>{getWalkInName(finalizedOrder.overrideJustification)}</span>
                      ) : (
                        finalizedOrder.retailer?.pharmacyName || 'Walk-in Customer'
                      )}
                    </div>
                    {finalizedOrder.retailer?.pharmacyName === "Walk-in Customer (POS)" && (
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                        Phone: {getWalkInPhone(finalizedOrder.overrideJustification)}
                      </div>
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Invoice details</span>
                    <div style={{ marginTop: 2 }}>Ref: POS-{finalizedOrder.id.substring(0, 8).toUpperCase()}</div>
                    <div style={{ color: '#64748B' }}>Date: {new Date(finalizedOrder.createdAt).toLocaleString()}</div>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #1E293B' }}>
                      <th style={{ padding: '8px 4px', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right' }}>Rate</th>
                      <th style={{ padding: '8px 4px', textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalizedOrder.items.map((item: any, idx: number) => {
                      const totalPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
                      const qtyBoxes = item.quantity / totalPerBox;
                      const pricePerBox = item.pricePerUnit * totalPerBox;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 4px' }}>{item.product.name} ({item.product.sku})</td>
                          <td style={{ padding: '8px 4px', textAlign: 'center' }}>{qtyBoxes} boxes</td>
                          <td style={{ padding: '8px 4px', textAlign: 'right' }}>Rs. {pricePerBox.toFixed(2)}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>Rs. {(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #000', paddingTop: 10 }}>
                  <div style={{ width: '50%', display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right', fontSize: 11, fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span><span>Rs. {finalizedOrder.totalAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 900, borderTop: '1px solid #000', paddingTop: 4 }}>
                      <span>NET TOTAL:</span><span>Rs. {finalizedOrder.netAmount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669', fontWeight: 700, fontSize: 12 }}>
                      <span>Amount Paid ({finalizedOrder.paymentMethod || 'CASH'}):</span><span>Rs. {(finalizedOrder.paidAmount ?? finalizedOrder.netAmount).toFixed(2)}</span>
                    </div>
                    {(finalizedOrder.dueAmount ?? 0) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626', fontWeight: 700, fontSize: 12 }}>
                        <span>Due Balance:</span><span>Rs. {(finalizedOrder.dueAmount).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '500px', border: '1.5px solid #BAE6FD', boxShadow: '0 24px 64px rgba(14,165,233,0.18)', padding: 28 } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <User style={{ width: 18, height: 18, color: '#0EA5E9' }} /> Register Customer Pharmacy
              </h3>
              <button onClick={() => setShowAddCustomerModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {modalError && <div className="alert alert-error">{modalError}</div>}
            {modalSuccess && <div className="alert alert-success">{modalSuccess}</div>}

            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Pharmacy Name *</label>
                  <input required type="text" value={newPharmacyName} onChange={(e) => setNewPharmacyName(e.target.value)} placeholder="Sunrise Pharmacy" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Contact Person *</label>
                  <input required type="text" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="Ram Shrestha" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Phone Number *</label>
                  <input required type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="98XXXXXXXX" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Email Address *</label>
                  <input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="pharmacy@email.com" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Address</label>
                <input required type="text" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Street, City, District" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="submit" className="btn-primary" style={{ flexGrow: 1, justifyContent: 'center' }}>Register</button>
                <button type="button" onClick={() => setShowAddCustomerModal(false)} className="btn-ghost" style={{ padding: '10px 20px' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
