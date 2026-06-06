'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Search, ChevronRight, ShoppingBag, CreditCard, Mail, Phone, 
  MapPin, Calendar, Receipt, TrendingUp, Info, Plus, X, UserPlus, CheckCircle, AlertCircle, FileText
} from 'lucide-react';
import { useSSEListener } from '@/hooks/useRealtimeData';
import { useRouter, useSearchParams } from 'next/navigation';

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
  items?: OrderItem[];
}

interface Customer {
  id: string;
  pharmacyName: string;
  registrationNumber: string;
  address: string;
  phone: string;
  creditLimit: number;
  lifetimeSpend: number;
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
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(searchParams.get('id') || null);

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

  // Settle amounts local dictionary
  const [settlements, setSettlements] = useState<Record<string, number>>({});
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
    if (initialCustomers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(initialCustomers[0].id);
    }
    
    // Load local storage payments mapping
    const storedPayments = localStorage.getItem('medhub_order_payments');
    if (storedPayments) {
      setSettlements(JSON.parse(storedPayments));
    }
  }, [initialCustomers]);

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

  const handleSettleSubmit = (orderId: string, totalAmount: number) => {
    const currentPaid = settlements[orderId] || 0;
    const inputPaid = parseFloat(settleAmount) || 0;
    const finalPaid = Math.min(currentPaid + inputPaid, totalAmount);
    
    const updated = { ...settlements, [orderId]: finalPaid };
    setSettlements(updated);
    localStorage.setItem('medhub_order_payments', JSON.stringify(updated));
    setSettleAmount('');
    setSettlingOrderId(null);
  };

  const filteredCustomers = customers.filter(c => 
    c.pharmacyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || filteredCustomers[0];

  // Calculate statements balances
  const calculateCustomerBalance = (customer: Customer) => {
    if (!customer) return { totalPaid: 0, totalPending: 0 };
    let totalPaid = 0;
    let totalPending = 0;
    customer.orders.forEach(o => {
      const paid = settlements[o.id] || 0;
      totalPaid += paid;
      totalPending += Math.max(o.netAmount - paid, 0);
    });
    return { totalPaid, totalPending };
  };

  const { totalPaid, totalPending } = selectedCustomer ? calculateCustomerBalance(selectedCustomer) : { totalPaid: 0, totalPending: 0 };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(186,230,253,0.5)', borderRadius: 20, padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.07)' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users style={{ width: 22, height: 22, color: '#F97316' }} />
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

      {/* Main Grid Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left Side: Customer List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Search bar */}
          <div className="filter-bar" style={{ padding: '10px 14px' }}>
            <div className="filter-field" style={{ minWidth: 'unset' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid rgba(186,230,253,0.6)', borderRadius: 8, padding: '6px 12px', width: '100%' }}>
                <Search style={{ width: 14, height: 14, color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Filter by pharmacy name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: 12, width: '100%', color: '#1E293B' }}
                />
              </div>
            </div>
          </div>

          {/* List Wrapper */}
          <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 10, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '65vh', overflowY: 'auto' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 12, fontStyle: 'italic' }}>
                No customers found matching search.
              </div>
            ) : (
              filteredCustomers.map(c => {
                const isSelected = selectedCustomer?.id === c.id;
                const { totalPending: pendingVal } = calculateCustomerBalance(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
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

        {/* Right Side: Customer Details & Statement */}
        <div>
          {selectedCustomer ? (
            <div className="space-y-6">
              {/* Profile Overview Card */}
              <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: '1px solid #F1F5F9', paddingBottom: 18, marginBottom: 20 }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B' }}>{selectedCustomer.pharmacyName}</h2>
                    <p style={{ fontSize: 12, color: '#64748B', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mail style={{ width: 12, height: 12 }} /> {selectedCustomer.user.email}
                      <span style={{ color: '#CBD5E1' }}>|</span>
                      <Phone style={{ width: 12, height: 12 }} /> {selectedCustomer.phone}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '8px 14px', textAlign: 'right' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>B2B Statement</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#C2410C', marginTop: 2 }}>
                        Paid: Rs. {totalPaid.toLocaleString()} | Due: Rs. {totalPending.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: '8px 14px', textAlign: 'right' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>B2B Loyalty Tier</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0369A1', marginTop: 2 }}>
                        Rs. {selectedCustomer.lifetimeSpend.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Fields Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Registration Number</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginTop: 4, fontFamily: 'monospace' }}>{selectedCustomer.registrationNumber}</div>
                  </div>

                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Contact Person</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginTop: 4 }}>{selectedCustomer.user.fullName || 'N/A'}</div>
                  </div>

                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, border: '1px solid #E2E8F0', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin style={{ width: 10, height: 10 }} /> Dispatch Address
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginTop: 4 }}>{selectedCustomer.address}</div>
                  </div>
                </div>
              </div>

              {/* Transactions Statement Ledger */}
              <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Receipt style={{ width: 14, height: 14, color: '#F97316' }} />
                  <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B' }}>
                    Statement of Transactions
                  </h3>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order Date</th>
                        <th>Order ID / Invoice</th>
                        <th>Gross Amt</th>
                        <th>Paid Amt</th>
                        <th>Remaining</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomer.orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>
                            No transactions on record for this customer.
                          </td>
                        </tr>
                      ) : (
                        selectedCustomer.orders.map(o => {
                          const orderPaid = settlements[o.id] || 0;
                          const orderRemaining = Math.max(o.netAmount - orderPaid, 0);
                          return (
                            <tr key={o.id}>
                              <td style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                                {new Date(o.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </td>
                              <td>
                                <button 
                                  onClick={() => setActiveInvoice(o)}
                                  style={{ background: 'none', border: 'none', color: '#0EA5E9', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                                >
                                  {o.id.toUpperCase().substring(0, 12)}
                                </button>
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                Rs. {o.netAmount.toLocaleString()}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#059669' }}>
                                Rs. {orderPaid.toLocaleString()}
                              </td>
                              <td style={{ fontFamily: 'monospace', fontSize: 11, color: orderRemaining > 0 ? '#DC2626' : '#64748B' }}>
                                Rs. {orderRemaining.toLocaleString()}
                              </td>
                              <td>
                                <span className={`status-pill status-pill-${o.status.toLowerCase()}`}>
                                  {o.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {orderRemaining > 0 ? (
                                  <div>
                                    {settlingOrderId === o.id ? (
                                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                        <input 
                                          type="number" placeholder="Amt" value={settleAmount} 
                                          onChange={e => setSettleAmount(e.target.value)} 
                                          style={{ width: 60, fontSize: 10, padding: 4, border: '1px solid #E2E8F0', borderRadius: 4 }} 
                                        />
                                        <button 
                                          onClick={() => handleSettleSubmit(o.id, o.netAmount)}
                                          style={{ padding: '4px 8px', fontSize: 9, background: '#10B981', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                                        >
                                          Pay
                                        </button>
                                      </div>
                                    ) : (
                                      <button 
                                        onClick={() => setSettlingOrderId(o.id)}
                                        style={{ background: 'none', border: 'none', color: '#0EA5E9', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                      >
                                        Settle
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Settled</span>
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
            <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Users style={{ width: 32, height: 32, color: '#94A3B8' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#64748B' }}>No customer selected</div>
              <p style={{ fontSize: 12, color: '#94A3B8', maxWidth: 280 }}>Select a retailer from the directory list on the left to inspect their transaction ledger.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="animate-scaleIn" style={{ background: 'rgba(255,255,255,0.97)', border: '1.5px solid rgba(186,230,253,0.6)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(14,165,233,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 20 }}>
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
      )}

      {/* Bill ID detailed popup modal */}
      {activeInvoice && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="animate-scaleIn" style={{ background: 'white', border: '1.5px solid #BAE6FD', borderRadius: 24, padding: 28, width: '100%', maxWidth: 540, boxShadow: '0 24px 64px rgba(14,165,233,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText style={{ width: 18, height: 18, color: '#0EA5E9' }} /> Sales Invoice Details
                </h3>
                <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Full transaction logs and itemized ledger updates</p>
              </div>
              <button onClick={() => setActiveInvoice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#F8FAFC', padding: 12, borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Invoice ID</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', fontFamily: 'monospace' }}>ORD-{activeInvoice.id.toUpperCase()}</div>
                </div>
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
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0EA5E9', fontFamily: 'monospace' }}>Rs. {activeInvoice.netAmount.toLocaleString()}</div>
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
                            <td style={{ padding: '8px 12px', color: '#1E293B' }}>{item.product.name}</td>
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button 
                onClick={() => setActiveInvoice(null)} 
                className="btn-primary" 
                style={{ background: '#475569', padding: '8px 16px' }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
