'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, Database, Search, Plus, Calendar, DollarSign, FileText, 
  ChevronDown, ChevronUp, Printer, Check, AlertCircle, RefreshCw, Barcode, Globe, X
} from 'lucide-react';
import { uomToString, UOMToBaseUnits } from '@/lib/uom';
import { logActivity } from '@/components/WholesalerLayout';

interface Product {
  id: string;
  name: string;
  sku: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
  tierPricingJson: string;
  createdAt: string;
}

interface Batch {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  totalBaseUnits: number;
  availableBaseUnits: number;
  manufacturingCost: number;
  invoiceData: string;
  barcodeUrl: string;
  purchasePricePerBox: number;
  sellingPricePerBox: number;
  supplierName: string | null;
  manufacturerName: string | null;
  purchaseDate: string;
  product: Product;
}

interface InventoryClientProps {
  profileId: string;
}

export default function InventoryClient({ profileId }: InventoryClientProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedProductIdForBatch, setSelectedProductIdForBatch] = useState('');

  // Product Form State
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newTabletsPerStrip, setNewTabletsPerStrip] = useState('10');
  const [newStripsPerBox, setNewStripsPerBox] = useState('10');
  const [pricingTiers, setPricingTiers] = useState<Array<{ minQty: number; maxQty: number; pricePerBox: number }>>([
    { minQty: 1, maxQty: 49, pricePerBox: 100 }
  ]);

  // Batch Form State
  const [newBatchNumber, setNewBatchNumber] = useState('');
  const [newBatchExpiry, setNewBatchExpiry] = useState('');
  const [batchBoxes, setBatchBoxes] = useState('0');
  const [batchStrips, setBatchStrips] = useState('0');
  const [batchTablets, setBatchTablets] = useState('0');
  const [newManufacturingCost, setNewManufacturingCost] = useState('0.5'); 
  const [newInvoiceData, setNewInvoiceData] = useState('');
  const [purchasePricePerBox, setPurchasePricePerBox] = useState('50');
  const [sellingPricePerBox, setSellingPricePerBox] = useState('100');
  const [supplierName, setSupplierName] = useState('');
  const [manufacturerName, setManufacturerName] = useState('');

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const prodRes = await fetch('/api/wholesaler/products');
      const prodData = await prodRes.json();
      if (!prodRes.ok) throw new Error(prodData.error || 'Failed to fetch products');
      setProducts(prodData.products);

      const batchRes = await fetch('/api/wholesaler/batches');
      const batchData = await batchRes.json();
      if (!batchRes.ok) throw new Error(batchData.error || 'Failed to fetch batches');
      setBatches(batchData.batches);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setNewInvoiceData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!newProductName || !newProductSku) {
      setError('Product Name and SKU are required.');
      return;
    }

    try {
      const res = await fetch('/api/wholesaler/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProductName,
          sku: newProductSku,
          tabletsPerStrip: parseInt(newTabletsPerStrip),
          stripsPerBox: parseInt(newStripsPerBox),
          tierPricing: pricingTiers,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register product');

      setSuccessMsg(`Product "${newProductName}" registered successfully.`);
      setShowProductModal(false);
      
      setNewProductName('');
      setNewProductSku('');
      setNewTabletsPerStrip('10');
      setNewStripsPerBox('10');
      setPricingTiers([{ minQty: 1, maxQty: 49, pricePerBox: 100 }]);

      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to add product.');
    }
  };

  const handleAddBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const targetProduct = products.find(p => p.id === selectedProductIdForBatch);
    if (!targetProduct) {
      setError('Selected product not found.');
      return;
    }

    if (!newBatchNumber || !newBatchExpiry || !newManufacturingCost) {
      setError('Batch Number, Expiry Date, and Manufacturing Cost are required.');
      return;
    }

    const boxes = parseInt(batchBoxes) || 0;
    const strips = parseInt(batchStrips) || 0;
    const tablets = parseInt(batchTablets) || 0;

    const totalBaseUnits = UOMToBaseUnits(
      boxes,
      strips,
      tablets,
      targetProduct.tabletsPerStrip,
      targetProduct.stripsPerBox
    );

    if (totalBaseUnits <= 0) {
      setError('Please provide a quantity greater than 0 tablets.');
      return;
    }

    try {
      const res = await fetch('/api/wholesaler/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductIdForBatch,
          batchNumber: newBatchNumber,
          expiryDate: new Date(newBatchExpiry).toISOString(),
          totalBaseUnits,
          manufacturingCost: parseFloat(newManufacturingCost),
          invoiceData: newInvoiceData,
          purchasePricePerBox: parseFloat(purchasePricePerBox),
          sellingPricePerBox: parseFloat(sellingPricePerBox),
          supplierName,
          manufacturerName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ingest batch');

      setSuccessMsg(`Batch "${newBatchNumber}" ingested successfully.`);
      setShowBatchModal(false);

      setNewBatchNumber('');
      setNewBatchExpiry('');
      setBatchBoxes('0');
      setBatchStrips('0');
      setBatchTablets('0');
      setNewManufacturingCost('0.5');
      setNewInvoiceData('');
      setPurchasePricePerBox('50');
      setSellingPricePerBox('100');
      setSupplierName('');
      setManufacturerName('');

      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to ingest batch.');
    }
  };

  const addPricingTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1];
    const nextMin = lastTier ? lastTier.maxQty + 1 : 1;
    setPricingTiers([...pricingTiers, { minQty: nextMin, maxQty: nextMin + 99, pricePerBox: 100 }]);
  };

  const removePricingTier = (index: number) => {
    if (pricingTiers.length === 1) return;
    setPricingTiers(pricingTiers.filter((_, idx) => idx !== index));
  };

  const updatePricingTier = (index: number, key: 'minQty' | 'maxQty' | 'pricePerBox', value: number) => {
    const updated = [...pricingTiers];
    updated[index] = { ...updated[index], [key]: value };
    setPricingTiers(updated);
  };

  const getProductTotalStock = (productId: string) => {
    return batches
      .filter(b => b.productId === productId && new Date(b.expiryDate) > new Date())
      .reduce((acc, curr) => acc + curr.availableBaseUnits, 0);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Zebra-style print handler for compact label printers
  const printThermalBarcode = async (productName: string, sku: string, batchNumber: string, expiryDate: string, barcodeUrl: string) => {
    await logActivity('PRINT_THERMAL_BARCODE', `Printed thermal label for medicine: ${productName} (Batch: ${batchNumber})`);
    
    const printWindow = window.open('', '_blank', 'width=380,height=280');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Thermal Label Print</title>
          <style>
            @page {
              size: 50mm 30mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 2.5mm;
              font-family: 'Courier New', Courier, monospace;
              font-size: 8px;
              font-weight: bold;
              text-align: center;
              width: 50mm;
              height: 30mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              background-color: white;
              color: black;
            }
            .header {
              font-size: 9px;
              font-weight: 900;
              text-transform: uppercase;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              border-bottom: 0.5px solid black;
              padding-bottom: 1px;
            }
            .details {
              font-size: 7px;
              display: flex;
              justify-content: space-between;
              width: 100%;
              margin: 1px 0;
            }
            .barcode-img {
              height: 11mm;
              width: auto;
              max-width: 100%;
              image-rendering: pixelated;
            }
            .footer {
              font-size: 6.5px;
              width: 100%;
              border-top: 0.5px solid black;
              padding-top: 1px;
            }
          </style>
        </head>
        <body>
          <div class="header">${productName}</div>
          <div class="details">
            <span>SKU: ${sku}</span>
            <span>B: ${batchNumber}</span>
          </div>
          <img class="barcode-img" src="${barcodeUrl}" />
          <div class="footer">EXPIRY: ${new Date(expiryDate).toLocaleDateString()}</div>
          <script>
            // Automatically trigger print on load and close window
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(251,146,60,0.2)', borderRadius: 20,
        padding: '20px 24px', boxShadow: '0 2px 12px rgba(249,115,22,0.07)'
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Package style={{ width: 22, height: 22, color: '#F97316' }} />
            Medications Catalog & Registry
          </h1>
          <p style={{ fontSize: 12, color: '#64748B' }}>Register medicines, manage warehouse stock batches, and print barcode thermal labels.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { logActivity('CLICK_BUTTON', 'Clicked register product catalog button'); setShowProductModal(true); }}
            className="btn-primary"
            style={{ background: 'linear-gradient(135deg, #F97316, #F59E0B)' }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Add New Medicine
          </button>
          <button onClick={fetchData} className="btn-ghost">
            <RefreshCw style={{ width: 14, height: 14, color: '#F97316' }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && <div className="alert alert-error"><AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />{error}</div>}
      {successMsg && <div className="alert alert-success"><Check style={{ width: 14, height: 14, flexShrink: 0 }} />{successMsg}</div>}

      {/* Toolbar row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.85)', border: '1.5px solid #E2E8F0',
          borderRadius: 12, padding: '8px 16px', flex: 1, maxWidth: 400,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <Search style={{ width: 15, height: 15, color: '#94A3B8', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search SKU or medicine name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: '#1E293B', width: '100%', fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace', textTransform: 'uppercase' }}>
          {filteredProducts.length} Medicine{filteredProducts.length !== 1 ? 's' : ''} in Registry
        </div>
      </div>

      {/* Products List */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.7)', borderRadius: 16, border: '1.5px solid #F1F5F9' }}>
          <RefreshCw style={{ width: 24, height: 24, color: '#F97316' }} className="animate-spin" />
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Synchronizing medicine library...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 16, border: '1.5px dashed #E2E8F0' }}>
          <Package style={{ width: 32, height: 32, color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>No medicines registered. Click "Add New Medicine" to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProducts.map((product) => {
            const totalTablets = getProductTotalStock(product.id);
            const totalUomStr = uomToString(totalTablets, product.tabletsPerStrip, product.stripsPerBox);
            const isExpanded = expandedProduct === product.id;
            let pricingTiersList: any[] = [];
            try { pricingTiersList = JSON.parse(product.tierPricingJson || '[]'); } catch (e) {}

            return (
              <div
                key={product.id}
                style={{
                  background: 'rgba(255,255,255,0.88)',
                  backdropFilter: 'blur(12px)',
                  border: isExpanded ? '1.5px solid #FB923C' : '1.5px solid #E2E8F0',
                  borderRadius: 16,
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                  boxShadow: isExpanded ? '0 4px 20px rgba(249,115,22,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {/* Product Row Header */}
                <div
                  onClick={() => { logActivity('TOGGLE_EXPAND_MEDICINE', `Toggled expand details: ${product.name}`); setExpandedProduct(isExpanded ? null : product.id); }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    gap: 16, padding: '18px 20px', cursor: 'pointer', userSelect: 'none',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Database style={{ width: 18, height: 18, color: '#F97316' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 13, color: '#1E293B' }}>{product.name}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase', background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '2px 8px', borderRadius: 6 }}>{product.sku}</span>
                      </div>
                      <p style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                        {product.tabletsPerStrip} tabs/strip · {product.stripsPerBox} strips/box · {product.tabletsPerStrip * product.stripsPerBox} tabs/box
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Available Stock</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1E293B', fontFamily: 'monospace', marginTop: 2 }}>{totalUomStr}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); logActivity('CLICK_BUTTON', `Ingest batch: ${product.name}`); setSelectedProductIdForBatch(product.id); setShowBatchModal(true); }}
                      className="btn-ghost"
                      style={{ padding: '6px 14px', fontSize: 11 }}
                    >
                      <Plus style={{ width: 13, height: 13 }} />
                      Ingest Batch
                    </button>
                    <div style={{ color: '#94A3B8' }}>
                      {isExpanded ? <ChevronUp style={{ width: 18, height: 18 }} /> : <ChevronDown style={{ width: 18, height: 18 }} />}
                    </div>
                  </div>
                </div>

                {/* Expanded: Pricing Tiers + Batch Table */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #F1F5F9', padding: '20px', background: 'rgba(248,250,252,0.6)' }} className="space-y-5">
                    {/* Pricing Tiers */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', marginBottom: 12 }}>Volume Pricing Tiers (Per Box)</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {pricingTiersList.map((tier: any, idx: number) => (
                          <div key={idx} style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: 12, padding: '12px 16px', minWidth: 120 }}>
                            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{tier.minQty}–{tier.maxQty || '∞'} Boxes</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#F97316', fontFamily: 'monospace', marginTop: 2 }}>Rs. {tier.pricePerBox}</div>
                            <div style={{ fontSize: 9, color: '#CBD5E1', fontWeight: 500 }}>per box rate</div>
                          </div>
                        ))}
                        {pricingTiersList.length === 0 && (
                          <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>No custom pricing tiers defined. Default: Rs. 100/box.</div>
                        )}
                      </div>
                    </div>

                    {/* Batch Sub-Table */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        Active Batches in Warehouse
                      </h4>
                      {batches.filter(b => b.productId === product.id).length === 0 ? (
                        <div className="border border-dashed border-slate-200 bg-white py-6 text-center rounded-2xl">
                          <p className="text-zinc-550 text-xs">No active batches ingested. Use &ldquo;Ingest Batch&rdquo; to add medicine stocks.</p>
                        </div>
                      ) : (
                        <div className="table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Batch ID</th>
                                <th>Status</th>
                                <th>Expiry Date</th>
                                <th>Supplier / Manufacturer</th>
                                <th>Available Stock</th>
                                <th>Buy / Sell Price</th>
                                <th className="text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batches.filter(b => b.productId === product.id).map((batch) => {
                                const isExpired = new Date(batch.expiryDate) < new Date();
                                const batchUomStr = uomToString(batch.availableBaseUnits, product.tabletsPerStrip, product.stripsPerBox);
                                return (
                                  <tr key={batch.id}>
                                    <td>
                                      <span className="font-mono font-bold text-zinc-900">{batch.batchNumber}</span>
                                    </td>
                                    <td>
                                      <span className={`status-pill ${isExpired ? 'status-pill-danger' : 'status-pill-active'}`}>
                                        {isExpired ? 'Expired' : 'Good'}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="flex items-center gap-1.5 text-zinc-700">
                                        <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                        {new Date(batch.expiryDate).toLocaleDateString()}
                                      </div>
                                    </td>
                                    <td>
                                      <div className="font-semibold text-zinc-800">{batch.manufacturerName || '—'}</div>
                                      <div className="text-[10px] text-zinc-500">{batch.supplierName || '—'}</div>
                                    </td>
                                    <td>
                                      <div className="font-bold font-mono text-zinc-800">{batchUomStr}</div>
                                      <div className="text-[10px] text-zinc-400 font-mono">{batch.availableBaseUnits} tablets</div>
                                    </td>
                                    <td>
                                      <div className="text-zinc-500 text-[11px]">Buy: Rs. {batch.purchasePricePerBox.toFixed(2)}</div>
                                      <div className="text-orange-655 font-bold text-[11px]">Sell: Rs. {batch.sellingPricePerBox.toFixed(2)}</div>
                                    </td>
                                    <td className="text-right">
                                      <button
                                        onClick={() => printThermalBarcode(product.name, product.sku, batch.batchNumber, batch.expiryDate, batch.barcodeUrl)}
                                        className="btn-ghost py-1 px-2.5 text-[10px] cursor-pointer"
                                      >
                                        <Printer className="w-3.5 h-3.5 shrink-0 text-orange-500" />
                                        Print Label
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Register Product */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="border border-white/60 bg-white/95 backdrop-blur-2xl w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-6 animate-scaleIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm uppercase text-zinc-955 tracking-wider">
                Register New Medicine
              </h3>
              <button 
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-zinc-450 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-500 uppercase mb-1.5 font-bold">Medicine Name</label>
                  <input
                    type="text"
                    required
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. Cetamol 500mg"
                    className="input-crisp text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 uppercase mb-1.5 font-bold">Medicine Code (SKU)</label>
                  <input
                    type="text"
                    required
                    value={newProductSku}
                    onChange={(e) => setNewProductSku(e.target.value)}
                    placeholder="e.g. CET-500"
                    className="input-crisp uppercase text-xs py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-500 uppercase mb-1.5 font-bold">Tablets Per Strip</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newTabletsPerStrip}
                    onChange={(e) => setNewTabletsPerStrip(e.target.value)}
                    className="input-crisp text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 uppercase mb-1.5 font-bold">Strips Per Box</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newStripsPerBox}
                    onChange={(e) => setNewStripsPerBox(e.target.value)}
                    className="input-crisp text-xs py-2.5"
                  />
                </div>
              </div>

              {/* Pricing Tiers Section */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-zinc-500 uppercase font-black text-[10px] tracking-wider">Volume Pricing Tiers (Per Box)</label>
                  <button
                    type="button"
                    onClick={addPricingTier}
                    className="py-1 px-2.5 rounded-lg border border-orange-250 bg-orange-50 text-orange-700 font-bold text-[10px] uppercase transition-all cursor-pointer"
                  >
                    + Add Tier
                  </button>
                </div>

                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {pricingTiers.map((tier, index) => (
                    <div key={index} className="flex gap-3 items-center">
                      <div className="flex-1 flex gap-2 items-center">
                        <input
                          type="number"
                          min="1"
                          placeholder="Min Qty"
                          value={tier.minQty}
                          onChange={(e) => updatePricingTier(index, 'minQty', parseInt(e.target.value) || 0)}
                          className="input-crisp text-center text-xs py-2 font-mono"
                        />
                        <span className="text-zinc-400 font-bold">to</span>
                        <input
                          type="number"
                          placeholder="Max Qty"
                          value={tier.maxQty}
                          onChange={(e) => updatePricingTier(index, 'maxQty', parseInt(e.target.value) || 0)}
                          className="input-crisp text-center text-xs py-2 font-mono"
                        />
                      </div>
                      <div className="w-1/3 flex items-center gap-1.5">
                        <span className="text-zinc-400 font-bold">Rs.</span>
                        <input
                          type="number"
                          placeholder="Price"
                          value={tier.pricePerBox}
                          onChange={(e) => updatePricingTier(index, 'pricePerBox', parseInt(e.target.value) || 0)}
                          className="input-crisp text-xs py-2 font-mono text-orange-655 font-bold"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePricingTier(index)}
                        disabled={pricingTiers.length === 1}
                        className="text-red-500 disabled:text-zinc-300 hover:text-red-700 cursor-pointer font-black text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #F97316, #F59E0B)', marginTop: 8, fontSize: 12 }}
              >
                Register Medication
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Ingest Stock Batch */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="border border-white/60 bg-white/95 backdrop-blur-2xl w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleIn overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm uppercase text-zinc-955 tracking-wider">
                Ingest Active Stock Batch
              </h3>
              <button 
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-zinc-455 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBatchSubmit} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-550 uppercase mb-1.5 font-bold">Batch ID / Number</label>
                  <input
                    type="text"
                    required
                    value={newBatchNumber}
                    onChange={(e) => setNewBatchNumber(e.target.value)}
                    placeholder="e.g. CET-2026-B1"
                    className="input-crisp uppercase text-xs py-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-550 uppercase mb-1.5 font-bold">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={newBatchExpiry}
                    onChange={(e) => setNewBatchExpiry(e.target.value)}
                    className="input-crisp text-xs py-2.5"
                  />
                </div>
              </div>

              {/* UOM Inputs */}
              <div>
                <label className="block text-zinc-550 uppercase mb-2 font-bold">Stock Ingestion Count</label>
                <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200/50 p-4 rounded-2xl">
                  <div>
                    <label className="block text-zinc-400 text-[9px] mb-1 font-bold text-center">BOXES</label>
                    <input
                      type="number"
                      min="0"
                      value={batchBoxes}
                      onChange={(e) => setBatchBoxes(e.target.value)}
                      className="w-full input-crisp bg-white text-center font-bold text-zinc-800 font-mono text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[9px] mb-1 font-bold text-center">STRIPS</label>
                    <input
                      type="number"
                      min="0"
                      value={batchStrips}
                      onChange={(e) => setBatchStrips(e.target.value)}
                      className="w-full input-crisp bg-white text-center font-bold text-zinc-800 font-mono text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-[9px] mb-1 font-bold text-center">TABLETS</label>
                    <input
                      type="number"
                      min="0"
                      value={batchTablets}
                      onChange={(e) => setBatchTablets(e.target.value)}
                      className="w-full input-crisp bg-white text-center font-bold text-zinc-800 font-mono text-xs py-2"
                    />
                  </div>
                </div>
              </div>

              {/* Buying / Selling Cost overrides */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-zinc-550 uppercase mb-1.5 font-bold">Buying Price (Per Box) (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchasePricePerBox}
                    onChange={(e) => {
                      setPurchasePricePerBox(e.target.value);
                      const targetProduct = products.find(p => p.id === selectedProductIdForBatch);
                      if (targetProduct) {
                        const tabs = targetProduct.tabletsPerStrip * targetProduct.stripsPerBox;
                        setNewManufacturingCost((parseFloat(e.target.value) / tabs).toFixed(4));
                      }
                    }}
                    className="input-crisp text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-zinc-550 uppercase mb-1.5 font-bold">Default Selling Price (Per Box) (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPricePerBox}
                    onChange={(e) => setSellingPricePerBox(e.target.value)}
                    className="input-crisp text-xs py-2.5"
                  />
                </div>
              </div>

              {/* Manufacturer / Supplier Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-550 uppercase mb-1.5 font-bold">Manufacturer Name</label>
                  <input
                    type="text"
                    value={manufacturerName}
                    onChange={(e) => setManufacturerName(e.target.value)}
                    placeholder="e.g. Deurali Janta"
                    className="input-crisp text-xs py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-zinc-550 uppercase mb-1.5 font-bold">Supplier Name</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. Kathmandu Medical House"
                    className="input-crisp text-xs py-2.5"
                  />
                </div>
              </div>

              {/* Invoice document attachment */}
              <div>
                <label className="block text-zinc-550 uppercase mb-1.5 font-bold">Purchase Invoice (.pdf, .jpg)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleInvoiceUpload}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-zinc-500 focus:outline-none file:bg-zinc-800 file:border-0 file:text-[9px] file:text-white file:font-black file:uppercase file:px-3 file:py-1 file:mr-2 file:rounded-full file:cursor-pointer"
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #F97316, #F59E0B)', marginTop: 8, fontSize: 12 }}
              >
                Confirm Batch Ingestion
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
