'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Search, MapPin, Phone, Building, Trash2,
  CheckCircle, X, Package, Plus,
  Edit2, Mail, User, ChevronRight, Receipt, Calendar, TrendingUp
} from 'lucide-react';
import {
  createCustomSupplierAction,
  updateCustomSupplierAction,
  deleteCustomSupplierAction
} from '@/app/actions/retailerActions';
import { useRealtimeEvent, broadcastUpdate } from '@/lib/events';

interface Batch {
  id: string;
  batchNumber: string;
  availableBaseUnits: number;
  expiryDate: string;
  sellingPricePerBox: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  tabletsPerStrip: number;
  stripsPerBox: number;
  batches: Batch[];
}

interface Wholesaler {
  id: string;
  companyName: string;
  taxId: string;
  address: string;
  phone: string;
  registrationNumber?: string | null;
  products: Product[];
}

interface CustomSupplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  pricePerUnit: number;
  product: { name: string; sku: string; };
}

interface B2BSettlement {
  id: string;
  amount: number;
  method?: string | null;
  status: string;
  createdAt: string;
}

interface Purchase {
  id: string;
  wholesalerId?: string | null;
  status: string;
  netAmount: number;
  totalAmount: number;
  discountAmount: number;
  advanceApplied?: number;
  settleStatus?: string;
  settleAmount?: number;
  settleMethod?: string;
  createdAt: string;
  items: OrderItem[];
  b2bSettlements?: B2BSettlement[];
}

interface SuppliersClientProps {
  profile: { id: string; pharmacyName: string; };
  initialWholesalers: Wholesaler[];
  initialCustomSuppliers: CustomSupplier[];
  purchases?: Purchase[];
}

