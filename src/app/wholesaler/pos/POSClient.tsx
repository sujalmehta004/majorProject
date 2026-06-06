'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Receipt, ShoppingBag, User, Phone, Search, Plus, Trash2, Printer, 
  CheckCircle, AlertCircle, RefreshCw, Barcode, Minimize2, ArrowLeft, ArrowRight, X, Percent, DollarSign, Bookmark, Layers
} from 'lucide-react';
import { logActivity } from '@/components/WholesalerLayout';

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  availableBaseUnits: number;
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
  const [qtyBoxesInput, setQtyBoxesInput] = useState(1);

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

  // Evaluate tiered pricing per Box
  const getPricePerBox = (product: Product, qty: number) => {
    let price = 100;
    try {
      const tiers = JSON.parse(product.tierPricingJson || '[]');
      const matchingTier = tiers.find(
        (t: any) => qty >= t.minQty && qty <= (t.maxQty || 999999)
      );
      if (matchingTier) {
        price = matchingTier.pricePerBox;
      } else if (tiers.length > 0) {
        price = tiers[0].pricePerBox;
      }
    } catch (e) {
      console.error('Failed to evaluate price tiers', e);
    }
    return price;
  };

  // Add to basket
  const addToCart = (product: Product, qty: number, targetBatchId?: string) => {
    setError('');
    const sortedBatches = [...product.batches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    const fallbackBatch = sortedBatches.find(b => b.availableBaseUnits > 0);
    const batchId = targetBatchId || fallbackBatch?.id || '';
    
    if (!batchId) {
      setError(`No active stock batches found for "${product.name}".`);
      return;
    }

    const pricePerBox = getPricePerBox(product, qty);
    const existing = cart.find(item => item.product.id === product.id && item.selectedBatchId === batchId);
    const totalQty = existing ? existing.qtyBoxes + qty : qty;

    const selectedBatch = product.batches.find(b => b.id === batchId);
    if (!selectedBatch) return;

    const tabletsPerBox = product.tabletsPerStrip * product.stripsPerBox;
    const availableBoxes = Math.floor(selectedBatch.availableBaseUnits / tabletsPerBox);

    if (totalQty > availableBoxes) {
      setError(`Only ${availableBoxes} boxes available in selected batch ${selectedBatch.batchNumber} for "${product.name}".`);
      return;
    }

    if (existing) {
      setCart(cart.map(item => 
        (item.product.id === product.id && item.selectedBatchId === batchId)
          ? { ...item, qtyBoxes: totalQty, pricePerBox: getPricePerBox(product, totalQty) }
          : item
      ));
    } else {
      setCart([...cart, { product, qtyBoxes: qty, selectedBatchId: batchId, pricePerBox }]);
    }

    // Reset inputs
    setSearchTerm('');
    setSelectedProductId('');
    setSelectedBatchId('');
    setQtyBoxesInput(1);
    logActivity('POS_ADD_ITEM', `Added ${qty} boxes of ${product.name} to POS cart`);
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

      const res = await fetch('/api/wholesaler/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems,
          customerName: selectedCustomerId ? undefined : customerName,
          customerPhone: selectedCustomerId ? undefined : customerPhone,
          retailerId: selectedCustomerId || undefined,
          discountAmount,
          netAmount
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete physical sale.');

      setSuccessMsg('Cash sale completed successfully. Rerouting invoice to print preview.');
      setFinalizedOrder(data.order);
      
      // Save partial settlements dictionary in local storage
      const existingSettlements = JSON.parse(localStorage.getItem('medhub_order_payments') || '{}');
      // POS is paid immediately, so fully settle by default
      existingSettlements[data.order.id] = netAmount;
      localStorage.setItem('medhub_order_payments', JSON.stringify(existingSettlements));

      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setSelectedCustomerId('');
      setCustomerSearchQuery('');
      logActivity('POS_CHECKOUT_COMPLETE', `Finalized POS Cash order INV-${data.order.id.substring(0,8).toUpperCase()}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred during cashier checkout.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
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

      {/* Cashier Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start no-print">
        {/* LEFT COLUMN: Search & Add medicines */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Barcode scanner quick ingestion */}
          <div style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(186,230,253,0.4)', borderRadius: 24, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 14 }}>
              <Barcode style={{ width: 18, height: 18, color: '#0EA5E9' }} /> Barcode Scanner / SKU Quick Ingest
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

          {/* Catalog Manual Finder */}
          <div style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(186,230,253,0.4)', borderRadius: 24, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 14 }}>
              <Search style={{ width: 18, height: 18, color: '#F97316' }} /> Medicine Autocomplete Finder
            </h3>

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
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1.5px solid #BAE6FD', borderRadius: 10, boxShadow: '0 8px 24px rgba(14,165,233,0.15)', zIndex: 20, maxHeight: 180, overflowY: 'auto' }}>
                        {filteredProducts.map(p => (
                          <button 
                            key={p.id} 
                            onClick={() => { setSelectedProductId(p.id); setSearchTerm(''); setShowMedicineDropdown(false); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F0F9FF')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: '#64748B' }}>SKU: {p.sku}</div>
                          </button>
                        ))}
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

            {selectedProductId && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Quantity (Boxes)</label>
                  <input
                    type="number"
                    min="1"
                    value={qtyBoxesInput}
                    onChange={(e) => setQtyBoxesInput(parseInt(e.target.value) || 1)}
                    className="input-crisp"
                    style={{ width: 90, textAlign: 'center', fontWeight: 'bold', fontFamily: 'monospace' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedProduct) addToCart(selectedProduct, qtyBoxesInput, selectedBatchId);
                  }}
                  className="btn-primary"
                  style={{ padding: '10px 20px', fontSize: 11 }}
                >
                  <Plus style={{ width: 14, height: 14, marginRight: 4 }} /> Add to Cart
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Basket, Customer details & checkout */}
        <div className="lg:col-span-5 space-y-6">
          {/* Customer selection */}
          <div style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(186,230,253,0.4)', borderRadius: 24, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 16 }}>
              <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                <User style={{ width: 18, height: 18, color: '#0EA5E9' }} /> Customer Account Selection
              </h3>
              <button 
                type="button" 
                onClick={() => setShowAddCustomerModal(true)} 
                style={{ fontSize: 11, fontWeight: 800, color: '#0EA5E9', border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                ＋ Quick-Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div ref={customerSearchRef} style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Search Customer Pharmacy</label>
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
                    <input type="text" placeholder="John Doe" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input-crisp" style={{ fontSize: 11, padding: 6 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>Walk-in Phone</label>
                    <input type="text" placeholder="98XXXXXXXX" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="input-crisp" style={{ fontSize: 11, padding: 6 }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Checkout Basket */}
          <div style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(186,230,253,0.4)', borderRadius: 24, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #F1F5F9', paddingBottom: 10, marginBottom: 14 }}>
              <ShoppingBag style={{ width: 18, height: 18, color: '#F97316' }} /> Checkout Basket
            </h3>

            {cart.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>
                Basket is empty. Scan barcodes or select a medicine from catalog.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
                  {cart.map((item) => {
                    const batchNum = item.product.batches.find(b => b.id === item.selectedBatchId)?.batchNumber || 'N/A';
                    return (
                      <div key={`${item.product.id}-${item.selectedBatchId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E2E8F0', padding: 8, borderRadius: 10 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{item.product.name}</div>
                          <div style={{ fontSize: 10, color: '#64748B' }}>Batch: {batchNum}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number"
                              min="1"
                              value={item.qtyBoxes}
                              onChange={(e) => updateCartQty(item.product.id, item.selectedBatchId, parseInt(e.target.value) || 1)}
                              style={{ width: 50, textAlign: 'center', fontSize: 11, padding: 3, border: '1px solid #E2E8F0', borderRadius: 6 }}
                            />
                            <span style={{ fontSize: 10, color: '#94A3B8' }}>boxes</span>
                          </div>
                          <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>Rs. {(item.pricePerBox * item.qtyBoxes).toLocaleString()}</div>
                          <button onClick={() => removeFromCart(item.product.id, item.selectedBatchId)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}>
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
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

                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, fontSize: 11, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between' }}>
                    <span>Gross Value:</span><span>Rs. {subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', color: '#EF4444' }}>
                    <span>Discount Amt:</span><span>- Rs. {discountAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', color: '#10B981' }}>
                    <span>VAT / Tax Amt:</span><span>+ Rs. {taxAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', fontSize: 13, fontWeight: 900, color: '#1E293B', borderTop: '1px solid #E2E8F0', paddingTop: 6, marginTop: 4 }}>
                    <span>NET DUE CASH:</span><span>Rs. {netAmount.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 12, background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)' }}
                >
                  {loading ? <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" /> : <CheckCircle style={{ width: 14, height: 14 }} />}
                  Finalize counter Sale
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FINALIZED INVOICE MODAL */}
      {finalizedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto no-print">
          <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-3xl p-6 shadow-2xl flex flex-col lg:flex-row gap-6 max-h-[90vh]">
            
            <div className="lg:w-1/3 space-y-4 border-r border-slate-100 pr-0 lg:pr-6 flex flex-col justify-between shrink-0">
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Receipt style={{ width: 16, height: 16, color: '#0EA5E9' }} /> Cash Sale Completed
                </h3>
                <p style={{ fontSize: 11, color: '#64748B', marginTop: 6 }}>
                  Invoice recorded successfully. Press print receipt below.
                </p>
                <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: 10, fontSize: 11, color: '#059669', marginTop: 10 }}>
                  Invoice Ref: POS-{finalizedOrder.id.substring(0, 8).toUpperCase()}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={handlePrintReceipt} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 12, fontSize: 12 }}>
                  <Printer style={{ width: 14, height: 14 }} /> Print A4 Invoice
                </button>
                <button onClick={() => setFinalizedOrder(null)} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: 10, fontSize: 12 }}>
                  Close Counter
                </button>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 border border-slate-150 rounded-2xl bg-slate-50/40 shadow-inner flex flex-col justify-between">
              {/* Document Printable */}
              <div id="print-area" className="p-8 text-zinc-900 font-sans text-xs bg-white space-y-6 max-w-[21cm] min-h-[29.7cm] mx-auto shadow-md border border-slate-200">
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
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', marginTop: 2 }}>{finalizedOrder.retailer?.pharmacyName || finalizedOrder.overrideJustification || 'Walk-in Customer'}</div>
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
                      <span>Amount Paid:</span><span>Rs. {finalizedOrder.netAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="animate-scaleIn" style={{ background: 'white', border: '1.5px solid #BAE6FD', borderRadius: 24, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(14,165,233,0.18)' }}>
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
