'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, AlertTriangle,
  Edit2, Trash2, X, Package, Printer, Eye,
  Building, Calendar, Hash, Layers, ChevronDown,
  Tag, RefreshCw, Filter, DollarSign
} from 'lucide-react';
import {
  ingestInventoryBatchAction,
  updateInventoryQuantityAction,
  deleteInventoryBatchAction
} from '@/app/actions/retailerActions';
import { useRealtimeEvent, broadcastUpdate } from '@/lib/events';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
}

interface RetailerInventory {
  id: string;
  productId: string;
  product: Product;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  createdAt: string;
  buyingPrice: number;
  sellingPrice: number;
  rack?: string | null;
}

interface InventoryClientProps {
  profileId: string;
  allProducts: Product[];
}

type SortKey = 'name' | 'quantity' | 'expiry' | 'batch';

const getExpiryStatus = (expiryDate: string): { label: string; color: string; bg: string } => {
  const now = Date.now();
  const exp = new Date(expiryDate).getTime();
  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'EXPIRED', color: '#EF4444', bg: '#FEF2F2' };
  if (daysLeft <= 30) return { label: `${daysLeft}d LEFT`, color: '#D97706', bg: '#FFFBEB' };
  if (daysLeft <= 90) return { label: `${daysLeft}d LEFT`, color: '#3B82F6', bg: '#EFF6FF' };
  return { label: 'GOOD', color: '#10B981', bg: '#F0FDF4' };
};

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--card-border)',
  outline: 'none',
  fontSize: 14,
  width: '100%',
  background: 'var(--card-bg)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 5,
  display: 'block',
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    {children}
  </div>
);