const fmtRs = (n: number) => `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

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

export default function SuppliersClient({ profile, initialWholesalers, initialCustomSuppliers, purchases = [] }: SuppliersClientProps) {
  const [activeTab, setActiveTab] = useState<'wholesalers' | 'custom'>('wholesalers');
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>(initialWholesalers);
  const [customSuppliers, setCustomSuppliers] = useState<CustomSupplier[]>(initialCustomSuppliers);
  const [selectedWholesaler, setSelectedWholesaler] = useState<Wholesaler | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [filterQuery, setFilterQuery] = useState('');

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<CustomSupplier | null>(null);

  // Form Fields
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');

  const [supplierError, setSupplierError] = useState('');
  const [supplierSubmitting, setSupplierSubmitting] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  useRealtimeEvent('SUPPLIER_UPDATE', () => { fetchCustomSuppliers(); });

  const fetchCustomSuppliers = async () => {
    try {
      const res = await fetch('/api/retailer/suppliers');
      const data = await res.json();
      if (data.success) setCustomSuppliers(data.suppliers);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') {
        if (selectedPurchase) { setSelectedPurchase(null); return; }
        setSelectedWholesaler(null);
        setShowAddSupplierModal(false);
        setEditingSupplier(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierError('');
    if (!supName) { setSupplierError('Supplier name is required'); return; }
    try {
      setSupplierSubmitting(true);
      const payload = { name: supName, contactPerson: supContact, phone: supPhone, email: supEmail, address: supAddress };
      let res;
      if (editingSupplier) {
        res = await updateCustomSupplierAction(editingSupplier.id, payload);
      } else {
        res = await createCustomSupplierAction(payload);
      }
      if (res.success) {
        setShowAddSupplierModal(false);
        setEditingSupplier(null);
        setSupName(''); setSupContact(''); setSupPhone(''); setSupEmail(''); setSupAddress('');
        fetchCustomSuppliers();
        broadcastUpdate('SUPPLIER_UPDATE');
      }
    } catch (err: any) {
      setSupplierError(err.message || 'Error saving supplier');
    } finally {
      setSupplierSubmitting(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Remove this custom supplier? This cannot be undone.')) return;
    try {
      const res = await deleteCustomSupplierAction(id);
      if (res.success) {
        fetchCustomSuppliers();
        broadcastUpdate('SUPPLIER_UPDATE');
      }
    } catch (err: any) { alert(err.message || 'Failed to delete'); }
  };

  const filteredWholesalers = wholesalers.filter(w =>
    w.companyName.toLowerCase().includes(filterQuery.toLowerCase()) ||
    w.address.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredCustom = customSuppliers.filter(s =>
    s.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  // Get all purchases for a wholesaler
  const getWholesalerPurchases = (wholesalerId: string) =>
    purchases.filter(p => p.wholesalerId === wholesalerId);

  const Modal = ({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: wide ? 720 : 460, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Procurement Suppliers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Live wholesaler networks and local custom distributors</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['wholesalers', 'custom'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: activeTab === tab ? '#F59E0B' : 'var(--card-bg)',
                color: activeTab === tab ? '#FFFFFF' : 'var(--text-secondary)',
                border: activeTab === tab ? 'none' : '1px solid var(--card-border)'
              }}
            >
              {tab === 'wholesalers' ? 'B2B Networks' : 'Local Custom Suppliers'}
            </button>
          ))}
        </div>
      </div>

      {/* Search Filter Strip */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--table-header-bg)', padding: '7px 12px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
          <Search style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
          <input ref={searchRef} type="text" placeholder="Search suppliers by name or area…" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--text-primary)' }} />
        </div>
        {activeTab === 'custom' && (
          <button onClick={() => { setEditingSupplier(null); setSupName(''); setSupContact(''); setSupPhone(''); setSupEmail(''); setSupAddress(''); setShowAddSupplierModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: '#F59E0B', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus style={{ width: 14, height: 14 }} /> Add Custom Supplier
          </button>
        )}
      </div>

      {/* Grid List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {activeTab === 'wholesalers' ? (
          filteredWholesalers.map(w => {
            const wPurchases = getWholesalerPurchases(w.id);
            const totalSpend = wPurchases.reduce((s, p) => s + p.netAmount, 0);
            return (
              <div
                key={w.id}
                onClick={() => setSelectedWholesaler(w)}
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#F59E0B'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,158,11,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{w.companyName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>PAN: {w.taxId || 'N/A'}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '3px 7px' }}>⬤ LIVE</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin style={{ width: 12, height: 12, color: 'var(--text-muted)', flexShrink: 0 }} /> {w.address}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone style={{ width: 12, height: 12, color: 'var(--text-muted)' }} /> {w.phone}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{w.products.length} medicines</span>
                    {wPurchases.length > 0 && <span style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600, marginLeft: 8 }}>{wPurchases.length} orders</span>}
                  </div>
                  {totalSpend > 0 && <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700, fontFamily: 'monospace' }}>{fmtRs(totalSpend)}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, color: '#3B82F6', fontWeight: 600, marginTop: -4, paddingTop: 6, borderTop: '1px dashed var(--card-border)' }}>
                  View supplier details & purchase history <ChevronRight style={{ width: 13, height: 13 }} />
                </div>
              </div>
            );
          })
        ) : (
          filteredCustom.map(s => (
            <div key={s.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Contact: {s.contactPerson || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => { setEditingSupplier(s); setSupName(s.name); setSupContact(s.contactPerson || ''); setSupPhone(s.phone || ''); setSupEmail(s.email || ''); setSupAddress(s.address || ''); setShowAddSupplierModal(true); }} style={{ padding: 6, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 6, cursor: 'pointer', color: '#3B82F6' }}><Edit2 style={{ width: 12, height: 12 }} /></button>
                  <button onClick={() => handleDeleteSupplier(s.id)} style={{ padding: 6, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, cursor: 'pointer', color: '#EF4444' }}><Trash2 style={{ width: 12, height: 12 }} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MapPin style={{ width: 14, height: 14, color: 'var(--text-muted)' }} /> {s.address || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Phone style={{ width: 14, height: 14, color: 'var(--text-muted)' }} /> {s.phone || '—'}</div>
                {s.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Mail style={{ width: 14, height: 14, color: 'var(--text-muted)' }} /> {s.email}</div>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Wholesaler Detail Modal ── */}
      {selectedWholesaler && (() => {
        const w = selectedWholesaler;
        const wPurchases = getWholesalerPurchases(w.id);
        const totalSpend = wPurchases.reduce((s, p) => s + p.netAmount, 0);
        // Aggregate items bought from this wholesaler
        const itemMap: Record<string, { name: string; sku: string; qty: number; spend: number }> = {};
        wPurchases.forEach(p => {
          p.items.forEach(item => {
            const k = item.product.sku;
            if (!itemMap[k]) itemMap[k] = { name: item.product.name, sku: item.product.sku, qty: 0, spend: 0 };
            itemMap[k].qty += item.quantity;
            itemMap[k].spend += item.quantity * item.pricePerUnit;
          });
        });
        const itemRows = Object.values(itemMap).sort((a, b) => b.spend - a.spend);

        return (
          <Modal onClose={() => setSelectedWholesaler(null)} title="Wholesaler — Supplier Detail View" wide>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Wholesaler Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Company</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3 }}>{w.companyName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>PAN/Tax: {w.taxId || 'N/A'}</div>
                </div>
                <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Contact</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}><Phone style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />{w.phone}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 5 }}><MapPin style={{ width: 11, height: 11, color: 'var(--text-muted)' }} />{w.address}</div>
                </div>
              </div>

              {/* Procurement Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Total Orders', val: wPurchases.length, color: '#3B82F6', fmt: false },
                  { label: 'Total Spend', val: totalSpend, color: '#F59E0B', fmt: true },
                  { label: 'Catalog Medicines', val: w.products.length, color: '#10B981', fmt: false },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.fmt ? fmtRs(s.val as number) : s.val}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Purchased Items Breakdown */}
              {itemRows.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Medicines Purchased from this Supplier
                  </div>
                  <div style={{ border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'var(--table-header-bg)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Medicine / SKU</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Total Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Total Spend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemRows.map(item => (
                          <tr key={item.sku} style={{ borderTop: '1px solid var(--card-border)' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: 600 }}>{item.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.sku}</div>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{item.qty}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#F59E0B' }}>{fmtRs(item.spend)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Order History */}
              {wPurchases.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Order History ({wPurchases.length} orders)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[...wPurchases].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8).map(p => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPurchase(p)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--table-header-bg)', borderRadius: 8, border: '1px solid var(--card-border)', cursor: 'pointer', transition: 'border-color 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#F59E0B'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--card-border)'}
                      >
                        <div>
                          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>#{p.id.substring(0, 8).toUpperCase()}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: p.status === 'DELIVERED' ? '#F0FDF4' : '#FFFBEB', color: p.status === 'DELIVERED' ? '#10B981' : '#D97706' }}>{p.status}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: '#F59E0B' }}>{fmtRs(p.netAmount)}</span>
                          <span style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600 }}>View →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catalog Preview */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  Available Catalog ({w.products.length} medicines)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {w.products.slice(0, 20).map(prod => (
                    <div key={prod.id} style={{ padding: '7px 10px', background: 'var(--table-header-bg)', borderRadius: 7, border: '1px solid var(--card-border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{prod.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{prod.sku}</div>
                      <div style={{ fontSize: 10, color: prod.batches.length > 0 ? '#10B981' : '#EF4444', marginTop: 2, fontWeight: 600 }}>
                        {prod.batches.length > 0 ? `${prod.batches.reduce((s, b) => s + b.availableBaseUnits, 0)} units` : 'Out of stock'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setSelectedWholesaler(null)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer' }}>Close</button>
            </div>
          </Modal>
        );
      })()}

      {/* ── Purchase Order Detail Sub-Modal ── */}
      {selectedPurchase && (() => {
        const p = selectedPurchase;
        const verifiedPaid = (p.b2bSettlements || []).filter(s => s.status === 'VERIFIED').reduce((sum, s) => sum + s.amount, 0);
        const pendingPaid  = (p.b2bSettlements || []).filter(s => s.status === 'PENDING').reduce((sum, s) => sum + s.amount, 0);
        const dueAmount    = Math.max(p.netAmount - verifiedPaid, 0);
        const settleStatus = p.settleStatus || (dueAmount <= 0 ? 'VERIFIED' : 'UNPAID');

        return (
          <div
            onClick={() => setSelectedPurchase(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 560, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}
            >
              {/* Modal Header */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Purchase Order Details</span>
                  <span style={{ marginLeft: 10, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: 600 }}>#{p.id.substring(0, 8).toUpperCase()}</span>
                </div>
                <button onClick={() => setSelectedPurchase(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Order Meta Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Order Date</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>{new Date(p.createdAt).toLocaleDateString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleTimeString()}</div>
                  </div>
                  <div style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Delivery Status</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3, color: p.status === 'DELIVERED' ? '#10B981' : '#F59E0B' }}>{p.status}</div>
                  </div>
                </div>

                {/* Billing Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[
                    { label: 'Gross Amount',   val: p.totalAmount,  color: 'var(--text-primary)' },
                    { label: 'Discount',        val: p.discountAmount, color: '#10B981' },
                    { label: 'Net Payable',     val: p.netAmount,    color: '#F59E0B' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--table-header-bg)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{fmtRs(s.val)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Payment status strip */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Verified Paid</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#166534', fontFamily: 'monospace', marginTop: 2 }}>{fmtRs(verifiedPaid)}</div>
                  </div>
                  {pendingPaid > 0 && (
                    <div style={{ flex: 1, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 10, color: '#92400E', fontWeight: 600, textTransform: 'uppercase' }}>Pending Verification</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#B45309', fontFamily: 'monospace', marginTop: 2 }}>{fmtRs(pendingPaid)}</div>
                    </div>
                  )}
                  <div style={{ flex: 1, background: dueAmount > 0 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${dueAmount > 0 ? '#FECACA' : '#BBF7D0'}`, borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 10, color: dueAmount > 0 ? '#991B1B' : '#166534', fontWeight: 600, textTransform: 'uppercase' }}>
                      {dueAmount > 0 ? 'Remaining Due' : 'Fully Cleared'}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: dueAmount > 0 ? '#EF4444' : '#10B981', fontFamily: 'monospace', marginTop: 2 }}>
                      {dueAmount > 0 ? fmtRs(dueAmount) : '✓ Paid'}
                    </div>
                  </div>
                </div>

                {/* Itemized List */}
                <div style={{ border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Ordered Medicines ({p.items.length} items)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--table-header-bg)' }}>
                        <th style={{ padding: '7px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Medicine</th>
                        <th style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Qty</th>
                        <th style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Rate</th>
                        <th style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.items.map(item => (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--card-border)' }}>
                          <td style={{ padding: '7px 12px' }}>
                            <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.product.sku}</div>
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{item.quantity}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{fmtRs(item.pricePerUnit)}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{fmtRs(item.quantity * item.pricePerUnit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Settlement Timeline */}
                {p.b2bSettlements && p.b2bSettlements.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                      Settlement Payments Timeline
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[...p.b2bSettlements].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((s, idx) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--table-header-bg)', borderRadius: 8, border: `1px solid ${s.status === 'VERIFIED' ? '#BBF7D0' : s.status === 'PENDING' ? '#FDE68A' : '#FECACA'}` }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: s.status === 'VERIFIED' ? '#10B981' : s.status === 'PENDING' ? '#F59E0B' : '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                            {idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{fmtRs(s.amount)}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {s.method || 'CASH'} · {new Date(s.createdAt).toLocaleDateString()} {new Date(s.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: s.status === 'VERIFIED' ? '#F0FDF4' : s.status === 'PENDING' ? '#FFFBEB' : '#FEF2F2', color: s.status === 'VERIFIED' ? '#10B981' : s.status === 'PENDING' ? '#D97706' : '#EF4444' }}>
                            {s.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No settlements yet placeholder */}
                {(!p.b2bSettlements || p.b2bSettlements.length === 0) && (
                  <div style={{ padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                    No settlement payments recorded for this order yet.
                  </div>
                )}

                <button onClick={() => setSelectedPurchase(null)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Supplier CRUD Modal */}
      {showAddSupplierModal && (
        <Modal onClose={() => setShowAddSupplierModal(false)} title={editingSupplier ? 'Edit Custom Supplier' : 'Register Custom Supplier'}>
          <form onSubmit={handleSaveSupplier} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {supplierError && <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, color: '#EF4444', fontSize: 13 }}>{supplierError}</div>}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Supplier / distributor name</label>
              <input type="text" required placeholder="e.g. Acme Pharma Inc." value={supName} onChange={e => setSupName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Contact Person</label>
              <input type="text" placeholder="Full Name" value={supContact} onChange={e => setSupContact(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Phone</label>
                <input type="text" placeholder="Phone Number" value={supPhone} onChange={e => setSupPhone(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" placeholder="Email" value={supEmail} onChange={e => setSupEmail(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Address</label>
              <input type="text" placeholder="Warehouse address" value={supAddress} onChange={e => setSupAddress(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button type="button" onClick={() => setShowAddSupplierModal(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={supplierSubmitting} style={{ flex: 2, padding: 10, border: 'none', background: '#F59E0B', color: '#FFFFFF', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {supplierSubmitting ? 'Saving…' : 'Save Supplier'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
