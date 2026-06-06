'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Receipt, ShoppingBag, User, Phone, Search, Plus, Trash2, Printer, 
  CheckCircle, AlertCircle, RefreshCw, Barcode, Minimize2, ArrowLeft, ArrowRight
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
}

interface POSClientProps {
  profile: Profile;
  products: Product[];
}

export default function POSClient({ profile, products }: POSClientProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qtyBoxesInput, setQtyBoxesInput] = useState(1);

  // Statuses
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [finalizedOrder, setFinalizedOrder] = useState<any | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);

  // Focus barcode scan on mount
  useEffect(() => {
    if (barcodeRef.current) barcodeRef.current.focus();
  }, []);

  // Filter products for dropdown autocomplete
  const filteredProducts = searchTerm
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : products;

  // Evaluate tiered pricing per Box
  const getPricePerBox = (product: Product, qty: number) => {
    let price = 100; // default backup
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
  const addToCart = (product: Product, qty: number) => {
    setError('');
    const existing = cart.find(item => item.product.id === product.id);
    const totalQty = existing ? existing.qtyBoxes + qty : qty;

    // Check inventory availability (total boxes in all batches)
    const tabletsPerBox = product.tabletsPerStrip * product.stripsPerBox;
    const totalAvailableTablets = product.batches.reduce((acc, b) => acc + b.availableBaseUnits, 0);
    const totalAvailableBoxes = Math.floor(totalAvailableTablets / tabletsPerBox);

    if (totalQty > totalAvailableBoxes) {
      setError(`Stock shortage for "${product.name}". Only ${totalAvailableBoxes} boxes available in active batches.`);
      return;
    }

    if (existing) {
      setCart(cart.map(item => 
        item.product.id === product.id 
          ? { ...item, qtyBoxes: totalQty }
          : item
      ));
    } else {
      setCart([...cart, { product, qtyBoxes: qty }]);
    }

    // Reset inputs
    setSearchTerm('');
    setSelectedProductId('');
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

  // Remove item
  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  // Update item quantity directly
  const updateCartQty = (productId: string, newQty: number) => {
    setError('');
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const item = cart.find(c => c.product.id === productId);
    if (!item) return;

    const tabletsPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
    const totalAvailableTablets = item.product.batches.reduce((acc, b) => acc + b.availableBaseUnits, 0);
    const totalAvailableBoxes = Math.floor(totalAvailableTablets / tabletsPerBox);

    if (newQty > totalAvailableBoxes) {
      setError(`Only ${totalAvailableBoxes} boxes available for "${item.product.name}".`);
      return;
    }

    setCart(cart.map(c => 
      c.product.id === productId ? { ...c, qtyBoxes: newQty } : c
    ));
  };

  // Calculate totals
  const getSubtotal = () => {
    return cart.reduce((acc, item) => {
      const pricePerBox = getPricePerBox(item.product, item.qtyBoxes);
      return acc + (pricePerBox * item.qtyBoxes);
    }, 0);
  };

  // Checkout POST
  const handleCheckout = async () => {
    setError('');
    setLoading(true);
    try {
      const checkoutItems = cart.map(item => ({
        productId: item.product.id,
        qtyBoxes: item.qtyBoxes
      }));

      const res = await fetch('/api/wholesaler/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems,
          customerName,
          customerPhone
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete physical sale.');

      setSuccessMsg('Cash sale completed successfully. Rerouting invoice to print preview.');
      setFinalizedOrder(data.order);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      logActivity('POS_CHECKOUT_COMPLETE', `Finalized POS Cash order INV-${data.order.id.substring(0,8).toUpperCase()}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred during cashier checkout.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger print dialog
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

  return (
    <div className="space-y-6 animate-fadeIn" style={{ maxWidth: 1280 }}>
      {/* Page Header */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(186,230,253,0.5)',
          borderRadius: 20,
          padding: '20px 24px',
          boxShadow: '0 2px 12px rgba(14,165,233,0.07)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <ShoppingBag style={{ width: 22, height: 22, color: '#0EA5E9' }} />
            POS Terminal & Cash Register
          </h1>
          <p style={{ fontSize: 12, color: '#64748B' }}>Process walk-in physical customer sales and print standard A4 billing receipts.</p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-650 text-xs rounded-2xl flex items-center gap-2 font-mono no-print">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 border border-emerald-200 bg-emerald-50 text-emerald-650 text-xs rounded-2xl flex items-center gap-2 font-mono no-print">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Cashier Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start no-print">
        {/* LEFT COLUMN: Search & Add medicines */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Barcode scanner quick ingestion */}
          <div className="border border-slate-200 bg-white/75 backdrop-blur-xl rounded-3xl p-6 shadow-sm bg-gradient-to-br from-white to-sky-50/15">
            <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Barcode className="w-4.5 h-4.5 text-sky-500" />
              Barcode Scanner / SKU Quick Ingest
            </h3>
            
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan medicine barcode or type exact SKU (e.g. PARA-500)..."
                className="flex-grow bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 font-mono shadow-inner"
              />
              <button
                type="submit"
                className="py-3 px-6 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer shadow"
              >
                Ingest
              </button>
            </form>
            <p className="text-[10px] text-zinc-400 mt-2 font-medium">Keep input focused to automatically scan and ingest medicines from a USB Barcode Scanner gun.</p>
          </div>

          {/* Catalog Manual Finder */}
          <div className="border border-slate-200 bg-white/75 backdrop-blur-xl rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Search className="w-4.5 h-4.5 text-pink-400" />
              Medicine Manual catalog Search
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-550 mb-1 font-bold text-[10.5px] uppercase">Search Product name</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type to filter catalog..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-zinc-900 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-550 mb-1 font-bold text-[10.5px] uppercase">Select Medicine SKU</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-zinc-900 text-xs focus:outline-none"
                >
                  <option value="">-- Choose matching product --</option>
                  {filteredProducts.map(p => {
                    const totalQty = p.batches.reduce((acc, b) => acc + b.availableBaseUnits, 0);
                    const tabletsPerBox = p.tabletsPerStrip * p.stripsPerBox;
                    const totalBoxes = Math.floor(totalQty / tabletsPerBox);
                    return (
                      <option key={p.id} value={p.id} disabled={totalBoxes <= 0}>
                        {p.name} [{p.sku}] - Available: {totalBoxes} boxes
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {selectedProductId && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-end justify-between gap-4 bg-slate-50 p-4 rounded-2xl">
                <div>
                  <label className="block text-zinc-550 mb-1 font-bold text-[10.5px] uppercase">Quantity (Boxes)</label>
                  <input
                    type="number"
                    min="1"
                    value={qtyBoxesInput}
                    onChange={(e) => setQtyBoxesInput(parseInt(e.target.value) || 1)}
                    className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-zinc-900 focus:outline-none text-xs font-mono font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const prod = products.find(p => p.id === selectedProductId);
                    if (prod) addToCart(prod, qtyBoxesInput);
                  }}
                  className="py-2.5 px-5 bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  Add to Cart
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Basket, Customer details & checkout */}
        <div className="lg:col-span-5 space-y-6">
          {/* Physical Customer form */}
          <div className="border border-slate-200 bg-white/75 backdrop-blur-xl rounded-3xl p-6 shadow-sm bg-gradient-to-b from-white to-slate-50/10">
            <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <User className="w-4.5 h-4.5 text-sky-500" />
              Walk-in Customer details
            </h3>

            <div className="space-y-3.5 text-xs font-semibold">
              <div>
                <label className="block text-zinc-500 uppercase mb-1">Customer Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-zinc-500 uppercase mb-1">Customer Phone Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 984xxxxxxx"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
          </div>

          {/* Checkout Basket */}
          <div className="border border-slate-200 bg-white/75 backdrop-blur-xl rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <ShoppingBag className="w-4.5 h-4.5 text-pink-400" />
              Checkout Basket
            </h3>

            {cart.length === 0 ? (
              <div className="text-center py-10 text-zinc-400 italic text-xs font-medium">
                Basket is empty. Scan barcodes or select a medicine from catalog above.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[220px] overflow-y-auto space-y-3.5 pr-1">
                  {cart.map((item) => {
                    const pricePerBox = getPricePerBox(item.product, item.qtyBoxes);
                    return (
                      <div key={item.product.id} className="flex justify-between items-start gap-3 bg-slate-50/50 border border-slate-150 p-3 rounded-2xl">
                        <div className="min-w-0 flex-grow text-xs">
                          <div className="text-zinc-850 font-bold truncate">{item.product.name}</div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{item.product.sku}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-zinc-450 font-bold uppercase">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={item.qtyBoxes}
                              onChange={(e) => updateCartQty(item.product.id, parseInt(e.target.value) || 1)}
                              className="w-14 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-center text-[11px] font-mono font-bold"
                            />
                            <span className="text-[10px] text-zinc-400">boxes</span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col justify-between items-end h-full min-h-[50px] shrink-0 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-zinc-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="text-zinc-950 font-black font-mono mt-2">
                            Rs. {(pricePerBox * item.qtyBoxes).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-200 pt-4 space-y-2.5 text-xs font-bold font-mono">
                  <div className="flex justify-between text-zinc-500">
                    <span>Gross Value:</span>
                    <span>Rs. {getSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-950 text-sm border-t border-slate-150 pt-2 font-black">
                    <span>NET PAYABLE CASH:</span>
                    <span>Rs. {getSubtotal().toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-sky-400 to-pink-400 hover:from-sky-500 hover:to-pink-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-300 rounded-2xl shadow-sm hover:shadow flex justify-center items-center gap-2 cursor-pointer font-mono"
                >
                  {loading ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : <CheckCircle className="w-4.5 h-4.5" />}
                  Checkout & Open Invoice
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FINALIZED A4 BILL INVOICE MODAL */}
      {finalizedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-4xl rounded-3xl p-6 shadow-2xl flex flex-col lg:flex-row gap-6 max-h-[90vh]">
            
            {/* Control Sidebar */}
            <div className="lg:w-1/3 space-y-4 border-r border-slate-100 pr-0 lg:pr-6 flex flex-col justify-between shrink-0 no-print">
              <div>
                <h3 className="font-extrabold text-sm uppercase text-zinc-950 tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Receipt className="w-4.5 h-4.5 text-sky-500" />
                  Bill Checkout Complete
                </h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed mt-2 font-medium">
                  The cash sale has been successfully saved. Print this A4 tax invoice below.
                </p>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-4 text-xs font-semibold text-emerald-800 space-y-1">
                  <div>Status: DELIVERED (CASH)</div>
                  <div>Invoice ID: POS-{finalizedOrder.id.substring(0, 8).toUpperCase()}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <button
                  onClick={handlePrintReceipt}
                  className="w-full py-3.5 bg-gradient-to-r from-sky-400 to-pink-400 hover:from-sky-500 hover:to-pink-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-300 rounded-2xl flex justify-center items-center gap-2 shadow-sm hover:shadow cursor-pointer font-mono"
                >
                  <Printer className="w-4 h-4" />
                  Print A4 invoice
                </button>
                <button
                  onClick={() => setFinalizedOrder(null)}
                  className="w-full py-2.5 border border-slate-250 bg-white hover:bg-slate-50 text-zinc-650 font-bold text-xs uppercase tracking-wider rounded-2xl text-center cursor-pointer transition-colors"
                >
                  Close Counter
                </button>
              </div>
            </div>

            {/* Document Print Area */}
            <div className="flex-grow overflow-y-auto p-4 border border-slate-150 rounded-2xl bg-slate-50/40 shadow-inner flex flex-col justify-between">
              
              {/* Printable container: styled like an A4 letterhead invoice */}
              <div id="print-area" className="p-8 text-zinc-900 font-sans text-xs bg-white space-y-6 max-w-[21cm] min-h-[29.7cm] mx-auto shadow-md border border-slate-200 relative">
                
                {/* A4 Letterhead header */}
                <div className="border-b-2 border-zinc-950 pb-5">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1.5">
                      <div className="text-xl font-black text-zinc-950 tracking-wide uppercase">{profile.companyName}</div>
                      <div className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">Medical Supplies Distributor</div>
                      <div className="text-[10.5px] text-zinc-600 font-medium">
                        <div>Address: {profile.address}</div>
                        <div>Phone: {profile.phone}</div>
                        {profile.registrationNumber && <div>License Code: {profile.registrationNumber}</div>}
                        {profile.contactPerson && <div>Authorized Rep: {profile.contactPerson}</div>}
                      </div>
                    </div>
                    <div className="text-right space-y-1.5">
                      <h2 className="text-lg font-black text-zinc-950 uppercase tracking-widest bg-zinc-100 px-3 py-1 rounded">TAX INVOICE</h2>
                      <div className="text-[11px] font-mono font-bold text-zinc-600">VAT / Tax ID: {profile.taxId}</div>
                      {profile.latitude && profile.longitude && (
                        <div className="text-[9px] font-mono text-zinc-450 mt-1 font-bold">
                          GRID LOC: {profile.latitude.toFixed(4)} N, {profile.longitude.toFixed(4)} E
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Render Custom Fields in Letterhead */}
                  {customFields.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[9.5px] text-zinc-500 font-medium font-mono">
                      {customFields.map((field, idx) => (
                        <div key={idx} className="truncate">
                          <span className="uppercase text-zinc-400 font-bold">{field.label}:</span> {field.value}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Billing details */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 border border-slate-100 p-4 rounded-2xl font-medium">
                  <div className="space-y-1">
                    <div className="text-[8.5px] uppercase text-zinc-400 font-bold font-mono">Billed To (Customer):</div>
                    <div className="text-zinc-900 font-extrabold text-sm">{finalizedOrder.retailer?.pharmacyName || 'Walk-in Cash Customer'}</div>
                    <div className="text-zinc-550">{finalizedOrder.overrideJustification || 'Walk-in cash counter sale'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[8.5px] uppercase text-zinc-400 font-bold font-mono">Payment Summary:</div>
                    <div className="text-zinc-900 font-extrabold text-sm">Amount: Rs. {finalizedOrder.netAmount.toFixed(2)}</div>
                    <div className="text-zinc-500">Invoice Number: <span className="font-bold text-zinc-800 font-mono">POS-{finalizedOrder.id.substring(0,8).toUpperCase()}</span></div>
                    <div className="text-[9.5px] text-zinc-400 font-mono">Date: {new Date(finalizedOrder.createdAt).toLocaleString()}</div>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-950 text-zinc-950 font-extrabold uppercase tracking-wider text-[9px] bg-slate-50">
                      <th className="py-2.5 px-2">Medicine SKU</th>
                      <th className="py-2.5 px-2">Description</th>
                      <th className="py-2.5 px-2 text-right">Units (Base)</th>
                      <th className="py-2.5 px-2 text-right">Rate</th>
                      <th className="py-2.5 px-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-medium">
                    {finalizedOrder.items.map((item: any, index: number) => {
                      const totalPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
                      const qtyBoxes = item.quantity / totalPerBox;
                      const pricePerBox = item.pricePerUnit * totalPerBox;

                      return (
                        <tr key={index} className="text-zinc-700 hover:bg-slate-50/50">
                          <td className="py-3 px-2 font-mono font-bold text-zinc-950">{item.product.sku}</td>
                          <td className="py-3 px-2 font-bold">{item.product.name} ({qtyBoxes} boxes)</td>
                          <td className="py-3 px-2 text-right font-mono">{item.quantity} tabs</td>
                          <td className="py-3 px-2 text-right font-mono">Rs. {pricePerBox.toFixed(2)}/box</td>
                          <td className="py-3 px-2 text-right font-mono font-bold text-zinc-950">Rs. {(item.quantity * item.pricePerUnit).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Subtotals */}
                <div className="border-t border-zinc-900 pt-4 flex justify-end">
                  <div className="w-1/2 space-y-2 text-right font-semibold font-mono text-[10.5px]">
                    <div className="flex justify-between text-zinc-500">
                      <span>Subtotal amount:</span>
                      <span>Rs. {finalizedOrder.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-950 border-t border-zinc-900 pt-2 font-black text-sm">
                      <span>CASH PAID VALUE:</span>
                      <span>Rs. {finalizedOrder.netAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Terms and Memo */}
                <div className="grid grid-cols-2 gap-6 border-t border-zinc-200 pt-4 text-[9px] leading-relaxed text-zinc-500 font-medium font-sans">
                  <div>
                    <div className="text-[10px] text-zinc-950 font-black uppercase mb-1">Receipt terms:</div>
                    <p>1. Goods once sold will not be exchanged or returned.<br/>2. This is a computer generated invoice and requires no signature.<br/>3. Payment mode: CASH/QR CODE.</p>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-950 font-black uppercase mb-1">MedHub Verification:</div>
                    <p>Double-entry stock deduction completed via FIFO batch selection algorithm. Batch allocations are securely logged in distributor audit trail database.</p>
                  </div>
                </div>

                {/* Footer Signature */}
                <div className="border-t border-dashed border-zinc-300 pt-6 flex justify-between items-center text-[10px] font-bold text-zinc-400 font-mono mt-12">
                  <span>MEDHUB CASHIER TERMINAL V1.0</span>
                  <div className="text-right">
                    <div className="w-32 border-b border-zinc-450 h-8"></div>
                    <span className="text-[8.5px] uppercase tracking-wider block mt-1">Cashier Signature</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