export default function InventoryClient({ profileId, allProducts: initialProducts }: InventoryClientProps) {
  const [inventory, setInventory] = useState<RetailerInventory[]>([]);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterExpiry, setFilterExpiry] = useState<'all' | 'expired' | 'near' | 'good'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [intakeMode, setIntakeMode] = useState<'select' | 'new'>('select');
  const [selectedProdId, setSelectedProdId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('General');
  const [newTabletsPerStrip, setNewTabletsPerStrip] = useState('10');
  const [newStripsPerBox, setNewStripsPerBox] = useState('10');
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [rack, setRack] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [intakeUom, setIntakeUom] = useState<'box' | 'strip' | 'tablet'>('tablet');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const [editingItem, setEditingItem] = useState<RetailerInventory | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editBuyingPrice, setEditBuyingPrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editRack, setEditRack] = useState('');

  const [detailBatch, setDetailBatch] = useState<RetailerInventory | null>(null);
  const [printPreviewBatch, setPrintPreviewBatch] = useState<RetailerInventory | null>(null);
  const [printCopies, setPrintCopies] = useState(1);
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [selectedBatchNumber, setSelectedBatchNumber] = useState('');
  const [batchPrintSelectedItems, setBatchPrintSelectedItems] = useState<Record<string, boolean>>({});
  const [batchPrintCopies, setBatchPrintCopies] = useState<Record<string, number>>({});

  useRealtimeEvent('INVENTORY_UPDATE', () => { fetchInventory(); fetchProducts(); });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const es = new EventSource(`/api/events?retailerId=${profileId}`);
    es.onmessage = (e) => {
      try { const p = JSON.parse(e.data); if (p.type === 'INVENTORY_UPDATE') { fetchInventory(); fetchProducts(); } } catch {}
    };
    es.onerror = () => { es.close(); };
    return () => { es.close(); };
  }, [profileId]);

  useEffect(() => {
    if (selectedBatchNumber) {
      const init: Record<string, boolean> = {};
      const initC: Record<string, number> = {};
      inventory.forEach((item) => {
        if (item.batchNumber === selectedBatchNumber) { init[item.id] = true; initC[item.id] = 1; }
      });
      setBatchPrintSelectedItems(init);
      setBatchPrintCopies(initC);
    } else {
      setBatchPrintSelectedItems({});
      setBatchPrintCopies({});
    }
  }, [selectedBatchNumber, inventory]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !showAddModal && !detailBatch && !editingItem) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setShowAddModal(false); setDetailBatch(null); setEditingItem(null); setPrintPreviewBatch(null); setShowBatchPrintModal(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); setShowAddModal(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showAddModal, detailBatch, editingItem]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/retailer/inventory');
      const data = await res.json();
      if (data.success) setInventory(data.inventory);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/retailer/search?q=&retailerId=' + profileId);
      const data = await res.json();
      if (data.medicines) setProducts(data.medicines);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchInventory();
    const interval = setInterval(fetchInventory, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const searchVal = params.get('search') || params.get('q');
      if (searchVal) setFilterQuery(searchVal);
    }
  }, []);

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (intakeMode === 'select' && !selectedProdId) { setFormError('Please select a medicine'); return; }
    if (intakeMode === 'new' && (!newProdName || !newProdSku)) { setFormError('Please fill name and SKU for custom medicine'); return; }
    if (!batchNumber || !quantity || !expiryDate) { setFormError('Batch Number, Quantity, and Expiry Date are required'); return; }
    try {
      setSubmitting(true);
      let factor = 1;
      let tabletsPerStripVal = 10;
      let stripsPerBoxVal = 10;
      if (intakeMode === 'select') {
        const prod = products.find(p => p.id === selectedProdId);
        if (prod) { tabletsPerStripVal = prod.tabletsPerStrip || 10; stripsPerBoxVal = prod.stripsPerBox || 10; }
      } else {
        tabletsPerStripVal = parseInt(newTabletsPerStrip) || 10;
        stripsPerBoxVal = parseInt(newStripsPerBox) || 10;
      }
      if (intakeUom === 'box') factor = tabletsPerStripVal * stripsPerBoxVal;
      else if (intakeUom === 'strip') factor = tabletsPerStripVal;
      const calculatedQty = parseInt(quantity) * factor;
      const payload: any = { batchNumber, quantity: calculatedQty, expiryDate, rack: rack || undefined, buyingPrice: parseFloat(buyingPrice) || 0, sellingPrice: parseFloat(sellingPrice) || 0 };
      if (intakeMode === 'select') payload.productId = selectedProdId;
      else { payload.name = newProdName; payload.sku = newProdSku; payload.category = showNewCategoryInput ? customCategory : newProdCategory; payload.tabletsPerStrip = tabletsPerStripVal; payload.stripsPerBox = stripsPerBoxVal; }
      const res = await ingestInventoryBatchAction(payload);
      if (res.success) {
        setShowAddModal(false);
        setSelectedProdId(''); setNewProdName(''); setNewProdSku('');
        setBatchNumber(''); setQuantity(''); setExpiryDate(''); setRack('');
        setBuyingPrice(''); setSellingPrice('');
        setShowNewCategoryInput(false); setCustomCategory('');
        broadcastUpdate('INVENTORY_UPDATE');
      }
    } catch (err: any) { setFormError(err.message || 'Failed to save inventory'); } finally { setSubmitting(false); }
  };

  const handleUpdateQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await updateInventoryQuantityAction(editingItem.id, parseInt(editQty), parseFloat(editBuyingPrice) || 0, parseFloat(editSellingPrice) || 0, editRack);
      if (res.success) { setEditingItem(null); broadcastUpdate('INVENTORY_UPDATE'); }
    } catch (err: any) { alert(err.message || 'Error updating'); }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Remove this inventory batch? This cannot be undone.')) return;
    try {
      const res = await deleteInventoryBatchAction(id);
      if (res.success) broadcastUpdate('INVENTORY_UPDATE');
    } catch (err: any) { alert(err.message || 'Error deleting item'); }
  };

  const handlePrintLabels = (item: RetailerInventory, copies: number) => {
    const pagesHtml = Array.from({ length: copies }).map(() => {
      const barcodeText = `MED-${item.product.sku.toUpperCase()}-${item.batchNumber.toUpperCase()}`;
      const tabletsPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
      const boxes = Math.floor(item.quantity / tabletsPerBox);
      return `<div class="label-page"><div class="header">MedHub Pharmacy Stock</div><div class="med">${item.product.name}</div><div class="details"><span>BATCH: ${item.batchNumber}</span><span>SKU: ${item.product.sku}</span></div><div class="details"><span>CATEGORY: ${item.product.category}</span><span>${boxes} BOXES (${item.quantity} Units)</span></div><div class="barcode-text">${barcodeText}</div><div class="footer">EXPIRY: ${new Date(item.expiryDate).toLocaleDateString()}</div></div>`;
    }).join('');
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Labels</title><style>@page{margin:20px}body{font-family:monospace;color:black;margin:0;padding:0}.label-page{page-break-after:always;padding:16px;border:2px solid #000;max-width:300px;margin:20px auto}.label-page:last-child{page-break-after:avoid}.header{font-size:13px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}.med{font-size:15px;font-weight:900;margin-bottom:4px;text-transform:uppercase}.details{display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px}.barcode-text{text-align:center;font-size:12px;font-weight:800;border:1px solid #000;padding:6px;margin:6px 0}.footer{font-size:10px;border-top:1px solid #000;padding-top:4px;text-align:center}</style></head><body>${pagesHtml}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);}<\/script></body></html>`);
    win.document.close();
    setPrintPreviewBatch(null);
  };

  const handleBatchPrintLabels = (printItems: { item: RetailerInventory; copies: number }[]) => {
    const pagesHtml = printItems.flatMap(({ item, copies }) =>
      Array.from({ length: copies }).map(() => {
        const barcodeText = `MED-${item.product.sku.toUpperCase()}-${item.batchNumber.toUpperCase()}`;
        const tabletsPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
        const boxes = Math.floor(item.quantity / tabletsPerBox);
        return `<div class="label-page"><div class="header">MedHub Pharmacy Stock</div><div class="med">${item.product.name}</div><div class="details"><span>BATCH: ${item.batchNumber}</span><span>SKU: ${item.product.sku}</span></div><div class="details"><span>${item.product.category}</span><span>${boxes} BOXES</span></div><div class="barcode-text">${barcodeText}</div><div class="footer">EXPIRY: ${new Date(item.expiryDate).toLocaleDateString()}</div></div>`;
      })
    ).join('');
    if (!pagesHtml) return;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Labels</title><style>@page{margin:20px}body{font-family:monospace;color:black;margin:0;padding:0}.label-page{page-break-after:always;padding:16px;border:2px solid #000;max-width:300px;margin:20px auto}.label-page:last-child{page-break-after:avoid}.header{font-size:13px;font-weight:900;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}.med{font-size:15px;font-weight:900;margin-bottom:4px;text-transform:uppercase}.details{display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px}.barcode-text{text-align:center;font-size:12px;font-weight:800;border:1px solid #000;padding:6px;margin:6px 0}.footer{font-size:10px;border-top:1px solid #000;padding-top:4px;text-align:center}</style></head><body>${pagesHtml}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);}<\/script></body></html>`);
    win.document.close();
  };

  const uniqueCategories = Array.from(new Set(inventory.map((i) => i.product.category)));

  const filtered = inventory
    .filter((item) => {
      const q = filterQuery.toLowerCase();
      const matchesQuery = item.product.name.toLowerCase().includes(q) || item.product.sku.toLowerCase().includes(q) || item.batchNumber.toLowerCase().includes(q);
      const matchesCategory = filterCategory === 'all' || item.product.category === filterCategory;
      if (filterExpiry !== 'all') {
        const daysLeft = Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (filterExpiry === 'expired' && daysLeft >= 0) return false;
        if (filterExpiry === 'near' && (daysLeft < 0 || daysLeft > 30)) return false;
        if (filterExpiry === 'good' && daysLeft <= 30) return false;
      }
      return matchesQuery && matchesCategory;
    })
    .sort((a, b) => {
      let valA: any, valB: any;
      if (sortKey === 'name') { valA = a.product.name; valB = b.product.name; }
      else if (sortKey === 'quantity') { valA = a.quantity; valB = b.quantity; }
      else if (sortKey === 'expiry') { valA = new Date(a.expiryDate).getTime(); valB = new Date(b.expiryDate).getTime(); }
      else { valA = a.batchNumber; valB = b.batchNumber; }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const totalBoxes = filtered.reduce((sum, item) => {
    const tpb = item.product.tabletsPerStrip * item.product.stripsPerBox;
    return sum + Math.floor(item.quantity / tpb);
  }, 0);

  const expiredCount = inventory.filter(i => new Date(i.expiryDate).getTime() < Date.now()).length;
  const nearCount = inventory.filter(i => { const d = Math.ceil((new Date(i.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)); return d >= 0 && d <= 30; }).length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <ChevronDown style={{ width: 12, height: 12, opacity: sortKey === k ? 1 : 0.3, transform: sortKey === k && !sortAsc ? 'rotate(180deg)' : undefined, transition: 'all 0.15s' }} />
  );

  const thStyle: React.CSSProperties = { padding: '11px 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };

  const Modal = ({ children, onClose, maxWidth = 580 }: { children: React.ReactNode; onClose: () => void; maxWidth?: number }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth, background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Pharmacy Inventory</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            Shelf stock overview · Click any row for batch details
            <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-muted)' }}>[/] Search · [Ctrl+N] Intake</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowBatchPrintModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Printer style={{ width: 14, height: 14 }} /> Batch Print
          </button>
          <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F59E0B', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus style={{ width: 14, height: 14 }} /> Intake Batch
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Total SKUs', val: inventory.length, color: '#3B82F6' },
          { label: 'Total Boxes', val: totalBoxes, color: '#10B981' },
          { label: 'Near Expiry', val: nearCount, color: '#D97706' },
          { label: 'Expired', val: expiredCount, color: '#EF4444' },
        ].map((s) => (
          <div key={s.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--table-header-bg)', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
          <Search style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
          <input ref={searchRef} type="text" placeholder="Search name, SKU or batch…" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--text-primary)' }} />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, outline: 'none', background: 'var(--table-header-bg)', color: 'var(--text-secondary)', fontWeight: 500 }}>
          <option value="all">All Categories</option>
          {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterExpiry} onChange={(e) => setFilterExpiry(e.target.value as any)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, outline: 'none', background: 'var(--table-header-bg)', color: 'var(--text-secondary)', fontWeight: 500 }}>
          <option value="all">All Expiry Status</option>
          <option value="expired">Expired</option>
          <option value="near">Near Expiry (≤30d)</option>
          <option value="good">Good Stock</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{filtered.length} / {inventory.length} items</span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden', flex: 1 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 28, height: 28, border: '3px solid #F1F5F9', borderTopColor: '#F59E0B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading inventory…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Package style={{ width: 40, height: 40, color: '#E2E8F0' }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No inventory items found</div>
            <div style={{ fontSize: 13 }}>Adjust filters or record a manual intake batch</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('name')}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Medicine <SortIcon k="name" /></span></th>
                <th style={thStyle}>SKU / Category</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('batch')}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Batch <SortIcon k="batch" /></span></th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('quantity')}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Stock <SortIcon k="quantity" /></span></th>
                <th style={thStyle}>Buy / Sell</th>
                <th style={thStyle}>Rack</th>
                <th style={{ ...thStyle, cursor: 'pointer' }} onClick={() => handleSort('expiry')}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Expiry <SortIcon k="expiry" /></span></th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const tabletsPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
                const boxes = Math.floor(item.quantity / tabletsPerBox);
                const strips = Math.floor((item.quantity % tabletsPerBox) / item.product.tabletsPerStrip);
                const tablets = item.quantity % item.product.tabletsPerStrip;
                const expiryStatus = getExpiryStatus(item.expiryDate);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--card-border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onClick={() => setDetailBatch(item)}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--table-header-bg)'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{item.product.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{item.product.tabletsPerStrip}t × {item.product.stripsPerBox}s/box</div>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--table-header-bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--card-border)' }}>{item.product.sku}</span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{item.product.category}</div>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{item.batchNumber}</span>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{item.quantity.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>units</span></div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                        {boxes > 0 && `${boxes}b`}{(strips > 0 || tablets > 0) && ' · '}{strips > 0 && `${strips}s`}{tablets > 0 && ` ${tablets}t`}
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>B: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>Rs. {item.buyingPrice?.toFixed(0) || '0'}</span></div>
                      <div style={{ fontSize: 12, color: '#10B981', marginTop: 2 }}>S: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>Rs. {item.sellingPrice?.toFixed(0) || '0'}</span></div>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      {item.rack ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace' }}>{item.rack}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: expiryStatus.bg, color: expiryStatus.color, whiteSpace: 'nowrap' }}>{expiryStatus.label}</span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{new Date(item.expiryDate).toLocaleDateString()}</div>
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button onClick={() => setPrintPreviewBatch(item)} style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '5px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Print label">
                          <Printer style={{ width: 13, height: 13 }} />
                        </button>
                        <button onClick={() => { setEditingItem(item); setEditQty(String(item.quantity)); setEditBuyingPrice(String(item.buyingPrice || '')); setEditSellingPrice(String(item.sellingPrice || '')); setEditRack(item.rack || ''); }} style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '5px', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Edit">
                          <Edit2 style={{ width: 13, height: 13 }} />
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)} style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '5px', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Delete">
                          <Trash2 style={{ width: 13, height: 13 }} />
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

      {/* ── Detail Modal ── */}
      {detailBatch && (() => {
        const tabletsPerBox = detailBatch.product.tabletsPerStrip * detailBatch.product.stripsPerBox;
        const boxes = Math.floor(detailBatch.quantity / tabletsPerBox);
        const strips = Math.floor((detailBatch.quantity % tabletsPerBox) / detailBatch.product.tabletsPerStrip);
        const tablets = detailBatch.quantity % detailBatch.product.tabletsPerStrip;
        const expiryStatus = getExpiryStatus(detailBatch.expiryDate);
        return (
          <Modal onClose={() => setDetailBatch(null)} maxWidth={520}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{detailBatch.product.name}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Batch {detailBatch.batchNumber}</p>
              </div>
              <button onClick={() => setDetailBatch(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: expiryStatus.bg, color: expiryStatus.color, display: 'inline-block', width: 'fit-content' }}>
                {expiryStatus.label} · {new Date(detailBatch.expiryDate).toLocaleDateString()}
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'SKU', val: detailBatch.product.sku, mono: true },
                  { label: 'Category', val: detailBatch.product.category },
                  { label: 'Tablet Structure', val: `${detailBatch.product.tabletsPerStrip}t × ${detailBatch.product.stripsPerBox}s = ${tabletsPerBox}/box` },
                  { label: 'Ingested', val: new Date(detailBatch.createdAt).toLocaleDateString() },
                  { label: 'Buying Price', val: `Rs. ${detailBatch.buyingPrice?.toFixed(2) || '0.00'}`, mono: true },
                  { label: 'Selling Price', val: `Rs. ${detailBatch.sellingPrice?.toFixed(2) || '0.00'}`, mono: true },
                  { label: 'Rack', val: detailBatch.rack || '— Not assigned' },
                ].map((row) => (
                  <div key={row.label} style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 }}>{row.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: row.mono ? 'monospace' : undefined }}>{row.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--table-header-bg)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Stock Breakdown</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ val: boxes, label: 'Boxes', color: '#3B82F6' }, { val: strips, label: 'Strips', color: '#F59E0B' }, { val: tablets, label: 'Tablets', color: '#10B981' }, { val: detailBatch.quantity, label: 'Total Units', color: 'var(--text-secondary)' }].map((s) => (
                    <div key={s.label} style={{ flex: 1, textAlign: 'center', background: 'var(--card-bg)', borderRadius: 8, padding: '8px', border: '1px solid var(--card-border)' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10 }}>
              <button onClick={() => { setEditingItem(detailBatch); setEditQty(String(detailBatch.quantity)); setEditBuyingPrice(String(detailBatch.buyingPrice || '')); setEditSellingPrice(String(detailBatch.sellingPrice || '')); setEditRack(detailBatch.rack || ''); setDetailBatch(null); }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>
                Edit Quantity
              </button>
              <button onClick={() => { setPrintPreviewBatch(detailBatch); setDetailBatch(null); }} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Printer style={{ width: 14, height: 14 }} /> Print Labels
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* ── Edit Modal ── */}
      {editingItem && (
        <Modal onClose={() => setEditingItem(null)} maxWidth={440}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Edit — {editingItem.product.name}</h3>
            <button onClick={() => setEditingItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
          </div>
          <form onSubmit={handleUpdateQuantity}>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Quantity (Base Units)"><input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)} style={inputStyle} /></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Buying Price (Rs.)"><input type="number" step="0.01" value={editBuyingPrice} onChange={(e) => setEditBuyingPrice(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
                <Field label="Selling Price (Rs.)"><input type="number" step="0.01" value={editSellingPrice} onChange={(e) => setEditSellingPrice(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
              </div>
              <Field label="Rack / Location"><input type="text" value={editRack} onChange={(e) => setEditRack(e.target.value)} placeholder="e.g. A-4" style={inputStyle} /></Field>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setEditingItem(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button type="submit" style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#3B82F6', color: '#FFFFFF' }}>Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Print Label Modal ── */}
      {printPreviewBatch && (
        <Modal onClose={() => setPrintPreviewBatch(null)} maxWidth={400}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Printer style={{ width: 15, height: 15, color: '#F59E0B' }} /> Print Labels</h3>
            <button onClick={() => setPrintPreviewBatch(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
          </div>
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{printPreviewBatch.product.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Batch: {printPreviewBatch.batchNumber} · Exp: {new Date(printPreviewBatch.expiryDate).toLocaleDateString()}</div>
            </div>
            <Field label="Number of Copies">
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {[1, 5, 10, 25].map((n) => (
                  <button key={n} type="button" onClick={() => setPrintCopies(n)} style={{ flex: 1, padding: '7px', borderRadius: 7, border: `1px solid ${printCopies === n ? '#F59E0B' : 'var(--card-border)'}`, background: printCopies === n ? '#FFFBEB' : 'var(--card-bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: printCopies === n ? '#D97706' : 'var(--text-secondary)' }}>{n}</button>
                ))}
              </div>
              <input type="number" min="1" max="100" value={printCopies} onChange={(e) => setPrintCopies(parseInt(e.target.value) || 1)} placeholder="Custom…" style={inputStyle} />
            </Field>
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10 }}>
            <button onClick={() => setPrintPreviewBatch(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>Cancel</button>
            <button onClick={() => handlePrintLabels(printPreviewBatch, printCopies)} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Printer style={{ width: 14, height: 14 }} /> Print {printCopies} Label{printCopies > 1 ? 's' : ''}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Batch Print Modal ── */}
      {showBatchPrintModal && (() => {
        const distinctBatches = Array.from(new Set(inventory.map((item) => item.batchNumber)));
        const batchMedicines = inventory.filter((item) => item.batchNumber === selectedBatchNumber);
        const totalBatchPrintCount = Object.entries(batchPrintSelectedItems).filter(([id, checked]) => checked).reduce((sum, [id]) => sum + (batchPrintCopies[id] || 0), 0);
        return (
          <Modal onClose={() => setShowBatchPrintModal(false)} maxWidth={620}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Printer style={{ width: 15, height: 15, color: '#10B981' }} /> Batch Print Labels</h3>
              <button onClick={() => setShowBatchPrintModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Select Batch Number">
                <select value={selectedBatchNumber} onChange={(e) => setSelectedBatchNumber(e.target.value)} style={inputStyle}>
                  <option value="">-- Choose a Batch --</option>
                  {distinctBatches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              {selectedBatchNumber && (
                <div style={{ overflowY: 'auto' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Medicines in Batch "{selectedBatchNumber}"</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                        <th style={{ ...thStyle, width: 40 }}>✓</th>
                        <th style={thStyle}>Medicine</th>
                        <th style={thStyle}>Stock</th>
                        <th style={{ ...thStyle, width: 100 }}>Copies</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchMedicines.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <input type="checkbox" checked={!!batchPrintSelectedItems[item.id]} onChange={(e) => setBatchPrintSelectedItems({ ...batchPrintSelectedItems, [item.id]: e.target.checked })} style={{ accentColor: '#10B981', cursor: 'pointer' }} />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.product.sku}</div>
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{item.quantity} units</td>
                          <td style={{ padding: '8px 10px' }}>
                            <input type="number" min="1" value={batchPrintCopies[item.id] || 1} onChange={(e) => setBatchPrintCopies({ ...batchPrintCopies, [item.id]: parseInt(e.target.value) || 1 })} disabled={!batchPrintSelectedItems[item.id]} style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--card-border)', outline: 'none', fontSize: 13 }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10 }}>
              <button onClick={() => setShowBatchPrintModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button onClick={() => { const toPrint = inventory.filter(item => batchPrintSelectedItems[item.id] && (batchPrintCopies[item.id] || 0) > 0).map(item => ({ item, copies: batchPrintCopies[item.id] })); if (!toPrint.length) { alert('Select at least one item'); return; } handleBatchPrintLabels(toPrint); setShowBatchPrintModal(false); }} disabled={!selectedBatchNumber || totalBatchPrintCount === 0} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: selectedBatchNumber && totalBatchPrintCount > 0 ? 'pointer' : 'not-allowed', background: selectedBatchNumber && totalBatchPrintCount > 0 ? '#10B981' : '#CBD5E1', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Printer style={{ width: 14, height: 14 }} /> Print {totalBatchPrintCount} Label{totalBatchPrintCount !== 1 ? 's' : ''}
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* ── Intake Modal ── */}
      {showAddModal && (
        <div onClick={() => setShowAddModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={handleAddInventory} style={{ width: '100%', maxWidth: 740, maxHeight: '90vh', background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Intake Medicine Batch</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Register newly received stock in the pharmacy warehouse</p>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X style={{ width: 18, height: 18 }} /></button>
            </div>

            <div style={{ padding: '18px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
              {formError && <div style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA', color: '#DC2626', fontSize: 13, fontWeight: 600 }}>{formError}</div>}

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 1, background: 'var(--table-header-bg)', borderRadius: 8, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                {(['select', 'new'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setIntakeMode(m)} style={{ flex: 1, padding: '10px', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: intakeMode === m ? 'var(--card-bg)' : 'transparent', color: intakeMode === m ? '#F59E0B' : 'var(--text-muted)', borderRight: m === 'select' ? '1px solid var(--card-border)' : 'none' }}>
                    {m === 'select' ? 'Existing Medicine' : 'New Custom Medicine'}
                  </button>
                ))}
              </div>

              {intakeMode === 'select' ? (
                <Field label="Select Medicine">
                  <select value={selectedProdId} onChange={(e) => setSelectedProdId(e.target.value)} style={inputStyle}>
                    <option value="">— Select Medicine —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}) [{p.category}]</option>)}
                  </select>
                </Field>
              ) : (
                <div style={{ border: '1px solid #FDE68A', padding: '16px 18px', borderRadius: 10, background: '#FFFDF7', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>New Custom Medicine</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Medicine Name"><input type="text" value={newProdName} onChange={(e) => setNewProdName(e.target.value)} placeholder="e.g. Paracetamol 500mg" style={inputStyle} /></Field>
                    <Field label="SKU Code"><input type="text" value={newProdSku} onChange={(e) => setNewProdSku(e.target.value)} placeholder="e.g. PARA-500" style={inputStyle} /></Field>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12 }}>
                    <Field label="Category">
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={showNewCategoryInput ? 'NEW' : newProdCategory} onChange={(e) => { if (e.target.value === 'NEW') setShowNewCategoryInput(true); else { setShowNewCategoryInput(false); setNewProdCategory(e.target.value); } }} style={{ ...inputStyle, flex: 1 }}>
                          {Array.from(new Set(['General', 'Analgesics', 'Antibiotics', 'Vitamins', ...products.map(p => p.category).filter(Boolean)])).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          <option value="NEW">+ Add Custom</option>
                        </select>
                        {showNewCategoryInput && <input type="text" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Category name" style={{ ...inputStyle, flex: 1 }} />}
                      </div>
                    </Field>
                    <Field label="Tablets / Strip"><input type="number" value={newTabletsPerStrip} onChange={(e) => setNewTabletsPerStrip(e.target.value)} style={inputStyle} /></Field>
                    <Field label="Strips / Box"><input type="number" value={newStripsPerBox} onChange={(e) => setNewStripsPerBox(e.target.value)} style={inputStyle} /></Field>
                  </div>
                </div>
              )}

              <div style={{ border: '1px solid var(--card-border)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Batch Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <Field label="Batch Number"><input type="text" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="e.g. B-PARA-2026" style={inputStyle} /></Field>
                  <Field label="Expiry Date"><input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={inputStyle} /></Field>
                  <Field label="Rack / Location"><input type="text" value={rack} onChange={(e) => setRack(e.target.value)} placeholder="e.g. A-4" style={inputStyle} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  <Field label="Unit of Measure">
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(['tablet', 'strip', 'box'] as const).map((u) => (
                        <button key={u} type="button" onClick={() => setIntakeUom(u)} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: `1px solid ${intakeUom === u ? '#F59E0B' : 'var(--card-border)'}`, background: intakeUom === u ? '#FFFBEB' : 'var(--card-bg)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: intakeUom === u ? '#D97706' : 'var(--text-secondary)' }}>{u}</button>
                      ))}
                    </div>
                  </Field>
                  <Field label={`Qty (${intakeUom}s)`}><input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" style={inputStyle} /></Field>
                  <Field label="Buying Price (Rs.)"><input type="number" step="0.01" value={buyingPrice} onChange={(e) => setBuyingPrice(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
                  <Field label="Selling Price (Rs.)"><input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="0.00" style={inputStyle} /></Field>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--card-bg)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button type="submit" disabled={submitting} style={{ flex: 3, padding: '10px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF' }}>
                {submitting ? 'Registering…' : 'Register Batch'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
