'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Search, ChevronRight, ShoppingBag, CreditCard, Mail, Phone, 
  MapPin, Calendar, Receipt, TrendingUp, Info, Plus, X, UserPlus, CheckCircle, AlertCircle, FileText, Filter, SlidersHorizontal
} from 'lucide-react';
import { useSSEListener } from '@/hooks/useRealtimeData';
import { useRouter } from 'next/navigation';

interface OrderItem {
  id: string;
  productId: string;
  product: {
    name: string;
    sku: string;
  };
  quantity: number;
  pricePerUnit: number;
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  createdAt: string;
  overrideJustification?: string | null;
  items?: OrderItem[];
}

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

interface Customer {
  id: string;
  pharmacyName: string;
  registrationNumber: string;
  address: string;
  phone: string;
  creditLimit: number;
  lifetimeSpend: number;
  advanceBalance?: number;
  user: {
    email: string;
    fullName?: string | null;
  };
  orders: Order[];
}

interface CustomerClientProps {
  customers: Customer[];
  wholesalerId: string;
}

export default function CustomerClient({ customers: initialCustomers, wholesalerId }: CustomerClientProps) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  
  // Filters and Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [dueFilter, setDueFilter] = useState<'all' | 'due' | 'cleared'>('all');
  const [spendFilter, setSpendFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortOrder, setSortOrder] = useState<'alpha' | 'spend' | 'due'>('alpha');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [editingCreditLimit, setEditingCreditLimit] = useState('');
  const [savingCreditLimit, setSavingCreditLimit] = useState(false);

  const handleSelectCustomer = (id: string | null) => {
    setSelectedCustomerId(id);
    if (id) {
      const cust = customers.find(c => c.id === id);
      if (cust) {
        setEditingCreditLimit(cust.creditLimit.toString());
      }
    } else {
      setEditingCreditLimit('');
    }
  };

  const handleSaveCreditLimit = async () => {
    if (!selectedCustomerId) return;
    setSavingCreditLimit(true);
    try {
      const res = await fetch('/api/wholesaler/customers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedCustomerId,
          creditLimit: parseFloat(editingCreditLimit),
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save credit limit');
      
      // Update local customers state
      setCustomers(customers.map(c => c.id === selectedCustomerId ? { ...c, creditLimit: parseFloat(editingCreditLimit) } : c));
      alert('Credit limit updated successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingCreditLimit(false);
    }
  };

  // Add Customer Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPharmacy, setAddPharmacy] = useState('');
  const [addContact, setAddContact] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  // Settle input state
  const [settleAmount, setSettleAmount] = useState('');
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);

  // Clicked Invoice details modal
  const [activeInvoice, setActiveInvoice] = useState<Order | null>(null);

  // Re-fetch or refresh on SSE update
  useSSEListener(wholesalerId, (type) => {
    if (type === 'ORDER_CREATED' || type === 'ORDER_STATUS_CHANGED' || type === 'RETAILER_UPDATED') {
      router.refresh();
    }
  });

  // Sync state with prop updates
  useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  // Helper: get total verified paid for an order from DB
  const getOrderPaid = (order: any): number => {
    if (order.b2bSettlements && Array.isArray(order.b2bSettlements)) {
      return order.b2bSettlements
        .filter((s: any) => s.status === 'VERIFIED')
        .reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    }
    return order.settleAmount || 0;
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      const res = await fetch('/api/wholesaler/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pharmacyName: addPharmacy, fullName: addContact, phone: addPhone, email: addEmail, address: addAddress })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create customer');
      setAddSuccess(`${addPharmacy} registered successfully!`);
      setTimeout(() => { 
        setShowAddModal(false); 
        setAddSuccess(''); 
        setAddPharmacy(''); setAddContact(''); setAddPhone(''); setAddEmail(''); setAddAddress(''); 
        router.refresh(); 
      }, 1500);
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleSettleSubmit = async (orderId: string, totalAmount: number) => {
    const inputPaid = parseFloat(settleAmount) || 0;
    if (inputPaid <= 0) return;
    
    try {
      const res = await fetch('/api/wholesaler/verify-settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount: inputPaid, method: 'CASH', approve: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update database');
      }
      const data = await res.json();

      // Update local customers state with new b2bSettlement entry
      setCustomers(prev => prev.map(c => ({
        ...c,
        orders: c.orders.map((o: any) => {
          if (o.id !== orderId) return o;
          const newSettle = {
            id: Math.random().toString(),
            orderId,
            amount: inputPaid,
            method: 'CASH',
            status: 'VERIFIED',
            createdAt: new Date().toISOString()
          };
          return {
            ...o,
            settleAmount: data.order?.settleAmount ?? (o.settleAmount || 0) + inputPaid,
            b2bSettlements: [...(o.b2bSettlements || []), newSettle]
          };
        })
      })));

      setSettleAmount('');
      setSettlingOrderId(null);
    } catch (err: any) {
      alert(err.message || 'Error recording payment settlement in database');
    }
  };

  const calculateCustomerBalance = (customer: Customer) => {
    if (!customer) return { totalPaid: 0, totalPending: 0 };
    let totalPaid = 0;
    let totalPending = 0;
    customer.orders.forEach((o: any) => {
      const paid = getOrderPaid(o);
      totalPaid += paid;
      totalPending += Math.max(o.netAmount - paid, 0);
    });
    return { totalPaid, totalPending };
  };

  // Filter and Sort Logic
  let filteredCustomers = customers.filter(c => {
    const matchesSearch = c.pharmacyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm);
    if (!matchesSearch) return false;

    const { totalPending: pendingVal } = calculateCustomerBalance(c);
    if (dueFilter === 'due' && pendingVal <= 0) return false;
    if (dueFilter === 'cleared' && pendingVal > 0) return false;

    if (spendFilter === 'high' && c.lifetimeSpend < 100000) return false;
    if (spendFilter === 'medium' && (c.lifetimeSpend < 20000 || c.lifetimeSpend >= 100000)) return false;
    if (spendFilter === 'low' && c.lifetimeSpend >= 20000) return false;

    return true;
  });

  filteredCustomers = [...filteredCustomers].sort((a, b) => {
    if (sortOrder === 'spend') {
      return b.lifetimeSpend - a.lifetimeSpend;
    }
    if (sortOrder === 'due') {
      const dueA = calculateCustomerBalance(a).totalPending;
      const dueB = calculateCustomerBalance(b).totalPending;
      return dueB - dueA;
    }
    return a.pharmacyName.localeCompare(b.pharmacyName);
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const { totalPaid, totalPending } = selectedCustomer ? calculateCustomerBalance(selectedCustomer) : { totalPaid: 0, totalPending: 0 };

  const clearFilters = () => {
    setSearchTerm('');
    setDueFilter('all');
    setSpendFilter('all');
    setSortOrder('alpha');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(186,230,253,0.5)', borderRadius: 20, padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.07)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users style={{ width: 22, height: 22, color: '#0EA5E9' }} />
            Customer Directory
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            Manage retailer relations and review client-tier transaction statements
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
          style={{ background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', whiteSpace: 'nowrap' }}
        >
          <UserPlus style={{ width: 14, height: 14 }} />
          Add Customer
        </button>
      </div>

      {/* Advanced Filter Panel */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12, padding: '14px 20px',
        background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(226,232,240,0.8)', borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
      }}>
        {/* Search */}
        <div style={{ minWidth: 200, flex: '1 1 200px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
            <Search style={{ width: 12, height: 12, color: '#0EA5E9' }} /> Search Retailers
          </label>
          <input
            type="text"
            placeholder="Search by pharmacy, contact, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="filter-input"
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10, outline: 'none', background: 'white' }}
          />
        </div>

        {/* Due Status Filter */}
        <div style={{ minWidth: 140 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Due Status</label>
          <select
            value={dueFilter}
            onChange={(e: any) => setDueFilter(e.target.value)}
            className="filter-select"
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10, outline: 'none', background: 'white', cursor: 'pointer' }}
          >
            <option value="all">All Statuses</option>
            <option value="due">Has Outstanding Due</option>
            <option value="cleared">Cleared Accounts</option>
          </select>
        </div>

        {/* Spending Tier Filter */}
        <div style={{ minWidth: 140 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Spending Tier</label>
          <select
            value={spendFilter}
            onChange={(e: any) => setSpendFilter(e.target.value)}
            className="filter-select"
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10, outline: 'none', background: 'white', cursor: 'pointer' }}
          >
            <option value="all">All Tiers</option>
            <option value="high">High Spend (&gt;Rs.100k)</option>
            <option value="medium">Medium Spend (Rs.20k - Rs.100k)</option>
            <option value="low">Low Spend (&lt;Rs.20k)</option>
          </select>
        </div>

        {/* Sorting Selection */}
        <div style={{ minWidth: 140 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>Sort Order</label>
          <select
            value={sortOrder}
            onChange={(e: any) => setSortOrder(e.target.value)}
            className="filter-select"
            style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1.5px solid #E2E8F0', borderRadius: 10, outline: 'none', background: 'white', cursor: 'pointer' }}
          >
            <option value="alpha">Pharmacy Name (A-Z)</option>
            <option value="spend">Lifetime Spend (Highest)</option>
            <option value="due">Outstanding Due (Highest)</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {(searchTerm || dueFilter !== 'all' || spendFilter !== 'all' || sortOrder !== 'alpha') && (
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button
              onClick={clearFilters}
              style={{
                padding: '8px 16px', background: '#FEF2F2', border: '1.5px solid #FCA5A5',
                color: '#EF4444', borderRadius: 10, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <X style={{ width: 12, height: 12 }} /> Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Grid Split - Side-by-Side Detail View */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left Side: Customer List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '68vh', overflowY: 'auto' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>
                No customers found matching filters.
              </div>
            ) : (
              filteredCustomers.map(c => {
                const isSelected = selectedCustomerId === c.id;
                const { totalPending: pendingVal } = calculateCustomerBalance(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(isSelected ? null : c.id)}
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
                        {c.pharmacyName}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CreditCard style={{ width: 11, height: 11, color: '#94A3B8' }} />
                        <span>Limit: Rs. {c.creditLimit.toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 8, background: pendingVal > 0 ? '#FEF2F2' : '#ECFDF5', color: pendingVal > 0 ? '#EF4444' : '#059669' }}>
                        {pendingVal > 0 ? `Due: Rs. ${pendingVal.toLocaleString()}` : 'Cleared'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B' }}>{c.orders.length} orders</span>
                        <ChevronRight style={{ width: 14, height: 14, color: isSelected ? '#0EA5E9' : '#CBD5E1' }} />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Customer Detail Pane */}
        <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 20, minHeight: '50vh' }}>
          {selectedCustomer && selectedCustomerId ? (
            <div className="space-y-6">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users style={{ width: 18, height: 18, color: '#0EA5E9' }} />
                    Customer Account: {selectedCustomer.pharmacyName}
                  </h3>
                  <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>B2B transactions history, billing limits, and credit controls</p>
                </div>
                <button onClick={() => setSelectedCustomerId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>

              {/* Contact information card */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#FAFCFF', border: '1.5px solid #E0F2FE', borderRadius: 16, padding: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569' }}>
                  <div><strong>Contact Person:</strong> {selectedCustomer.user?.fullName || 'N/A'}</div>
                  <div><strong>Phone:</strong> {selectedCustomer.phone}</div>
                  <div><strong>Email:</strong> {selectedCustomer.user?.email}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#475569' }}>
                  <div><strong>Address:</strong> {selectedCustomer.address || 'N/A'}</div>
                  <div><strong>Drug Registration:</strong> {selectedCustomer.registrationNumber}</div>
                </div>
              </div>

              {/* Financial KPI stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <div className="card" style={{ padding: 14, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#065F46', textTransform: 'uppercase' }}>Lifetime Spend</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#047857', fontFamily: 'monospace', marginTop: 4 }}>Rs. {selectedCustomer.lifetimeSpend.toLocaleString()}</div>
                </div>
                <div className="card" style={{ padding: 14, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#854D0E', textTransform: 'uppercase' }}>Total Outstanding Due</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#C2410C', fontFamily: 'monospace', marginTop: 4 }}>Rs. {totalPending.toLocaleString()}</div>
                </div>
                <div className="card" style={{ padding: 14, background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase' }}>B2B Credit Limit</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0284C7', fontFamily: 'monospace', marginTop: 4 }}>Rs. {selectedCustomer.creditLimit.toLocaleString()}</div>
                </div>
                <div className="card" style={{ padding: 14, background: '#F5F3FF', border: '1px solid #DDD6FE' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#6D28D9', textTransform: 'uppercase' }}>Advance Balance</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#7C3AED', fontFamily: 'monospace', marginTop: 4 }}>Rs. {(selectedCustomer.advanceBalance || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* B2B Credit Controls */}
              <div style={{ border: '1.5px solid #BAE6FD', background: '#F0F9FF', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#0369A1', letterSpacing: '0.05em' }}>B2B Credit Controls</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 850, color: '#0284C7', textTransform: 'uppercase', marginBottom: 4 }}>Credit Limit (Rs.)</label>
                    <input 
                      type="number" 
                      value={editingCreditLimit} 
                      onChange={e => setEditingCreditLimit(e.target.value)} 
                      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #BAE6FD', fontSize: 12, width: '100%', outline: 'none', background: 'white', color: '#1E293B' }}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleSaveCreditLimit} 
                  disabled={savingCreditLimit}
                  className="btn-primary" 
                  style={{ alignSelf: 'flex-end', padding: '6px 12px', fontSize: 10, background: '#0EA5E9' }}
                >
                  {savingCreditLimit ? 'Saving...' : 'Save Credit Limit'}
                </button>
              </div>

              {/* Order ledger statement */}
              <div>
                <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em', marginBottom: 10 }}>Transaction Ledger Statement</h4>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice Ref</th>
                        {selectedCustomer.pharmacyName === "Walk-in Customer (POS)" && <th>Walk-in Patient</th>}
                        <th>Invoice status</th>
                        <th style={{ textAlign: 'right' }}>Net Amount</th>
                        <th style={{ textAlign: 'right' }}>Paid Amt</th>
                        <th style={{ textAlign: 'right' }}>Settlement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomer.orders.length === 0 ? (
                        <tr>
                          <td colSpan={selectedCustomer.pharmacyName === "Walk-in Customer (POS)" ? 7 : 6} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>No billing orders registered for this customer.</td>
                        </tr>
                      ) : (
                        selectedCustomer.orders.map((o: any) => {
                          const oPaid = getOrderPaid(o);
                          const isFullyPaid = oPaid >= o.netAmount;
                          return (
                            <tr key={o.id}>
                              <td style={{ fontSize: 11, color: '#64748B' }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                              <td>
                                <button onClick={() => setActiveInvoice(o)} style={{ background: 'none', border: 'none', color: '#0EA5E9', fontWeight: 800, cursor: 'pointer', fontFamily: 'monospace', textDecoration: 'underline' }}>
                                  ORD-{o.id.substring(0, 8).toUpperCase()}
                                </button>
                              </td>
                              {selectedCustomer.pharmacyName === "Walk-in Customer (POS)" && (
                                <td style={{ fontSize: 11, color: '#0EA5E9', fontWeight: 700 }}>
                                  {getWalkInName(o.overrideJustification)}
                                </td>
                              )}
                              <td>
                                <span className={`status-pill status-pill-${o.status.toLowerCase()}`}>{o.status}</span>
                              </td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>Rs. {o.netAmount.toLocaleString()}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>Rs. {oPaid.toLocaleString()}</td>
                              <td style={{ textAlign: 'right' }}>
                                {!isFullyPaid ? (
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }} onClick={e => e.stopPropagation()}>
                                    {settlingOrderId === o.id ? (
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <input 
                                          type="number" 
                                          placeholder="Amt" 
                                          value={settleAmount} 
                                          onChange={e => setSettleAmount(e.target.value)} 
                                          className="input-crisp" 
                                          style={{ width: 64, fontSize: 10, padding: 4 }} 
                                        />
                                        <button 
                                          onClick={() => handleSettleSubmit(o.id, o.netAmount)}
                                          style={{ padding: '4px 8px', fontSize: 9, background: '#10B981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}
                                        >
                                          OK
                                        </button>
                                        <button 
                                          onClick={() => setSettlingOrderId(null)}
                                          style={{ padding: '4px 6px', fontSize: 9, background: '#64748B', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => setSettlingOrderId(o.id)}
                                        className="btn-ghost"
                                        style={{ padding: '4px 8px', fontSize: 10, borderColor: '#BAE6FD', color: '#0EA5E9' }}
                                      >
                                        Settle
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>✓ Settled</span>
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
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px 20px', textAlign: 'center', color: '#94A3B8' }}>
              <Users style={{ width: 48, height: 48, color: '#E2E8F0', marginBottom: 16 }} />
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select a Retailer</h3>
              <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, maxWidth: 360, lineHeight: 1.6 }}>Choose a pharmacy retailer from the directory list on the left to inspect their lifetime spending metrics, credit warnings, and ledger invoices side-by-side.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setAddError(''); setAddSuccess(''); }}>
          <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '500px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserPlus style={{ width: 18, height: 18, color: '#0EA5E9' }} />
                  Register New Customer
                </h3>
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Add a pharmacy retailer account to your customer directory</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setAddError(''); setAddSuccess(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 8 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div className="modal-body">
              {addError && <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}><AlertCircle style={{ width: 13, height: 13 }} />{addError}</div>}
              {addSuccess && <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#059669', display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle style={{ width: 13, height: 13 }} />{addSuccess}</div>}
              <form onSubmit={handleAddCustomer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Pharmacy Name *</label>
                    <input required value={addPharmacy} onChange={e => setAddPharmacy(e.target.value)} placeholder="e.g. Sunrise Pharmacy" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Contact Person *</label>
                    <input required value={addContact} onChange={e => setAddContact(e.target.value)} placeholder="e.g. Ram Shrestha" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Phone Number *</label>
                    <input required value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="98XXXXXXXX" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Email Address *</label>
                    <input required type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="pharmacy@email.com" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Dispatch Address</label>
                  <input value={addAddress} onChange={e => setAddAddress(e.target.value)} placeholder="Street, City, District" className="input-crisp" style={{ width: '100%', fontSize: 12 }} />
                </div>
                <button type="submit" disabled={addLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px', background: 'linear-gradient(135deg, #0EA5E9, #38BDF8)', fontSize: 12, opacity: addLoading ? 0.7 : 1 }}>
                  {addLoading ? 'Registering...' : 'Register Customer Account'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bill ID detailed popup modal */}
      {activeInvoice && (() => {
        const activeInv = activeInvoice as any;
        const orderPaid = getOrderPaid(activeInv);
        const orderRemaining = Math.max(activeInv.netAmount - orderPaid, 0);
        const percentPaid = activeInv.netAmount > 0 ? Math.round((orderPaid / activeInv.netAmount) * 100) : 0;
        const verifiedSettlements = (activeInv.b2bSettlements || []).filter((s: any) => s.status === 'VERIFIED');

        return (
          <div className="modal-overlay" onClick={() => setActiveInvoice(null)}>
            <div className="modal-card animate-scaleIn" style={{ '--modal-max-width': '640px' } as React.CSSProperties} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText style={{ width: 18, height: 18, color: '#0EA5E9' }} /> Sales Invoice Details
                  </h3>
                  <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Full transaction logs, itemized lines, and payment records</p>
                </div>
                <button onClick={() => setActiveInvoice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>

              <div className="modal-body space-y-6">
                <div style={{ display: 'grid', gridTemplateColumns: selectedCustomer?.pharmacyName === "Walk-in Customer (POS)" ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12, background: '#F8FAFC', padding: 16, borderRadius: 16, border: '1px solid #E2E8F0' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Invoice ID</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', fontFamily: 'monospace' }}>ORD-{activeInvoice.id.toUpperCase()}</div>
                  </div>
                  {selectedCustomer?.pharmacyName === "Walk-in Customer (POS)" && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Walk-in Patient</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0EA5E9' }}>
                        {getWalkInName(activeInvoice.overrideJustification)} {getWalkInPhone(activeInvoice.overrideJustification) && `(${getWalkInPhone(activeInvoice.overrideJustification)})`}
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Status</div>
                    <span className={`status-pill status-pill-${activeInvoice.status.toLowerCase()}`} style={{ marginTop: 2, display: 'inline-block' }}>
                      {activeInvoice.status}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Date</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{new Date(activeInvoice.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Final Net Amount</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0EA5E9', fontFamily: 'monospace' }}>Rs. {activeInvoice.netAmount.toLocaleString()}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ background: '#F1F5F9', borderRadius: 12, padding: 12, border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    <span>Payment Progress</span>
                    <span>{percentPaid}% ({orderPaid.toLocaleString()} / {activeInvoice.netAmount.toLocaleString()})</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${percentPaid}%`, height: '100%', background: 'linear-gradient(90deg, #10B981, #34D399)', borderRadius: 99 }} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Itemized Sales Lines</div>
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead style={{ background: '#F8FAFC' }}>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Item</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#475569' }}>Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Rate</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeInvoice.items && activeInvoice.items.length > 0 ? (
                          activeInvoice.items.map(item => (
                            <tr key={item.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                              <td style={{ padding: '8px 12px', color: '#1E293B', fontWeight: 600 }}>{item.product.name}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace' }}>{item.quantity}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>Rs. {item.pricePerUnit}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>Rs. {(item.quantity * item.pricePerUnit).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: 12, textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>No item lines loaded.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Settle Action inside detail modal */}
                {orderRemaining > 0 && (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifySelf: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#C2410C', textTransform: 'uppercase' }}>Record Settlement Payment</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#EA580C' }}>Due: Rs. {orderRemaining.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        type="number" 
                        placeholder="Enter payment amount" 
                        value={settleAmount} 
                        onChange={e => setSettleAmount(e.target.value)} 
                        className="input-crisp" 
                        style={{ flex: 1, fontSize: 12 }} 
                      />
                      <button 
                        onClick={() => handleSettleSubmit(activeInvoice.id, activeInvoice.netAmount)}
                        className="btn-primary" 
                        style={{ background: '#10B981', padding: '10px 20px', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}
                      >
                        Settle Payment
                      </button>
                    </div>
                  </div>
                )}

                {/* Payment Logs List */}
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>Payment Ledger Timeline</div>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 12, maxHeight: 150, overflowY: 'auto' }}>
                    {verifiedSettlements.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {verifiedSettlements.map((log: any, idx: number) => (
                          <div key={log.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                            <div>
                              <span style={{ color: '#64748B' }}>{new Date(log.createdAt || log.date).toLocaleString()}</span>
                              {log.method && <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>{log.method}</div>}
                            </div>
                            <span style={{ fontWeight: 800, color: '#059669' }}>+ Rs. {(log.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 11, padding: 12, fontStyle: 'italic' }}>
                        No payments logged for this invoice.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button 
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                        <head>
                          <title>Invoice - ${activeInvoice.id}</title>
                          <style>
                            body { font-family: monospace; padding: 40px; }
                            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                            th, td { border: 1px solid black; padding: 8px; text-align: left; }
                            .header { text-align: center; margin-bottom: 30px; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <h1>SALES INVOICE</h1>
                            <p>Invoice ID: ORD-${activeInvoice.id.toUpperCase()}</p>
                            <p>Date: ${new Date(activeInvoice.createdAt).toLocaleString()}</p>
                          </div>
                          <hr/>
                          <h3>Items:</h3>
                          <table>
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Rate</th>
                                <th>Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${(activeInvoice.items || []).map(item => `
                                <tr>
                                  <td>${item.product.name}</td>
                                  <td>${item.quantity}</td>
                                  <td>Rs. ${item.pricePerUnit}</td>
                                  <td>Rs. ${(item.quantity * item.pricePerUnit).toLocaleString()}</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                          <div style="text-align: right; margin-top: 20px;">
                            <p><strong>Total Amount: Rs. ${activeInvoice.netAmount.toLocaleString()}</strong></p>
                            <p>Paid Amount: Rs. ${orderPaid.toLocaleString()}</p>
                            <p>Remaining: Rs. ${orderRemaining.toLocaleString()}</p>
                          </div>
                          <script>window.print();</script>
                        </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }}
                  className="btn-ghost" 
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Receipt style={{ width: 14, height: 14 }} /> Print Invoice
                </button>
                <button 
                  onClick={() => setActiveInvoice(null)} 
                  className="btn-primary" 
                  style={{ background: '#475569' }}
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
