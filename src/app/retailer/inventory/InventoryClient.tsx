'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, AlertTriangle, ShieldAlert,
  Edit2, Trash2, X, Package, Printer, Eye,
  Building, Calendar, Hash, Layers, ChevronDown,
  Tag, RefreshCw, Filter, ShoppingBag, DollarSign
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
  if (daysLeft < 0) return { label: 'EXPIRED', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' };
  if (daysLeft <= 30) return { label: `${daysLeft}d LEFT`, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' };
  if (daysLeft <= 90) return { label: `${daysLeft}d LEFT`, color: '#3B82F6', bg: 'rgba(59,130,246,0.08)' };
  return { label: 'GOOD', color: '#10B981', bg: 'rgba(16,185,129,0.08)' };
};

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

  // Add Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [intakeMode, setIntakeMode] = useState<'select' | 'new'>('select');
  
  // Existing product intake form state
  const [selectedProdId, setSelectedProdId] = useState('');
  
  // New product form state
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('General');
  const [newTabletsPerStrip, setNewTabletsPerStrip] = useState('10');
  const [newStripsPerBox, setNewStripsPerBox] = useState('10');

  // Common batch intake fields
  const [batchNumber, setBatchNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [rack, setRack] = useState('');
  
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // UOM & Category States
  const [intakeUom, setIntakeUom] = useState<'box' | 'strip' | 'tablet' | 'bottle' | 'vial'>('tablet');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  // Edit Modal
  const [editingItem, setEditingItem] = useState<RetailerInventory | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editBuyingPrice, setEditBuyingPrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [editRack, setEditRack] = useState('');

  // Detail Modal
  const [detailBatch, setDetailBatch] = useState<RetailerInventory | null>(null);

  // Print Label States
  const [printPreviewBatch, setPrintPreviewBatch] = useState<RetailerInventory | null>(null);
  const [printCopies, setPrintCopies] = useState(1);

  // Batch Print Modal States
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [selectedBatchNumber, setSelectedBatchNumber] = useState('');
  const [batchPrintSelectedItems, setBatchPrintSelectedItems] = useState<Record<string, boolean>>({});
  const [batchPrintCopies, setBatchPrintCopies] = useState<Record<string, number>>({});

  // Listen to realtime events to trigger fetch
  useRealtimeEvent('INVENTORY_UPDATE', () => {
    fetchInventory();
    fetchProducts();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const es = new EventSource(`/api/events?retailerId=${profileId}`);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.type === 'INVENTORY_UPDATE') {
          fetchInventory();
          fetchProducts();
        }
      } catch (err) {}
    };
    es.onerror = () => {
      es.close();
    };
    return () => {
      es.close();
    };
  }, [profileId]);

  // Sync batch print modal selections when a batch number is selected
  useEffect(() => {
    if (selectedBatchNumber) {
      const initialChecks: Record<string, boolean> = {};
      const initialCopies: Record<string, number> = {};
      inventory.forEach((item) => {
        if (item.batchNumber === selectedBatchNumber) {
          initialChecks[item.id] = true;
          initialCopies[item.id] = 1;
        }
      });
      setBatchPrintSelectedItems(initialChecks);
      setBatchPrintCopies(initialCopies);
    } else {
      setBatchPrintSelectedItems({});
      setBatchPrintCopies({});
    }
  }, [selectedBatchNumber, inventory]);

  // Keyboard shortcut: / to focus search, Escape to close modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !showAddModal && !detailBatch && !editingItem) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setDetailBatch(null);
        setEditingItem(null);
        setPrintPreviewBatch(null);
        setShowBatchPrintModal(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowAddModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showAddModal, detailBatch, editingItem]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/retailer/inventory');
      const data = await res.json();
      if (data.success) {
        setInventory(data.inventory);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      // Reload products catalog for the dropdown list
      const res = await fetch('/api/retailer/search?q=&retailerId=' + profileId);
      const data = await res.json();
      if (data.medicines) {
        setProducts(data.medicines);
      }
    } catch (e) {
      console.error(e);
    }
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
      if (searchVal) {
        setFilterQuery(searchVal);
      }
    }
  }, []);

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (intakeMode === 'select' && !selectedProdId) {
      setFormError('Please select a medicine');
      return;
    }
    if (intakeMode === 'new' && (!newProdName || !newProdSku)) {
      setFormError('Please fill name and SKU for custom medicine');
      return;
    }
    if (!batchNumber || !quantity || !expiryDate) {
      setFormError('Please fill batch details: Batch Number, Quantity, and Expiry Date');
      return;
    }

    try {
      setSubmitting(true);
      
      let factor = 1;
      let tabletsPerStripVal = 10;
      let stripsPerBoxVal = 10;

      if (intakeMode === 'select') {
        const prod = products.find(p => p.id === selectedProdId);
        if (prod) {
          tabletsPerStripVal = prod.tabletsPerStrip || 10;
          stripsPerBoxVal = prod.stripsPerBox || 10;
        }
      } else {
        tabletsPerStripVal = parseInt(newTabletsPerStrip) || 10;
        stripsPerBoxVal = parseInt(newStripsPerBox) || 10;
      }

      if (intakeUom === 'box') {
        factor = tabletsPerStripVal * stripsPerBoxVal;
      } else if (intakeUom === 'strip') {
        factor = tabletsPerStripVal;
      }

      const calculatedQty = parseInt(quantity) * factor;

      const payload: any = {
        batchNumber,
        quantity: calculatedQty,
        expiryDate,
        rack: rack || undefined,
      };

      if (intakeMode === 'select') {
        payload.productId = selectedProdId;
      } else {
        payload.name = newProdName;
        payload.sku = newProdSku;
        payload.category = showNewCategoryInput ? customCategory : newProdCategory;
        payload.tabletsPerStrip = tabletsPerStripVal;
        payload.stripsPerBox = stripsPerBoxVal;
      }

      const res = await ingestInventoryBatchAction(payload);
      if (res.success) {
        setShowAddModal(false);
        // Clear state
        setSelectedProdId('');
        setNewProdName('');
        setNewProdSku('');
        setBatchNumber('');
        setQuantity('');
        setExpiryDate('');
        setRack('');
        setShowNewCategoryInput(false);
        setCustomCategory('');
        
        // Broadcast updates
        broadcastUpdate('INVENTORY_UPDATE');
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save inventory');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateQuantity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await updateInventoryQuantityAction(
        editingItem.id,
        parseInt(editQty),
        parseFloat(editBuyingPrice) || 0,
        parseFloat(editSellingPrice) || 0,
        editRack
      );
      if (res.success) {
        setEditingItem(null);
        broadcastUpdate('INVENTORY_UPDATE');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating quantity');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Remove this inventory batch? This action cannot be undone.')) return;
    try {
      const res = await deleteInventoryBatchAction(id);
      if (res.success) {
        broadcastUpdate('INVENTORY_UPDATE');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting item');
    }
  };

  const handlePrintLabels = (item: RetailerInventory, copies: number) => {
    const pagesHtml = Array.from({ length: copies }).map(() => {
      const barcodeText = `MED-${item.product.sku.toUpperCase()}-${item.batchNumber.toUpperCase()}`;
      const tabletsPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
      const boxes = Math.floor(item.quantity / tabletsPerBox);
      return `
        <div class="label-page">
          <div class="header">MedHub Pharmacy Stock</div>
          <div class="med">${item.product.name}</div>
          <div class="details">
            <span>BATCH: ${item.batchNumber}</span>
            <span>SKU: ${item.product.sku}</span>
          </div>
          <div class="details">
            <span>CATEGORY: ${item.product.category}</span>
            <span>${boxes} BOXES (${item.quantity} Units)</span>
          </div>
          <div class="barcode-text">${barcodeText}</div>
          <div class="footer">EXPIRY: ${new Date(item.expiryDate).toLocaleDateString()}</div>
        </div>
      `;
    }).join('');

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Batch Labels</title><style>
      @page { margin: 20px; }
      body { font-family: monospace; color: black; margin: 0; padding: 0; }
      .label-page { page-break-after: always; padding: 16px; border: 2px solid #000; max-width: 300px; margin: 20px auto; }
      .label-page:last-child { page-break-after: avoid; }
      .header { font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
      .med { font-size: 15px; font-weight: 900; margin-bottom: 4px; text-transform: uppercase; }
      .details { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
      .barcode-text { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 0.05em; border: 1px solid #000; padding: 6px; margin: 6px 0; background: #fff; }
      .footer { font-size: 10px; border-top: 1px solid #000; padding-top: 4px; text-align: center; }
    </style></head><body>${pagesHtml}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};<\/script></body></html>`);
    printWindow.document.close();
    setPrintPreviewBatch(null);
  };

  const handleBatchPrintLabels = (printItems: { item: RetailerInventory; copies: number }[]) => {
    const pagesHtml = printItems.flatMap(({ item, copies }) => {
      return Array.from({ length: copies }).map(() => {
        const barcodeText = `MED-${item.product.sku.toUpperCase()}-${item.batchNumber.toUpperCase()}`;
        const tabletsPerBox = item.product.tabletsPerStrip * item.product.stripsPerBox;
        const boxes = Math.floor(item.quantity / tabletsPerBox);
        return `
          <div class="label-page">
            <div class="header">MedHub Pharmacy Stock</div>
            <div class="med">${item.product.name}</div>
            <div class="details">
              <span>BATCH: ${item.batchNumber}</span>
              <span>SKU: ${item.product.sku}</span>
            </div>
            <div class="details">
              <span>CATEGORY: ${item.product.category}</span>
              <span>${boxes} BOXES (${item.quantity} Units)</span>
            </div>
            <div class="barcode-text">${barcodeText}</div>
            <div class="footer">EXPIRY: ${new Date(item.expiryDate).toLocaleDateString()}</div>
          </div>
        `;
      });
    }).join('');

    if (!pagesHtml) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Batch Labels</title><style>
      @page { margin: 20px; }
      body { font-family: monospace; color: black; margin: 0; padding: 0; }
      .label-page { page-break-after: always; padding: 16px; border: 2px solid #000; max-width: 300px; margin: 20px auto; }
      .label-page:last-child { page-break-after: avoid; }
      .header { font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
      .med { font-size: 15px; font-weight: 900; margin-bottom: 4px; text-transform: uppercase; }
      .details { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; }
      .barcode-text { text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 0.05em; border: 1px solid #000; padding: 6px; margin: 6px 0; background: #fff; }
      .footer { font-size: 10px; border-top: 1px solid #000; padding-top: 4px; text-align: center; }
    </style></head><body>${pagesHtml}<script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);};<\/script></body></html>`);
    printWindow.document.close();
  };

  const uniqueCategories = Array.from(new Set(inventory.map((i) => i.product.category)));

  const filtered = inventory
    .filter((item) => {
      const matchesQuery =
        item.product.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        item.product.sku.toLowerCase().includes(filterQuery.toLowerCase()) ||
        item.batchNumber.toLowerCase().includes(filterQuery.toLowerCase());
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
  const nearCount = inventory.filter(i => {
    const d = Math.ceil((new Date(i.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return d >= 0 && d <= 30;
  }).length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <ChevronDown
      style={{ width: 12, height: 12, opacity: sortKey === k ? 1 : 0.3, transform: sortKey === k && !sortAsc ? 'rotate(180deg)' : undefined, transition: 'all 0.15s' }}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1E293B', margin: 0 }}>Pharmacy Inventory</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            Shelf stock overview — Click any row for advanced batch details
            <span style={{ marginLeft: 10, fontSize: 11, color: '#94A3B8' }}>[ / ] Search · [ Ctrl+N ] Intake Batch</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowBatchPrintModal(true)}
            style={{ background: '#10B981', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
          >
            <Printer style={{ width: 15, height: 15 }} />
            Batch Print Labels
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ background: '#F59E0B', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
          >
            <Plus style={{ width: 15, height: 15 }} />
            Intake Batch
          </button>
        </div>
      </div>

      {/* ── Summary Pills ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Total SKUs', val: inventory.length, color: '#3B82F6', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)' },
          { label: 'Total Boxes', val: totalBoxes, color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
          { label: 'Near Expiry', val: nearCount, color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
          { label: 'Expired', val: expiredCount, color: '#EF4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)' },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filters bar ── */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 18px', background: '#FFFFFF', borderRadius: 14, border: '1.5px solid #F1F5F9', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <Search style={{ width: 14, height: 14, color: '#94A3B8' }} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search name, SKU or batch…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 12, color: '#334155' }}
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none', background: '#F8FAFC', color: '#475569', fontWeight: 600 }}
        >
          <option value="all">All Categories</option>
          {uniqueCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={filterExpiry}
          onChange={(e) => setFilterExpiry(e.target.value as any)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none', background: '#F8FAFC', color: '#475569', fontWeight: 600 }}
        >
          <option value="all">All Expiry Status</option>
          <option value="expired">Expired</option>
          <option value="near">Near Expiry (≤30d)</option>
          <option value="good">Good Stock</option>
        </select>

        <div style={{ fontSize: 12, color: '#94A3B8', alignSelf: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {filtered.length} / {inventory.length} rows
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #F1F5F9', borderTopColor: '#F59E0B', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13, color: '#94A3B8' }}>Loading inventory…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Package style={{ width: 48, height: 48, color: '#E2E8F0' }} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No inventory items found</div>
            <div style={{ fontSize: 12 }}>Try adjusting filters or record a manual intake batch</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #F1F5F9' }}>
                <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Medicine <SortIcon k="name" /></span>
                </th>
                <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>SKU / Category</th>
                <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('batch')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Batch <SortIcon k="batch" /></span>
                </th>
                <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('quantity')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Stock <SortIcon k="quantity" /></span>
                </th>
                <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>Buying Price</th>
                <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>Selling Price</th>
                <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700 }}>Rack</th>
                <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('expiry')}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Expiry <SortIcon k="expiry" /></span>
                </th>
                <th style={{ padding: '14px 20px', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Actions</th>
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
                  <tr
                    key={item.id}
                    style={{ borderBottom: '1px solid #F8FAFC', cursor: 'pointer', transition: 'background 0.1s' }}
                    onClick={() => setDetailBatch(item)}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#FAFBFC'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = ''}
                  >
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 800, color: '#1E293B' }}>{item.product.name}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Layers style={{ width: 10, height: 10 }} />
                        {item.product.tabletsPerStrip}t × {item.product.stripsPerBox}s / box
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569', background: '#F8FAFC', padding: '2px 6px', borderRadius: 4 }}>{item.product.sku}</span>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{item.product.category}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>{item.batchNumber}</span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 800, color: '#1E293B' }}>{item.quantity.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8' }}>units</span></div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                        {boxes > 0 && `${boxes} box${boxes > 1 ? 'es' : ''}`}
                        {(strips > 0 || tablets > 0) && ' + '}
                        {strips > 0 && `${strips} strip${strips > 1 ? 's' : ''}`}
                        {tablets > 0 && ` + ${tablets} tab${tablets > 1 ? 's' : ''}`}
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 800, color: '#475569', fontFamily: 'monospace' }}>Rs. {item.buyingPrice?.toFixed(2) || '0.00'}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>per box</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>Rs. {item.sellingPrice?.toFixed(2) || '0.00'}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>per box</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontWeight: 700, color: '#64748B', background: item.rack ? '#F1F5F9' : 'transparent', padding: item.rack ? '2px 8px' : 0, borderRadius: 6, display: 'inline-block', fontSize: 12 }}>{item.rack || '—'}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: expiryStatus.bg }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: expiryStatus.color }}>{expiryStatus.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{new Date(item.expiryDate).toLocaleDateString()}</div>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                        <button
                          onClick={() => setPrintPreviewBatch(item)}
                          style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '6px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Print label individually"
                        >
                          <Printer style={{ width: 13, height: 13 }} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditQty(String(item.quantity));
                            setEditBuyingPrice(String(item.buyingPrice || ''));
                            setEditSellingPrice(String(item.sellingPrice || ''));
                            setEditRack(item.rack || '');
                          }}
                          style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '6px', color: '#3B82F6', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Edit quantity"
                        >
                          <Edit2 style={{ width: 13, height: 13 }} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '6px', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Delete"
                        >
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
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 520, background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}>
              {/* Modal Header */}
              <div style={{ padding: '22px 24px', background: 'linear-gradient(135deg, #F59E0B08, transparent)', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package style={{ width: 20, height: 20, color: '#F59E0B' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0 }}>{detailBatch.product.name}</h3>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Batch {detailBatch.batchNumber}</p>
                  </div>
                </div>
                <button onClick={() => setDetailBatch(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Expiry badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: expiryStatus.bg, border: `1px solid ${expiryStatus.color}30` }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: expiryStatus.color }}>⬤ {expiryStatus.label}</span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>— expires {new Date(detailBatch.expiryDate).toLocaleDateString()}</span>
                </div>

                {/* Grid info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { icon: Tag, label: 'SKU', val: detailBatch.product.sku, mono: true },
                    { icon: Hash, label: 'Category', val: detailBatch.product.category },
                    { icon: Layers, label: 'Tablet Structure', val: `${detailBatch.product.tabletsPerStrip}t × ${detailBatch.product.stripsPerBox}s = ${tabletsPerBox} / box` },
                    { icon: Calendar, label: 'Ingested', val: new Date(detailBatch.createdAt).toLocaleDateString() },
                    { icon: DollarSign, label: 'Buying Price (Box)', val: `Rs. ${detailBatch.buyingPrice?.toFixed(2) || '0.00'}`, mono: true },
                    { icon: DollarSign, label: 'Selling Price (Box)', val: `Rs. ${detailBatch.sellingPrice?.toFixed(2) || '0.00'}`, mono: true },
                    { icon: Building, label: 'Rack / Location', val: detailBatch.rack || '— Not assigned' },
                  ].map((row) => {
                    const RowIcon = row.icon;
                    return (
                      <div key={row.label} style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                          <RowIcon style={{ width: 11, height: 11, color: '#94A3B8' }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{row.label}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', fontFamily: row.mono ? 'monospace' : undefined }}>{row.val}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Stock breakdown */}
                <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 12 }}>Stock Breakdown</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { val: boxes, label: 'Boxes', color: '#3B82F6' },
                      { val: strips, label: 'Strips', color: '#F59E0B' },
                      { val: tablets, label: 'Tablets', color: '#10B981' },
                      { val: detailBatch.quantity, label: 'Total Units', color: '#475569' },
                    ].map((s) => (
                      <div key={s.label} style={{ flex: 1, textAlign: 'center', background: '#FFFFFF', borderRadius: 8, padding: '10px 8px', border: `1px solid ${s.color}20` }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    setEditingItem(detailBatch);
                    setEditQty(String(detailBatch.quantity));
                    setEditBuyingPrice(String(detailBatch.buyingPrice || ''));
                    setEditSellingPrice(String(detailBatch.sellingPrice || ''));
                    setEditRack(detailBatch.rack || '');
                    setDetailBatch(null);
                  }}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}
                >
                  Edit Quantity
                </button>
                <button
                  onClick={() => { setPrintPreviewBatch(detailBatch); setDetailBatch(null); }}
                  style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Printer style={{ width: 15, height: 15 }} />
                  Print Thermal Labels
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Batch Print Modal ── */}
      {showBatchPrintModal && (() => {
        const distinctBatches = Array.from(new Set(inventory.map((item) => item.batchNumber)));
        const batchMedicines = inventory.filter((item) => item.batchNumber === selectedBatchNumber);
        const totalBatchPrintCount = Object.entries(batchPrintSelectedItems)
          .filter(([id, checked]) => checked)
          .reduce((sum, [id]) => sum + (batchPrintCopies[id] || 0), 0);

        const onPrintBatchClick = () => {
          const toPrint = inventory
            .filter((item) => batchPrintSelectedItems[item.id] && (batchPrintCopies[item.id] || 0) > 0)
            .map((item) => ({ item, copies: batchPrintCopies[item.id] }));

          if (toPrint.length === 0) {
            alert('Please select at least one medicine and specify copies.');
            return;
          }
          handleBatchPrintLabels(toPrint);
          setShowBatchPrintModal(false);
        };

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 650, background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', padding: 28, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.12)', maxHeight: '90vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Printer style={{ width: 18, height: 18, color: '#10B981' }} />
                  Batch Print Labels
                </h3>
                <button onClick={() => setShowBatchPrintModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Select Batch Number</label>
                <select
                  value={selectedBatchNumber}
                  onChange={(e) => setSelectedBatchNumber(e.target.value)}
                  style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, background: '#FFFFFF' }}
                >
                  <option value="">-- Choose a Batch --</option>
                  {distinctBatches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBatchNumber && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Medicines in Batch "{selectedBatchNumber}"</div>
                  
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px', width: 40 }}>Select</th>
                        <th style={{ padding: '8px 10px' }}>Medicine</th>
                        <th style={{ padding: '8px 10px' }}>Current Stock</th>
                        <th style={{ padding: '8px 10px', width: 100 }}>Copies</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchMedicines.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!batchPrintSelectedItems[item.id]}
                              onChange={(e) => setBatchPrintSelectedItems({
                                ...batchPrintSelectedItems,
                                [item.id]: e.target.checked
                              })}
                              style={{ accentColor: '#10B981', cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 700, color: '#1E293B' }}>{item.product.name}</div>
                            <div style={{ fontSize: 10, color: '#94A3B8' }}>SKU: {item.product.sku}</div>
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#475569' }}>
                            {item.quantity} Units
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <input
                              type="number"
                              min="1"
                              value={batchPrintCopies[item.id] || 1}
                              onChange={(e) => setBatchPrintCopies({
                                ...batchPrintCopies,
                                [item.id]: parseInt(e.target.value) || 1
                              })}
                              disabled={!batchPrintSelectedItems[item.id]}
                              style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1.5px solid #E2E8F0', outline: 'none' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button onClick={() => setShowBatchPrintModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                  Cancel
                </button>
                <button
                  onClick={onPrintBatchClick}
                  disabled={!selectedBatchNumber || totalBatchPrintCount === 0}
                  style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: selectedBatchNumber && totalBatchPrintCount > 0 ? 'pointer' : 'not-allowed', background: selectedBatchNumber && totalBatchPrintCount > 0 ? '#10B981' : '#CBD5E1', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Printer style={{ width: 15, height: 15 }} />
                  Print {totalBatchPrintCount} Label{totalBatchPrintCount !== 1 ? 's' : ''} (Single Click)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Print Label Modal ── */}
      {printPreviewBatch && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 400, background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', padding: 28, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Printer style={{ width: 18, height: 18, color: '#F59E0B' }} />
                Print Thermal Labels
              </h3>
              <button onClick={() => setPrintPreviewBatch(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, marginBottom: 4 }}>PRINTING FOR</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>{printPreviewBatch.product.name}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Batch: {printPreviewBatch.batchNumber} · Expiry: {new Date(printPreviewBatch.expiryDate).toLocaleDateString()}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Number of Copies</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 5, 10, 25].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPrintCopies(n)}
                    style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1.5px solid ${printCopies === n ? '#F59E0B' : '#E2E8F0'}`, background: printCopies === n ? 'rgba(245,158,11,0.08)' : '#FFFFFF', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: printCopies === n ? '#F59E0B' : '#475569' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="100"
                value={printCopies}
                onChange={(e) => setPrintCopies(parseInt(e.target.value) || 1)}
                placeholder="Custom number..."
                style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button onClick={() => setPrintPreviewBatch(null)} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                Cancel
              </button>
              <button onClick={() => handlePrintLabels(printPreviewBatch, printCopies)} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Printer style={{ width: 15, height: 15 }} />
                Print {printCopies} Label{printCopies > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Full Page Intake Modal ── */}
      {showAddModal && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 200, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <form
            onSubmit={handleAddInventory}
            style={{ width: '100%', maxWidth: 760, maxHeight: '85vh', background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)', margin: 'auto' }}
          >
            {/* Header */}
            <div style={{ padding: '24px 40px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(245,158,11,0.03), transparent)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus style={{ width: 22, height: 22, color: '#F59E0B' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1E293B', margin: 0 }}>Intake & Register Medicine Batch</h3>
                  <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>Register details of newly received medicine stock inside the warehouse console</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '8px', cursor: 'pointer', color: '#64748B' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{ padding: '24px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, flex: 1, width: '100%' }}>
              {formError && (
                <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.06)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 14, fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              {/* Mode Toggle Selector */}
              <div style={{ display: 'flex', gap: 10, background: '#F8FAFC', padding: 6, borderRadius: 14, border: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={() => setIntakeMode('select')}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: intakeMode === 'select' ? '#FFFFFF' : 'transparent', color: intakeMode === 'select' ? '#F59E0B' : '#64748B', boxShadow: intakeMode === 'select' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.15s' }}
                >
                  Existing Registered Medicine
                </button>
                <button
                  type="button"
                  onClick={() => setIntakeMode('new')}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: intakeMode === 'new' ? '#FFFFFF' : 'transparent', color: intakeMode === 'new' ? '#F59E0B' : '#64748B', boxShadow: intakeMode === 'new' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.15s' }}
                >
                  Custom Medicine Profile (New Entry)
                </button>
              </div>

              {intakeMode === 'select' ? (
                /* Select Dropdown */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Select Medicine Profile</label>
                  <select
                    value={selectedProdId}
                    onChange={(e) => setSelectedProdId(e.target.value)}
                    style={{ padding: '14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 14, background: '#FFFFFF' }}
                  >
                    <option value="">— Select Medicine —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku}) [{p.category}]</option>
                    ))}
                  </select>
                </div>
              ) : (
                /* Custom Intake Fields */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, border: '1.5px solid #FEF3C7', padding: 24, borderRadius: 20, background: '#FFFDF5' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#D97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag style={{ width: 16, height: 16 }} />
                    New Custom Medicine Node Details
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Medicine Name (Generic)</label>
                      <input
                        type="text"
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        placeholder="e.g. Paracetamol 500mg"
                        style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, background: '#FFFFFF' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Unique SKU code</label>
                      <input
                        type="text"
                        value={newProdSku}
                        onChange={(e) => setNewProdSku(e.target.value)}
                        placeholder="e.g. PARA-500-GEN"
                        style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, background: '#FFFFFF' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Category</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={showNewCategoryInput ? "NEW" : newProdCategory}
                          onChange={(e) => {
                            if (e.target.value === "NEW") {
                              setShowNewCategoryInput(true);
                            } else {
                              setShowNewCategoryInput(false);
                              setNewProdCategory(e.target.value);
                            }
                          }}
                          style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, background: '#FFFFFF' }}
                        >
                          {Array.from(new Set(['General', 'Analgesics', 'Antibiotics', 'Vitamins', ...products.map(p => p.category).filter(Boolean)])).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                          <option value="NEW">+ Add Custom Category</option>
                        </select>
                        {showNewCategoryInput && (
                          <input
                            type="text"
                            value={customCategory}
                            onChange={(e) => setCustomCategory(e.target.value)}
                            placeholder="Type Category"
                            style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, background: '#FFFFFF' }}
                          />
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Tablets / Strip</label>
                      <input
                        type="number"
                        value={newTabletsPerStrip}
                        onChange={(e) => setNewTabletsPerStrip(e.target.value)}
                        style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, background: '#FFFFFF' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Strips / Box</label>
                      <input
                        type="number"
                        value={newStripsPerBox}
                        onChange={(e) => setNewStripsPerBox(e.target.value)}
                        style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, background: '#FFFFFF' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Batch Intake Parameters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers style={{ width: 16, height: 16 }} />
                  Batch Registration Details
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Batch Number</label>
                    <input
                      type="text"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="e.g. B-PARA-2026"
                      style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Expiry Date</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Rack Number / Location</label>
                    <input
                      type="text"
                      value={rack}
                      onChange={(e) => setRack(e.target.value)}
                      placeholder="e.g. A-4"
                      style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Quantity</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="e.g. 10"
                      style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Tracking Unit (UOM)</label>
                    <select
                      value={intakeUom}
                      onChange={(e) => setIntakeUom(e.target.value as any)}
                      style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, background: '#FFFFFF' }}
                    >
                      <option value="box">Boxes</option>
                      <option value="strip">Strips</option>
                      <option value="tablet">Tablets / Units</option>
                      <option value="bottle">Bottles (Syrup)</option>
                      <option value="vial">Vials (Injection)</option>
                    </select>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: '1.5' }}>
                  Note: The system will automatically compute the total tablets/base units based on the selected UOM and medicine packaging specifications.
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '24px 40px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: 14, background: '#F8FAFC', flexShrink: 0 }}>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '12px 24px', borderRadius: 12, border: '1.5px solid #E2E8F0', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} style={{ padding: '12px 32px', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Ingesting…' : 'Ingest Batch'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Edit Quantity Modal ── */}
      {editingItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form
            onSubmit={handleUpdateQuantity}
            style={{ width: '100%', maxWidth: 380, background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}
          >
            <div style={{ padding: '22px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit2 style={{ width: 18, height: 18, color: '#3B82F6' }} />
                Edit Stock Level
              </h3>
              <button type="button" onClick={() => setEditingItem(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>{editingItem.product.name}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Batch: {editingItem.batchNumber}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>Current: {editingItem.quantity.toLocaleString()} units</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>New Quantity (Base Units / Tablets)</label>
                <input
                  type="number"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  autoFocus
                  style={{ padding: '12px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 15, fontWeight: 700, textAlign: 'center' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Buying Price (Rs. / Box)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editBuyingPrice}
                  onChange={(e) => setEditBuyingPrice(e.target.value)}
                  style={{ padding: '12px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 15, fontWeight: 700, textAlign: 'center' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Selling Price (Rs. / Box)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editSellingPrice}
                  onChange={(e) => setEditSellingPrice(e.target.value)}
                  style={{ padding: '12px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 15, fontWeight: 700, textAlign: 'center' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Rack Number / Location</label>
                <input
                  type="text"
                  value={editRack}
                  onChange={(e) => setEditRack(e.target.value)}
                  placeholder="e.g. A-4"
                  style={{ padding: '12px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 15, fontWeight: 700, textAlign: 'center' }}
                />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setEditingItem(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                Cancel
              </button>
              <button type="submit" style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: '#3B82F6', color: '#FFFFFF' }}>
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
