'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Search, MapPin, Phone, Building, ShoppingBag, Trash2,
  CheckCircle, AlertCircle, X, Package, ChevronRight,
  Tag, Layers, Hash, ExternalLink, Plus, ArrowRight,
  TrendingUp, Edit2, Mail, User
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

interface SuppliersClientProps {
  profile: { id: string; pharmacyName: string; };
  initialWholesalers: Wholesaler[];
  initialCustomSuppliers: CustomSupplier[];
}

type CartItem = { productId: string; name: string; qtyBoxes: number; pricePerBox: number; availableBoxes: number };

const WCOLORS = ['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#06B6D4'];

export default function SuppliersClient({ profile, initialWholesalers, initialCustomSuppliers }: SuppliersClientProps) {
  const [activeTab, setActiveTab] = useState<'wholesalers' | 'custom'>('wholesalers');
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>(initialWholesalers);
  const [customSuppliers, setCustomSuppliers] = useState<CustomSupplier[]>(initialCustomSuppliers);
  const [selectedWholesaler, setSelectedWholesaler] = useState<Wholesaler | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Cart / B2B Order State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderMessage, setOrderMessage] = useState({ text: '', isError: false });
  const [overrideMsg, setOverrideMsg] = useState('');
  const [needsOverride, setNeedsOverride] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});

  // Custom Supplier CRUD state
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<CustomSupplier | null>(null);
  
  // Custom Supplier Form fields
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  
  const [supplierError, setSupplierError] = useState('');
  const [supplierSubmitting, setSupplierSubmitting] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // Sync custom suppliers list in realtime
  useRealtimeEvent('SUPPLIER_UPDATE', () => {
    fetchCustomSuppliers();
  });

  const fetchCustomSuppliers = async () => {
    try {
      const res = await fetch('/api/retailer/suppliers');
      const data = await res.json();
      if (data.success) {
        setCustomSuppliers(data.suppliers);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setSelectedProduct(null); setShowCartModal(false); setShowAddSupplierModal(false); setEditingSupplier(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupplierError('');
    if (!supName) {
      setSupplierError('Supplier name is required');
      return;
    }

    try {
      setSupplierSubmitting(true);
      const payload = {
        name: supName,
        contactPerson: supContact,
        phone: supPhone,
        email: supEmail,
        address: supAddress,
      };

      let res;
      if (editingSupplier) {
        res = await updateCustomSupplierAction(editingSupplier.id, payload);
      } else {
        res = await createCustomSupplierAction(payload);
      }

      if (res.success) {
        setShowAddSupplierModal(false);
        setEditingSupplier(null);
        // Clear fields
        setSupName('');
        setSupContact('');
        setSupPhone('');
        setSupEmail('');
        setSupAddress('');
        // Sync
        broadcastUpdate('SUPPLIER_UPDATE');
      }
    } catch (err: any) {
      setSupplierError(err.message || 'Error occurred');
    } finally {
      setSupplierSubmitting(false);
    }
  };

  const handleDeleteSupplier = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this custom supplier?')) return;
    try {
      const res = await deleteCustomSupplierAction(id);
      if (res.success) {
        broadcastUpdate('SUPPLIER_UPDATE');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting supplier');
    }
  };

  const handleOpenEdit = (sup: CustomSupplier, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSupplier(sup);
    setSupName(sup.name || '');
    setSupContact(sup.contactPerson || '');
    setSupPhone(sup.phone || '');
    setSupEmail(sup.email || '');
    setSupAddress(sup.address || '');
    setShowAddSupplierModal(true);
  };

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupEmail('');
    setSupAddress('');
    setSupplierError('');
    setShowAddSupplierModal(true);
  };

  const filteredWholesalers = wholesalers
    .map((w) => {
      const q = filterQuery.toLowerCase();
      const nameMatch = w.companyName.toLowerCase().includes(q);
      const addrMatch = w.address.toLowerCase().includes(q);
      const hasMatchingProduct = w.products.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );

      let matchScore = 0;
      if (nameMatch) matchScore += 10;
      if (hasMatchingProduct) matchScore += 5;
      if (addrMatch) matchScore += 1;

      return { w, matchScore };
    })
    .filter((item) => filterQuery === '' || item.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .map((item) => item.w);

  const filteredCustom = customSuppliers.filter((c) =>
    c.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (c.address || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
    (c.contactPerson || '').toLowerCase().includes(filterQuery.toLowerCase())
  );

  const addToCart = (product: Product, qtyStr: string) => {
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) return;
    const unitsPerBox = product.tabletsPerStrip * product.stripsPerBox;
    const totalUnits  = product.batches.reduce((sum, b) => sum + b.availableBaseUnits, 0);
    const availableBoxes = Math.floor(totalUnits / unitsPerBox);
    if (qty > availableBoxes) {
      alert(`Only ${availableBoxes} boxes available in this wholesaler's stock.`);
      return;
    }
    const price = product.batches[0]?.sellingPricePerBox || 100;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, qtyBoxes: qty } : i);
      return [...prev, { productId: product.id, name: product.name, qtyBoxes: qty, pricePerBox: price, availableBoxes }];
    });
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((i) => i.productId !== productId));

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWholesaler || cart.length === 0) return;
    try {
      setPlacingOrder(true);
      setOrderMessage({ text: '', isError: false });
      const payload: any = {
        retailerId:   profile.id,
        wholesalerId: selectedWholesaler.id,
        items: cart.map((c) => ({ productId: c.productId, qtyBoxes: c.qtyBoxes })),
      };
      if (needsOverride && overrideMsg) payload.overrideJustification = overrideMsg;
      const res  = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrderMessage({ text: 'B2B order placed successfully! Please check status in Orders tab.', isError: false });
        setCart([]);
        setNeedsOverride(false);
        setOverrideMsg('');
        broadcastUpdate('ORDER_UPDATE');
        setTimeout(() => setShowCartModal(false), 2000);
      } else {
        if (data.error === 'CREDIT_BLOCKED') {
          setNeedsOverride(true);
          setOrderMessage({ text: `Blocked: ${data.reason}. Enter override justification to proceed.`, isError: true });
        } else {
          setOrderMessage({ text: data.error || 'Failed to place order', isError: true });
        }
      }
    } catch (err: any) {
      setOrderMessage({ text: err.message || 'Network error', isError: true });
    } finally {
      setPlacingOrder(false);
    }
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.qtyBoxes * i.pricePerBox, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1E293B', margin: 0 }}>Supplier & Wholesale Panel</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            Browse live wholesalers or manage your retail custom suppliers &nbsp;
            <span style={{ fontSize: 11, color: '#94A3B8' }}>[ / ] Search</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'custom' && (
            <button
              onClick={handleOpenCreate}
              style={{ background: '#F59E0B', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
            >
              <Plus style={{ width: 15, height: 15 }} />
              Add Custom Supplier
            </button>
          )}
          {cart.length > 0 && (
            <button
              onClick={() => setShowCartModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
            >
              <ShoppingBag style={{ width: 16, height: 16 }} />
              Basket ({cart.length}) · Rs. {cartTotal.toLocaleString()}
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: '#F8FAFC', borderRadius: 12, padding: 4, border: '1px solid #E2E8F0' }}>
        <button
          onClick={() => { setActiveTab('wholesalers'); setFilterQuery(''); }}
          style={{ flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', background: activeTab === 'wholesalers' ? '#FFFFFF' : 'transparent', color: activeTab === 'wholesalers' ? '#F59E0B' : '#64748B', boxShadow: activeTab === 'wholesalers' ? '0 2px 8px rgba(0,0,0,0.07)' : 'none' }}
        >
          Wholesale B2B Marketplace
        </button>
        <button
          onClick={() => { setActiveTab('custom'); setFilterQuery(''); }}
          style={{ flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', background: activeTab === 'custom' ? '#FFFFFF' : 'transparent', color: activeTab === 'custom' ? '#F59E0B' : '#64748B', boxShadow: activeTab === 'custom' ? '0 2px 8px rgba(0,0,0,0.07)' : 'none' }}
        >
          Custom Direct Suppliers ({customSuppliers.length})
        </button>
      </div>

      {activeTab === 'wholesalers' ? (
        /* ── Wholesale B2B panel ── */
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
          
          {/* Left panel: Wholesalers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', padding: '8px 14px', borderRadius: 10, border: '1.5px solid #F1F5F9' }}>
              <Search style={{ width: 14, height: 14, color: '#94A3B8' }} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search wholesalers…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 12 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredWholesalers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8', fontSize: 12 }}>No wholesalers found</div>
              ) : filteredWholesalers.map((w, idx) => {
                const isActive = selectedWholesaler?.id === w.id;
                const wColor = WCOLORS[idx % WCOLORS.length];
                const totalSKUs = w.products.length;
                const totalBoxes = w.products.reduce((sum, p) => {
                  const tpb = p.tabletsPerStrip * p.stripsPerBox;
                  return sum + p.batches.reduce((bs, b) => bs + Math.floor(b.availableBaseUnits / tpb), 0);
                }, 0);
                return (
                  <button
                    key={w.id}
                    onClick={() => { setSelectedWholesaler(w); setCart([]); setOrderMessage({ text: '', isError: false }); setQtyInputs({}); }}
                    style={{
                      background: '#FFFFFF',
                      border: isActive ? `2px solid ${wColor}` : '1.5px solid #F1F5F9',
                      borderRadius: 14,
                      padding: 16,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      boxShadow: isActive ? `0 4px 16px ${wColor}20` : '0 1px 4px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${wColor}12`, border: `1.5px solid ${wColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: wColor, flexShrink: 0, textAlign: 'center', lineHeight: '32px' }}>
                        {w.companyName[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: '#1E293B', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.companyName}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <MapPin style={{ width: 9, height: 9 }} />
                          {w.address.length > 25 ? w.address.substring(0, 25) + '…' : w.address}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid #F8FAFC' }}>
                      <div style={{ flex: 1, background: `${wColor}08`, borderRadius: 6, padding: '5px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: wColor }}>{totalSKUs}</div>
                        <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700 }}>SKUs</div>
                      </div>
                      <div style={{ flex: 1, background: `${wColor}08`, borderRadius: 6, padding: '5px 8px', textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: wColor }}>{totalBoxes}</div>
                        <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700 }}>BOXES</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Catalog View */}
          <div>
            {!selectedWholesaler ? (
              <div style={{ background: '#FFFFFF', borderRadius: 18, border: '1.5px solid #F1F5F9', padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(245,158,11,0.08)', border: '2px dashed rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building style={{ width: 28, height: 28, color: '#F59E0B' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', margin: 0 }}>Select a Wholesaler</h3>
                  <p style={{ fontSize: 13, color: '#94A3B8', margin: '6px 0 0' }}>Choose a supplier from the left list to browse their live catalog and order items</p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Banner */}
                <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #F1F5F9', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#F59E0B' }}>
                      {selectedWholesaler.companyName[0]}
                    </div>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1E293B', margin: 0 }}>{selectedWholesaler.companyName}</h2>
                      <div style={{ display: 'flex', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}><Phone style={{ width: 10, height: 10 }} />{selectedWholesaler.phone}</span>
                        <span style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin style={{ width: 10, height: 10 }} />{selectedWholesaler.address}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Catalog Table */}
                <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #F1F5F9', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'left' }}>Medicine</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'left' }}>Category</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'right' }}>Available</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'right' }}>Price / Box</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Order Qty</th>
                        <th style={{ padding: '12px 20px', color: '#64748B', fontWeight: 700, textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWholesaler.products
                        .map((prod) => {
                          const q = filterQuery.toLowerCase();
                          const isMatch = q !== '' && (
                            prod.name.toLowerCase().includes(q) ||
                            prod.sku.toLowerCase().includes(q) ||
                            prod.category.toLowerCase().includes(q)
                          );
                          return { prod, isMatch };
                        })
                        .sort((a, b) => (a.isMatch === b.isMatch ? 0 : a.isMatch ? -1 : 1))
                        .map(({ prod, isMatch }) => {
                          const tpb = prod.tabletsPerStrip * prod.stripsPerBox;
                          const totalUnits  = prod.batches.reduce((sum, b) => sum + b.availableBaseUnits, 0);
                          const totalBoxes  = Math.floor(totalUnits / tpb);
                          const price       = prod.batches[0]?.sellingPricePerBox || 100;
                          const cartItem    = cart.find((c) => c.productId === prod.id);
                          const inCart      = !!cartItem;
                          return (
                            <tr key={prod.id} style={{ borderBottom: '1px solid #F8FAFC', background: isMatch ? 'rgba(245,158,11,0.06)' : undefined }}>
                              <td style={{ padding: '13px 20px' }}>
                                <div style={{ fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {prod.name}
                                  {isMatch && <span style={{ fontSize: 9, background: '#FEF3C7', color: '#D97706', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>Search Match</span>}
                                </div>
                                <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{prod.sku}</div>
                              </td>
                              <td style={{ padding: '13px 20px' }}>
                                <span style={{ padding: '3px 8px', borderRadius: 6, background: '#F1F5F9', fontSize: 11, fontWeight: 600, color: '#475569' }}>{prod.category}</span>
                              </td>
                              <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                                <div style={{ fontWeight: 700, color: totalBoxes > 0 ? '#1E293B' : '#EF4444' }}>{totalBoxes} boxes</div>
                                <div style={{ fontSize: 10, color: '#94A3B8' }}>{totalUnits.toLocaleString()} units</div>
                              </td>
                              <td style={{ padding: '13px 20px', textAlign: 'right', fontWeight: 800, color: '#F59E0B' }}>
                                Rs. {price.toLocaleString()}
                              </td>
                              <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min="1"
                                  max={totalBoxes}
                                  placeholder="0"
                                  value={qtyInputs[prod.id] || (cartItem ? String(cartItem.qtyBoxes) : '')}
                                  onChange={(e) => setQtyInputs({ ...qtyInputs, [prod.id]: e.target.value })}
                                  style={{ width: 60, padding: '6px', borderRadius: 7, border: '1px solid #E2E8F0', textAlign: 'center' }}
                                />
                              </td>
                              <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                                <button
                                  onClick={() => addToCart(prod, qtyInputs[prod.id] || (cartItem ? String(cartItem.qtyBoxes) : '1'))}
                                  style={{ padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer', background: inCart ? '#10B981' : '#F59E0B', color: '#FFFFFF' }}
                                >
                                  {inCart ? 'In Basket' : 'Add'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Custom Direct Suppliers Tab ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFFFF', padding: '8px 14px', borderRadius: 10, border: '1.5px solid #F1F5F9', maxWidth: 360 }}>
            <Search style={{ width: 14, height: 14, color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search custom suppliers…"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 12 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filteredCustom.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', background: '#FFFFFF', border: '1.5px solid #F1F5F9', borderRadius: 16, padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
                <Building style={{ width: 40, height: 40, color: '#CBD5E1', margin: '0 auto 10px' }} />
                <div>No custom suppliers registered yet. Click "Add Custom Supplier" above.</div>
              </div>
            ) : filteredCustom.map((sup) => (
              <div
                key={sup.id}
                style={{ background: '#FFFFFF', border: '1.5px solid #F1F5F9', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 800, color: '#1E293B', fontSize: 14 }}>{sup.name}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={(e) => handleOpenEdit(sup, e)} style={{ border: 'none', background: '#F8FAFC', padding: 6, borderRadius: 6, cursor: 'pointer', color: '#3B82F6' }}>
                        <Edit2 style={{ width: 12, height: 12 }} />
                      </button>
                      <button onClick={(e) => handleDeleteSupplier(sup.id, e)} style={{ border: 'none', background: 'rgba(239,68,68,0.06)', padding: 6, borderRadius: 6, cursor: 'pointer', color: '#EF4444' }}>
                        <Trash2 style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, fontSize: 12, color: '#64748B' }}>
                    {sup.contactPerson && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User style={{ width: 12, height: 12, color: '#94A3B8' }} />
                        {sup.contactPerson}
                      </div>
                    )}
                    {sup.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone style={{ width: 12, height: 12, color: '#94A3B8' }} />
                        {sup.phone}
                      </div>
                    )}
                    {sup.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail style={{ width: 12, height: 12, color: '#94A3B8' }} />
                        {sup.email}
                      </div>
                    )}
                  </div>
                </div>

                {sup.address && (
                  <div style={{ fontSize: 11, color: '#94A3B8', borderTop: '1px solid #F8FAFC', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin style={{ width: 11, height: 11 }} />
                    {sup.address}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cart Modal ── */}
      {showCartModal && selectedWholesaler && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form onSubmit={handlePlaceOrder} style={{ width: '100%', maxWidth: 520, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingBag style={{ width: 18, height: 18, color: '#F59E0B' }} />
                Review B2B Order Basket
              </h3>
              <button type="button" onClick={() => setShowCartModal(false)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {orderMessage.text && (
                <div style={{ padding: '10px 14px', background: orderMessage.isError ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)', border: `1px solid ${orderMessage.isError ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, color: orderMessage.isError ? '#EF4444' : '#10B981', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                  {orderMessage.text}
                </div>
              )}

              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cart.map((item) => (
                  <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{item.qtyBoxes} boxes × Rs. {item.pricePerBox.toLocaleString()}</div>
                    </div>
                    <button type="button" onClick={() => removeFromCart(item.productId)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444' }}>
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
              </div>

              {needsOverride && (
                <div style={{ border: '1.5px solid #FEE2E2', padding: 14, borderRadius: 12, background: '#FEF2F2', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#B91C1C' }}>LIMIT OVERRIDE JUSTIFICATION NOTE</label>
                  <input
                    type="text"
                    required
                    value={overrideMsg}
                    onChange={(e) => setOverrideMsg(e.target.value)}
                    placeholder="Enter limit override request note..."
                    style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #EF4444', fontSize: 12 }}
                  />
                </div>
              )}

              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontWeight: 950, fontSize: 15, color: '#1E293B' }}>
                <span>Order Total:</span>
                <span style={{ color: '#F59E0B' }}>Rs. {cartTotal.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowCartModal(false)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Close
              </button>
              <button type="submit" disabled={placingOrder} style={{ flex: 2, padding: 11, border: 'none', borderRadius: 10, background: '#F59E0B', color: '#FFFFFF', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: placingOrder ? 0.7 : 1 }}>
                {placingOrder ? 'Placing Order…' : 'Submit B2B Order'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Add Custom Supplier Modal ── */}
      {showAddSupplierModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form onSubmit={handleSaveSupplier} style={{ width: '100%', maxWidth: 460, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus style={{ width: 18, height: 18, color: '#F59E0B' }} />
                {editingSupplier ? 'Modify Custom Supplier' : 'Register Custom Supplier'}
              </h3>
              <button type="button" onClick={() => { setShowAddSupplierModal(false); setEditingSupplier(null); }} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {supplierError && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 12, fontWeight: 600 }}>
                  {supplierError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Supplier Name</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Acme Pharmaceuticals Ltd."
                  style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Contact Person</label>
                  <input
                    type="text"
                    value={supContact}
                    onChange={(e) => setSupContact(e.target.value)}
                    placeholder="e.g. John Doe"
                    style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Phone</label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="e.g. +977-98123456"
                    style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Email Address</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="e.g. sales@acme.com"
                  style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Physical Address</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="e.g. Tinkune, Kathmandu"
                  style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setShowAddSupplierModal(false); setEditingSupplier(null); }} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={supplierSubmitting} style={{ flex: 2, padding: 11, border: 'none', borderRadius: 10, background: '#F59E0B', color: '#FFFFFF', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: supplierSubmitting ? 0.7 : 1 }}>
                {supplierSubmitting ? 'Saving…' : 'Save Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
