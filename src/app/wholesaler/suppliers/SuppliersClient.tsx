'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Search, ChevronRight, ShoppingBag, CreditCard, Mail, Phone, 
  MapPin, Calendar, Receipt, TrendingUp, Info, Plus, X, UserPlus, 
  CheckCircle, AlertCircle, FileText, Filter, SlidersHorizontal, Trash, Edit2, Database
} from 'lucide-react';
import { useSSEListener } from '@/hooks/useRealtimeData';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  sku: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
}

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  availableBaseUnits: number;
  purchasePricePerBox: number;
  sellingPricePerBox: number;
  product: Product;
}

interface Settlement {
  id: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes?: string | null;
}

interface SupplierBill {
  id: string;
  billNumber: string;
  billDate: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  notes?: string | null;
  itemsJson?: string | null;
  settlements: Settlement[];
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  batches: Batch[];
  bills: SupplierBill[];
}

interface SuppliersClientProps {
  initialSuppliers: Supplier[];
  products: Product[];
  wholesalerId: string;
}

export default function SuppliersClient({ initialSuppliers, products, wholesalerId }: SuppliersClientProps) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  
  // Filters and Searching
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'name' | 'orders' | 'bills'>('name');

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // Filters for linked batches
  const [batchMedicineFilter, setBatchMedicineFilter] = useState('');
  const [batchExpiryFrom, setBatchExpiryFrom] = useState('');
  const [batchExpiryTo, setBatchExpiryTo] = useState('');

  // Selected Batch for Popup modal
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<Batch | null>(null);

  // Add Supplier Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supLoading, setSupLoading] = useState(false);
  const [supError, setSupError] = useState('');
  const [supSuccess, setSupSuccess] = useState('');

  // Record Supplier Bill Modal state
  const [showBillModal, setShowBillModal] = useState(false);
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billTotalAmount, setBillTotalAmount] = useState('');
  const [billPaidAmount, setBillPaidAmount] = useState('');
  const [billNotes, setBillNotes] = useState('');
  const [billItems, setBillItems] = useState<Array<{ productId: string; qtyBoxes: number; pricePerBox: number }>>([
    { productId: '', qtyBoxes: 1, pricePerBox: 0 }
  ]);
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState('');
  const [billSuccess, setBillSuccess] = useState('');

  // Settlement inline modal
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('CASH');
  const [settleNotes, setSettleNotes] = useState('');
  const [settlingBillId, setSettlingBillId] = useState<string | null>(null);

  // Detailed Bill viewer modal
  const [activeBill, setActiveBill] = useState<SupplierBill | null>(null);

  // SSE Real-time Updates
  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/wholesaler/suppliers');
      const data = await res.json();
      if (res.ok && data.suppliers) {
        setSuppliers(data.suppliers);
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  };

  useSSEListener(wholesalerId, (type) => {
    if (type === 'INVENTORY_UPDATED' || type === 'SUPPLIER_UPDATED') {
      fetchSuppliers();
      router.refresh();
    }
  });

  useEffect(() => {
    setSuppliers(initialSuppliers);
  }, [initialSuppliers]);

  // General Supplier Settlement Modal State
  const [showSupplierSettleModal, setShowSupplierSettleModal] = useState(false);
  const [supplierSettleAmount, setSupplierSettleAmount] = useState('');
  const [supplierSettleMethod, setSupplierSettleMethod] = useState('CASH');
  const [supplierSettleNotes, setSupplierSettleNotes] = useState('');
  const [supplierSettleLoading, setSupplierSettleLoading] = useState(false);

  // Helper to retrieve the purchase price per box (buying price) from any existing batch of this medicine
  const getProductBuyingPrice = (productId: string): number => {
    if (!productId) return 0;
    for (const sup of suppliers) {
      const found = sup.batches?.find(b => b.product?.id === productId);
      if (found) {
        return found.purchasePricePerBox;
      }
    }
    return 0;
  };

  // Automatically calculate total bill amount when billItems changes
  useEffect(() => {
    const total = billItems.reduce((sum, item) => sum + (item.qtyBoxes * item.pricePerBox), 0);
    if (total > 0) {
      setBillTotalAmount(total.toFixed(2));
    } else {
      setBillTotalAmount('');
    }
  }, [billItems]);

  // Add/Edit Supplier CRUD
  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupError('');
    setSupLoading(true);
    try {
      const url = '/api/wholesaler/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';
      const body = {
        id: editingSupplier?.id,
        name: supName,
        contactPerson: supContact,
        phone: supPhone,
        email: supEmail,
        address: supAddress
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit supplier details');

      setSupSuccess(`Supplier "${supName}" saved successfully!`);
      fetchSuppliers();
      setTimeout(() => {
        setShowAddModal(false);
        setEditingSupplier(null);
        setSupSuccess('');
        setSupName(''); setSupContact(''); setSupPhone(''); setSupEmail(''); setSupAddress('');
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setSupError(err.message);
    } finally {
      setSupLoading(false);
    }
  };

  const openEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupContact(sup.contactPerson || '');
    setSupPhone(sup.phone || '');
    setSupEmail(sup.email || '');
    setSupAddress(sup.address || '');
    setShowAddModal(true);
  };

  // Record Bill Submit
  const handleRecordBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillError('');
    setBillLoading(true);

    if (!selectedSupplierId) return;

    try {
      const itemsPayload = billItems.filter(item => item.productId !== '');
      const body = {
        supplierId: selectedSupplierId,
        billNumber,
        billDate,
        totalAmount: parseFloat(billTotalAmount) || 0,
        paidAmount: parseFloat(billPaidAmount) || 0,
        notes: billNotes,
        itemsJson: itemsPayload
      };

      const res = await fetch('/api/wholesaler/supplier-bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log supplier bill');

      setBillSuccess('Purchase bill registered successfully!');
      fetchSuppliers();
      setTimeout(() => {
        setShowBillModal(false);
        setBillSuccess('');
        setBillNumber('');
        setBillTotalAmount('');
        setBillPaidAmount('');
        setBillNotes('');
        setBillItems([{ productId: '', qtyBoxes: 1, pricePerBox: 0 }]);
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setBillError(err.message);
    } finally {
      setBillLoading(false);
    }
  };

  // Record Bill Settlement Payment
  const handleSettleBillSubmit = async (billId: string) => {
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) return;

    try {
      const res = await fetch('/api/wholesaler/supplier-bills', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: billId,
          settlementAmount: amt,
          paymentMethod: settleMethod,
          settlementNotes: settleNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to settle bill');

      setSettleAmount('');
      setSettleNotes('');
      setSettlingBillId(null);
      fetchSuppliers();
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Record FIFO Supplier General Settlement
  const handleSupplierSettleSubmit = async () => {
    if (!selectedSupplier) return;
    const totalAmt = parseFloat(supplierSettleAmount);
    if (!totalAmt || totalAmt <= 0) return;

    setSupplierSettleLoading(true);
    try {
      // Find all unpaid or partially paid bills, sorted by date asc (oldest first)
      const outstandingBills = [...selectedSupplier.bills]
        .filter(b => b.paidAmount < b.totalAmount)
        .sort((a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime());

      let remainingSettleAmount = totalAmt;

      for (const bill of outstandingBills) {
        if (remainingSettleAmount <= 0) break;

        const billDue = bill.totalAmount - bill.paidAmount;
        const settleForThisBill = Math.min(billDue, remainingSettleAmount);

        // Call PUT API for this bill
        const res = await fetch('/api/wholesaler/supplier-bills', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: bill.id,
            settlementAmount: settleForThisBill,
            paymentMethod: supplierSettleMethod,
            settlementNotes: supplierSettleNotes || 'Bulk supplier settlement allocation'
          })
        });

        if (!res.ok) {
          const data = await res.ok ? {} : await res.json();
          throw new Error(data.error || 'Failed to settle one of the bills');
        }

        remainingSettleAmount -= settleForThisBill;
      }

      setSupplierSettleAmount('');
      setSupplierSettleNotes('');
      setShowSupplierSettleModal(false);
      await fetchSuppliers();
      router.refresh();
      alert('Supplier balance settled successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSupplierSettleLoading(false);
    }
  };

  // Calculations
  const calculateSupplierStats = (sup: Supplier) => {
    let totalPurchased = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let totalBoxesSupplied = 0;

    sup.bills.forEach(b => {
      totalPurchased += b.totalAmount;
      totalPaid += b.paidAmount;
      totalOutstanding += Math.max(b.totalAmount - b.paidAmount, 0);
      try {
        const items = JSON.parse(b.itemsJson || '[]');
        items.forEach((it: any) => {
          totalBoxesSupplied += it.qtyBoxes || 0;
        });
      } catch (e) {}
    });

    return { totalPurchased, totalPaid, totalOutstanding, totalBoxesSupplied };
  };

  // Filtering
  let filteredSuppliers = suppliers.filter(s => {
    const query = searchTerm.toLowerCase();
    const infoMatch = s.name.toLowerCase().includes(query) ||
      s.contactPerson?.toLowerCase().includes(query) ||
      s.phone?.includes(query);
    const productMatch = s.batches?.some(b => 
      b.product?.name?.toLowerCase().includes(query) ||
      b.product?.sku?.toLowerCase().includes(query) ||
      b.batchNumber?.toLowerCase().includes(query)
    );
    return infoMatch || productMatch;
  });

  // Sorting
  filteredSuppliers = [...filteredSuppliers].sort((a, b) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const aNameMatch = a.name.toLowerCase().includes(q);
      const bNameMatch = b.name.toLowerCase().includes(q);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
    }
    if (sortOrder === 'orders') {
      return b.batches.length - a.batches.length;
    }
    if (sortOrder === 'bills') {
      const balA = calculateSupplierStats(a).totalOutstanding;
      const balB = calculateSupplierStats(b).totalOutstanding;
      return balB - balA;
    }
    return a.name.localeCompare(b.name);
  });

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const stats = selectedSupplier ? calculateSupplierStats(selectedSupplier) : { totalPurchased: 0, totalPaid: 0, totalOutstanding: 0, totalBoxesSupplied: 0 };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(14,165,233,0.5)', borderRadius: 20, padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.07)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users style={{ width: 22, height: 22, color: '#0EA5E9' }} />
            Supplier Registry
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            Manage medicine manufacturer & supplier relationships, purchase invoices, and payment histories
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSupplier(null);
            setSupName(''); setSupContact(''); setSupPhone(''); setSupEmail(''); setSupAddress('');
            setShowAddModal(true);
          }}
          className="btn-primary"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', whiteSpace: 'nowrap' }}
        >
          <UserPlus style={{ width: 14, height: 14 }} />
          Add Supplier
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, padding: '14px 20px',
        background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(226,232,240,0.8)', borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        <div style={{ minWidth: 200, flex: '1 1 200px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
            <Search style={{ width: 12, height: 12, color: '#0EA5E9' }} /> Search Suppliers
          </label>
          <input
            type="text"
            placeholder="Search by name, contact, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="filter-input"
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10, outline: 'none', background: 'white' }}
          />
        </div>

        <div style={{ minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Sort Order</label>
          <select
            value={sortOrder}
            onChange={(e: any) => setSortOrder(e.target.value)}
            className="filter-select"
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10, outline: 'none', background: 'white', cursor: 'pointer' }}
          >
            <option value="name">Supplier Name (A-Z)</option>
            <option value="orders">Batches Supplied (Highest)</option>
            <option value="bills">Outstanding Balance (Highest)</option>
          </select>
        </div>
      </div>

      {/* Split Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
        
        {/* Left Side: Supplier List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '68vh', overflowY: 'auto' }}>
            {filteredSuppliers.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>
                No suppliers found.
              </div>
            ) : (
              filteredSuppliers.map(s => {
                const isSelected = selectedSupplierId === s.id;
                const { totalOutstanding } = calculateSupplierStats(s);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSupplierId(isSelected ? null : s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1.5px solid transparent',
                      background: isSelected ? 'rgba(14,165,233,0.06)' : 'transparent',
                      borderColor: isSelected ? '#BAE6FD' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Database style={{ width: 11, height: 11, color: '#94A3B8' }} />
                        <span>{s.batches.length} stock batches</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: totalOutstanding > 0 ? '#FEF2F2' : '#ECFDF5', color: totalOutstanding > 0 ? '#EF4444' : '#059669' }}>
                        {totalOutstanding > 0 ? `Due: Rs. ${totalOutstanding.toLocaleString()}` : 'No Due'}
                      </span>
                      <ChevronRight style={{ width: 14, height: 14, color: isSelected ? '#0EA5E9' : '#CBD5E1' }} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Detail View */}
        <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 20, minHeight: '50vh' }}>
          {selectedSupplier && selectedSupplierId ? (
            <div className="space-y-6 animate-fadeIn">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users style={{ width: 18, height: 18, color: '#0EA5E9' }} />
                    Supplier Account: {selectedSupplier.name}
                  </h3>
                  <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Review delivery logs, invoice balances, and settlements history</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEditSupplier(selectedSupplier)} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Edit2 style={{ width: 12, height: 12 }} /> Edit Info
                  </button>
                  <button onClick={() => setSelectedSupplierId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                    <X style={{ width: 20, height: 20 }} />
                  </button>
                </div>
              </div>

              {/* Information Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#FAFCFF', border: '1.5px solid #E0F2FE', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569' }}>
                  <div><strong>Contact Person:</strong> {selectedSupplier.contactPerson || 'N/A'}</div>
                  <div><strong>Phone:</strong> {selectedSupplier.phone || 'N/A'}</div>
                  <div><strong>Email:</strong> {selectedSupplier.email || 'N/A'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569' }}>
                  <div><strong>Address:</strong> {selectedSupplier.address || 'N/A'}</div>
                </div>
              </div>

              {/* Stats KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="card" style={{ padding: 14, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#065F46', textTransform: 'uppercase' }}>Total Purchases</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#047857', fontFamily: 'monospace', marginTop: 4 }}>Rs. {stats.totalPurchased.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: '#047857', fontWeight: 700, marginTop: 2 }}>{stats.totalBoxesSupplied} Boxes purchased</div>
                </div>
                <div className="card" style={{ padding: 14, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#854D0E', textTransform: 'uppercase' }}>Total Settled / Paid</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0369A1', fontFamily: 'monospace', marginTop: 4 }}>Rs. {stats.totalPaid.toLocaleString()}</div>
                </div>
                <div className="card" style={{ padding: 14, background: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#991B1B', textTransform: 'uppercase' }}>Outstanding Due Balance</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#DC2626', fontFamily: 'monospace', marginTop: 4 }}>Rs. {stats.totalOutstanding.toLocaleString()}</div>
                  </div>
                  {stats.totalOutstanding > 0 && (
                    <button 
                      onClick={() => {
                        setSupplierSettleAmount(stats.totalOutstanding.toString());
                        setShowSupplierSettleModal(true);
                      }} 
                      className="btn-primary" 
                      style={{ padding: '4px 8px', fontSize: 10, background: '#EF4444', borderColor: '#EF4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, marginTop: 8 }}
                    >
                      Settle Due Balance
                    </button>
                  )}
                </div>
              </div>

              {/* Medicine Batches Ingested */}
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em', margin: 0 }}>Medications Stock Batches Supplied</h4>
                  
                  {/* Filters bar */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Filter by medicine..."
                      value={batchMedicineFilter}
                      onChange={e => setBatchMedicineFilter(e.target.value)}
                      className="input-crisp"
                      style={{ fontSize: 11, padding: '4px 8px', width: 140 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>Expiry:</span>
                      <input
                        type="date"
                        value={batchExpiryFrom}
                        onChange={e => setBatchExpiryFrom(e.target.value)}
                        className="input-crisp"
                        style={{ fontSize: 11, padding: '4px 8px', width: 110 }}
                      />
                      <span style={{ fontSize: 10, color: '#64748B' }}>to</span>
                      <input
                        type="date"
                        value={batchExpiryTo}
                        onChange={e => setBatchExpiryTo(e.target.value)}
                        className="input-crisp"
                        style={{ fontSize: 11, padding: '4px 8px', width: 110 }}
                      />
                    </div>
                    {(batchMedicineFilter || batchExpiryFrom || batchExpiryTo) && (
                      <button
                        onClick={() => {
                          setBatchMedicineFilter('');
                          setBatchExpiryFrom('');
                          setBatchExpiryTo('');
                        }}
                        className="btn-ghost"
                        style={{ fontSize: 10, padding: '4px 8px', color: '#EF4444', borderColor: '#FECDD3', background: '#FEF2F2' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Batch Code</th>
                        <th>Medicine</th>
                        <th>Expiry Date</th>
                        <th style={{ textAlign: 'right' }}>Stock Left</th>
                        <th style={{ textAlign: 'right' }}>Buy Price / Box</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = selectedSupplier.batches.filter(b => {
                          const matchName = b.product.name.toLowerCase().includes(batchMedicineFilter.toLowerCase()) ||
                                            b.product.sku.toLowerCase().includes(batchMedicineFilter.toLowerCase()) ||
                                            b.batchNumber.toLowerCase().includes(batchMedicineFilter.toLowerCase());
                          if (!matchName) return false;

                          const expTime = new Date(b.expiryDate).getTime();
                          if (batchExpiryFrom && expTime < new Date(batchExpiryFrom).getTime()) return false;
                          if (batchExpiryTo && expTime > new Date(batchExpiryTo).getTime()) return false;

                          return true;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>No medicine inventory batches match filters.</td>
                            </tr>
                          );
                        }

                        return filtered.map(b => {
                          const unitsPerBox = (b.product.tabletsPerStrip * b.product.stripsPerBox) || 1;
                          const boxes = Math.floor(b.availableBaseUnits / unitsPerBox);
                          const remUnits = b.availableBaseUnits % unitsPerBox;
                          return (
                            <tr key={b.id} onClick={() => setSelectedBatchDetails(b)} style={{ cursor: 'pointer' }} className="hover:bg-slate-50">
                              <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0EA5E9' }}>{b.batchNumber}</td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{b.product.name}</div>
                                <div style={{ fontSize: 10, color: '#64748B' }}>SKU: {b.product.sku}</div>
                              </td>
                              <td>{new Date(b.expiryDate).toLocaleDateString()}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                {boxes} Box{boxes !== 1 ? 'es' : ''} {remUnits > 0 ? `(${remUnits} units)` : ''}
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>Rs. {b.purchasePricePerBox.toFixed(2)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Purchase Bills Ledger & Settle payments */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em' }}>Purchase Invoices Ledger</h4>
                  <button 
                    onClick={() => {
                      setBillNumber('');
                      setBillTotalAmount('');
                      setBillPaidAmount('');
                      setBillNotes('');
                      setBillItems([{ productId: '', qtyBoxes: 1, pricePerBox: 0 }]);
                      setShowBillModal(true);
                    }} 
                    className="btn-ghost" 
                    style={{ fontSize: 10, padding: '4px 8px', color: '#0EA5E9', borderColor: '#BAE6FD' }}
                  >
                    ＋ Log Purchase Bill
                  </button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bill Date</th>
                        <th>Bill Reference</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Total Bill</th>
                        <th style={{ textAlign: 'right' }}>Settled Paid</th>
                        <th style={{ textAlign: 'center' }}>Settlement Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupplier.bills.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>No bills recorded yet.</td>
                        </tr>
                      ) : (
                        selectedSupplier.bills.map(b => {
                          const isFullyPaid = b.paidAmount >= b.totalAmount;
                          return (
                            <tr key={b.id}>
                              <td>{new Date(b.billDate).toLocaleDateString()}</td>
                              <td>
                                <button onClick={() => setActiveBill(b)} style={{ background: 'none', border: 'none', color: '#0EA5E9', fontWeight: 800, cursor: 'pointer', fontFamily: 'monospace', textDecoration: 'underline' }}>
                                  {b.billNumber}
                                </button>
                              </td>
                              <td>
                                <span className={`status-pill status-pill-${b.status.toLowerCase()}`}>{b.status}</span>
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>Rs. {b.totalAmount.toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>Rs. {b.paidAmount.toLocaleString()}</td>
                              <td style={{ textAlign: 'center' }}>
                                {!isFullyPaid ? (
                                    <button 
                                      onClick={() => { setSettlingBillId(b.id); setSettleAmount((b.totalAmount - b.paidAmount).toString()); }}
                                      className="btn-ghost"
                                      style={{ padding: '4px 8px', fontSize: 10, borderColor: '#BAE6FD', color: '#0EA5E9' }}
                                    >
                                      Settle
                                    </button>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓ Cleared</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Consolidated Supplier Payment Settlements History */}
              <div>
                <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em', marginBottom: 10 }}>Payment Settlements History</h4>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
                  {(() => {
                    const allSettle = selectedSupplier.bills.flatMap(b => 
                      (b.settlements || []).map(s => ({
                        ...s,
                        billNumber: b.billNumber,
                        billId: b.id
                      }))
                    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (allSettle.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11, padding: 12, fontStyle: 'italic' }}>
                          No settlements recorded yet.
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {allSettle.map((settle: any) => (
                          <div key={settle.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                            <div>
                              <span style={{ fontWeight: 700, color: '#1E293B' }}>Bill: {settle.billNumber}</span>
                              <span style={{ color: '#64748B', marginLeft: 8 }}>{new Date(settle.date).toLocaleString()}</span>
                              {settle.notes && <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{settle.notes}</div>}
                            </div>
                            <span style={{ fontWeight: 800, color: '#059669' }}>+ Rs. {settle.amount.toLocaleString()} ({settle.paymentMethod})</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px 20px', textAlign: 'center', color: '#94A3B8' }}>
              <Users style={{ width: 48, height: 48, color: '#E2E8F0', marginBottom: 16 }} />
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select a Supplier</h3>
              <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, maxWidth: 360, lineHeight: 1.6 }}>Choose a manufacturer or medicine vendor from the left panel directory to inspect purchase summaries, stock intake histories, and outstanding payment records side-by-side.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '500px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserPlus style={{ width: 18, height: 18, color: '#0EA5E9' }} />
                  {editingSupplier ? 'Modify Supplier Account' : 'Register New Supplier'}
                </h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Add or edit medicine manufacturer/vendor credentials</p>
              </div>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div className="modal-body">
              {supError && <div className="alert alert-error">{supError}</div>}
              {supSuccess && <div className="alert alert-success">{supSuccess}</div>}
              <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Supplier / Company Name *</label>
                    <input required value={supName} onChange={e => setSupName(e.target.value)} placeholder="e.g. Novartis Pharma" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Contact Person</label>
                    <input value={supContact} onChange={e => setSupContact(e.target.value)} placeholder="e.g. Ram Prasad" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Phone Number</label>
                    <input value={supPhone} onChange={e => setSupPhone(e.target.value)} placeholder="98XXXXXXXX" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Email Address</label>
                    <input type="email" value={supEmail} onChange={e => setSupEmail(e.target.value)} placeholder="info@company.com" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Address</label>
                    <input value={supAddress} onChange={e => setSupAddress(e.target.value)} placeholder="Street, City, District" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                </div>
                <button type="submit" disabled={supLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', fontSize: 12, opacity: supLoading ? 0.7 : 1 }}>
                  {supLoading ? 'Saving...' : 'Save Supplier Credentials'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Record Supplier Bill Modal */}
      {showBillModal && (
        <div className="modal-overlay" onClick={() => setShowBillModal(false)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '600px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt style={{ width: 18, height: 18, color: '#0EA5E9' }} />
                  Log Purchase Bill
                </h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Record wholesale supplier invoice data for bookkeeping</p>
              </div>
              <button onClick={() => setShowBillModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div className="modal-body">
              {billError && <div className="alert alert-error">{billError}</div>}
              {billSuccess && <div className="alert alert-success">{billSuccess}</div>}
              <form onSubmit={handleRecordBill} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Bill Invoice Ref Number *</label>
                    <input required value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="e.g. BILL-99210" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Bill Date *</label>
                    <input required type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Total Invoice Amount *</label>
                    <input required type="number" step="any" value={billTotalAmount} onChange={e => setBillTotalAmount(e.target.value)} placeholder="e.g. 50000" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Paid Today (Rs.)</label>
                    <input type="number" step="any" value={billPaidAmount} onChange={e => setBillPaidAmount(e.target.value)} placeholder="e.g. 10000" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Item Lines Purchased (Optional)</label>

                  {/* Column Headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 24px', gap: 6, padding: '4px 6px', background: '#F1F5F9', borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Medicine / Product</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Boxes (Qty)</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Cost / Box (Rs.)</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Subtotal</span>
                    <span />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {billItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 80px 24px', gap: 6, alignItems: 'center' }}>
                        <select 
                          value={item.productId}
                          onChange={e => {
                            const updated = [...billItems];
                            const prodId = e.target.value;
                            updated[idx].productId = prodId;
                            updated[idx].pricePerBox = getProductBuyingPrice(prodId);
                            setBillItems(updated);
                          }}
                          className="select-crisp"
                          style={{ fontSize: 11, width: '100%' }}
                        >
                          <option value="">-- Choose Medication --</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                        <input 
                          type="number" 
                          min={1}
                          placeholder="e.g. 10"
                          value={item.qtyBoxes}
                          onChange={e => {
                            const updated = [...billItems];
                            updated[idx].qtyBoxes = parseInt(e.target.value) || 1;
                            setBillItems(updated);
                          }}
                          className="input-crisp"
                          style={{ fontSize: 11, textAlign: 'center', width: '100%' }}
                        />
                        <input 
                          type="number" 
                          step="any"
                          min={0}
                          placeholder="e.g. 500"
                          value={item.pricePerBox || ''}
                          onChange={e => {
                            const updated = [...billItems];
                            updated[idx].pricePerBox = parseFloat(e.target.value) || 0;
                            setBillItems(updated);
                          }}
                          className="input-crisp"
                          style={{ fontSize: 11, textAlign: 'center', width: '100%' }}
                        />
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', fontFamily: 'monospace', textAlign: 'right', padding: '0 4px' }}>
                          Rs. {(item.qtyBoxes * item.pricePerBox).toLocaleString()}
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setBillItems(billItems.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    <button 
                      type="button" 
                      onClick={() => setBillItems([...billItems, { productId: '', qtyBoxes: 1, pricePerBox: 0 }])}
                      style={{ border: '1.5px dashed #BAE6FD', color: '#0EA5E9', background: 'transparent', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}
                    >
                      ＋ Add Item Line
                    </button>
                  </div>

                  {/* Running Total */}
                  {billItems.some(item => item.qtyBoxes > 0 && item.pricePerBox > 0) && (
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)', border: '1px solid #BAE6FD', borderRadius: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0369A1' }}>Calculated Total:</span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#0284C7', fontFamily: 'monospace' }}>
                        Rs. {billItems.reduce((s, i) => s + i.qtyBoxes * i.pricePerBox, 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Notes / Remarks</label>
                  <textarea value={billNotes} onChange={e => setBillNotes(e.target.value)} placeholder="Log vendor payment details or delivery delay notes..." className="input-crisp" style={{ width: '100%', fontSize: 12, height: 60 }} />
                </div>

                <button type="submit" disabled={billLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', fontSize: 12, opacity: billLoading ? 0.7 : 1 }}>
                  {billLoading ? 'Submitting...' : 'Register Purchase Invoice'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bill details view modal */}
      {activeBill && (() => {
        let itemsArray = [];
        try {
          itemsArray = JSON.parse(activeBill.itemsJson || '[]');
        } catch(e) {}
        
        return (
          <div className="modal-overlay" onClick={() => setActiveBill(null)}>
            <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '600px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Receipt style={{ width: 18, height: 18, color: '#0EA5E9' }} /> Supplier Invoice Details
                  </h3>
                  <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Invoice: {activeBill.billNumber} · Registered on {new Date(activeBill.billDate).toLocaleDateString()}</p>
                </div>
                <button onClick={() => setActiveBill(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>

              <div className="modal-body space-y-6">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, background: '#F8FAFC', padding: 14, borderRadius: 16, border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Total Due Amount</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#DC2626', fontFamily: 'monospace', marginTop: 3 }}>Rs. {activeBill.totalAmount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Amount Settled</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#059669', fontFamily: 'monospace', marginTop: 3 }}>Rs. {activeBill.paidAmount.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Remaining Balance</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#0284C7', fontFamily: 'monospace', marginTop: 3 }}>Rs. {Math.max(activeBill.totalAmount - activeBill.paidAmount, 0).toLocaleString()}</div>
                  </div>
                </div>

                {itemsArray.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Supplied Medication Items</div>
                    <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead style={{ background: '#F8FAFC' }}>
                          <tr>
                            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Item</th>
                            <th style={{ padding: '8px 12px', textAlign: 'center' }}>Boxes</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Cost / Box</th>
                            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsArray.map((item: any, i: number) => {
                            const prod = products.find(p => p.id === item.productId);
                            return (
                              <tr key={i} style={{ borderTop: '1px solid #E2E8F0' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{prod?.name || 'Unknown Product'}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>{item.qtyBoxes}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs. {item.pricePerBox}</td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>Rs. {(item.qtyBoxes * item.pricePerBox).toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeBill.notes && (
                  <div style={{ background: '#FAFCFF', border: '1px solid #E0F2FE', borderRadius: 12, padding: 12, fontSize: 11, color: '#334155' }}>
                    <strong>Memo / Note:</strong> {activeBill.notes}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Settlement Timeline Ledger</div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, maxHeight: 150, overflowY: 'auto' }}>
                    {activeBill.settlements.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11, padding: 12, fontStyle: 'italic' }}>
                        No settlements recorded yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activeBill.settlements.map((settle) => (
                          <div key={settle.id} style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                            <div>
                              <span style={{ color: '#64748B' }}>{new Date(settle.date).toLocaleString()}</span>
                              {settle.notes && <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{settle.notes}</div>}
                            </div>
                            <span style={{ fontWeight: 800, color: '#059669' }}>+ Rs. {settle.amount.toLocaleString()} ({settle.paymentMethod})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Advanced Bill Settlement Modal */}
      {settlingBillId && (
        <div className="modal-overlay" onClick={() => setSettlingBillId(null)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '400px', padding: 28 } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: 0, border: 'none', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard style={{ width: 16, height: 16, color: '#0EA5E9' }} /> Record Bill Settlement
              </h3>
              <button onClick={() => setSettlingBillId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Amount (Rs.) *</label>
                <input type="number" required placeholder="Enter amount..." value={settleAmount} onChange={e => setSettleAmount(e.target.value)} className="input-crisp" style={{ fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Payment Method</label>
                <select value={settleMethod} onChange={e => setSettleMethod(e.target.value)} className="select-crisp" style={{ fontSize: 12 }}>
                  <option value="CASH">💵 CASH</option>
                  <option value="BANK_TRANSFER">🏦 BANK TRANSFER</option>
                  <option value="MOBILE_BANKING">📱 MOBILE BANKING / FONEPAY</option>
                  <option value="CARD">💳 CARD</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Notes / Remarks</label>
                <input type="text" placeholder="Transaction ID or payment ref..." value={settleNotes} onChange={e => setSettleNotes(e.target.value)} className="input-crisp" style={{ fontSize: 12 }} />
              </div>
              <button onClick={() => handleSettleBillSubmit(settlingBillId)} className="btn-primary" style={{ width: '100%', padding: 12, fontSize: 12, marginTop: 8 }}>
                Confirm Settlement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Supplier Settlement Modal */}
      {showSupplierSettleModal && selectedSupplier && (
        <div className="modal-overlay" onClick={() => setShowSupplierSettleModal(false)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '400px', padding: 28 } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: 0, border: 'none', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CreditCard style={{ width: 16, height: 16, color: '#EF4444' }} /> Record Supplier Settlement
              </h3>
              <button onClick={() => setShowSupplierSettleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span style={{ fontSize: 11, color: '#64748B' }}>Settlement will be applied to outstanding bills starting from the oldest (FIFO).</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Amount to Settle (Rs.) *</label>
                <input type="number" required placeholder="Enter amount..." value={supplierSettleAmount} onChange={e => setSupplierSettleAmount(e.target.value)} className="input-crisp" style={{ fontSize: 12 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Payment Method</label>
                <select value={supplierSettleMethod} onChange={e => setSupplierSettleMethod(e.target.value)} className="select-crisp" style={{ fontSize: 12 }}>
                  <option value="CASH">💵 CASH</option>
                  <option value="BANK_TRANSFER">🏦 BANK TRANSFER</option>
                  <option value="MOBILE_BANKING">📱 MOBILE BANKING / FONEPAY</option>
                  <option value="CARD">💳 CARD</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Notes / Remarks</label>
                <input type="text" placeholder="Transaction ID or payment ref..." value={supplierSettleNotes} onChange={e => setSupplierSettleNotes(e.target.value)} className="input-crisp" style={{ fontSize: 12 }} />
              </div>
              <button onClick={handleSupplierSettleSubmit} disabled={supplierSettleLoading} className="btn-primary" style={{ width: '100%', padding: 12, fontSize: 12, marginTop: 8, background: '#EF4444', borderColor: '#EF4444' }}>
                {supplierSettleLoading ? 'Processing Settlement...' : 'Confirm Supplier Settlement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Details Modal */}
      {selectedBatchDetails && (
        <div className="modal-overlay" onClick={() => setSelectedBatchDetails(null)}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '460px', padding: 28 } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: 0, border: 'none', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database style={{ width: 16, height: 16, color: '#0EA5E9' }} /> Supplied Batch Details
              </h3>
              <button onClick={() => setSelectedBatchDetails(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#FAFCFF', border: '1px solid #BAE6FD', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#0369A1' }}>{selectedBatchDetails.product.name}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>SKU Code: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedBatchDetails.product.sku}</span></div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Batch Number: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{selectedBatchDetails.batchNumber}</span></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Expiry Date</div>
                  <div style={{ color: '#334155', fontWeight: 700, marginTop: 2 }}>{new Date(selectedBatchDetails.expiryDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Available Stock</div>
                  <div style={{ color: '#334155', fontWeight: 700, marginTop: 2, fontFamily: 'monospace' }}>{selectedBatchDetails.availableBaseUnits} units</div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Purchase Price / Box</div>
                  <div style={{ color: '#334155', fontWeight: 700, marginTop: 2, fontFamily: 'monospace' }}>Rs. {selectedBatchDetails.purchasePricePerBox.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: '#94A3B8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Selling Price / Box</div>
                  <div style={{ color: '#0284C7', fontWeight: 700, marginTop: 2, fontFamily: 'monospace' }}>Rs. {selectedBatchDetails.sellingPricePerBox.toFixed(2)}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Linked Bill Information</div>
                {(() => {
                  // Attempt to find a linked supplier bill that contains this product batch
                  const linkedBill = selectedSupplier?.bills.find(bill => {
                    try {
                      const items = JSON.parse(bill.itemsJson || '[]');
                      return items.some((it: any) => it.productId === selectedBatchDetails.product.id);
                    } catch (e) {
                      return false;
                    }
                  });

                  if (!linkedBill) {
                    return (
                      <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, fontSize: 11, color: '#64748B', fontStyle: 'italic', textAlign: 'center' }}>
                        No specific bill transaction linked to this batch entry.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 12, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#166534', fontWeight: 600 }}>Bill Reference:</span>
                        <strong style={{ fontFamily: 'monospace' }}>{linkedBill.billNumber}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#166534', fontWeight: 600 }}>Bill Date:</span>
                        <span>{new Date(linkedBill.billDate).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#166534', fontWeight: 600 }}>Total Bill Amount:</span>
                        <strong style={{ fontFamily: 'monospace' }}>Rs. {linkedBill.totalAmount.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#166534', fontWeight: 600 }}>Settled Amount:</span>
                        <strong style={{ fontFamily: 'monospace', color: '#15803D' }}>Rs. {linkedBill.paidAmount.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#166534', fontWeight: 600 }}>Status:</span>
                        <span className={`status-pill status-pill-${linkedBill.status.toLowerCase()}`}>{linkedBill.status}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <button onClick={() => setSelectedBatchDetails(null)} className="btn-ghost" style={{ width: '100%', padding: 12, fontSize: 12, marginTop: 8 }}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
