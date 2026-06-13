'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Plus, User, Mail, Phone, Calendar, X,
  AlertCircle, ChevronRight, Hash, Clock, Users,
  RefreshCw, Receipt, ShoppingBag
} from 'lucide-react';

interface Customer {
  id: string;
  email: string;
  fullName?: string | null;
  createdAt: string;
}

interface CustomersClientProps {
  initialCustomers: Customer[];
}

const getInitials = (name: string | null | undefined, email: string) => {
  if (name) return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  return email.substring(0, 2).toUpperCase();
};

const AVATAR_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#06B6D4', '#84CC16'];

export default function CustomersClient({ initialCustomers }: CustomersClientProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [searchQuery, setSearchQuery]   = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading]       = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setShowAddModal(false); setSelectedCustomer(null); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); setShowAddModal(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/retailer/customers');
      const data = await res.json();
      if (data.success) setCustomers(data.customers);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName || !email) { setError('Name and email are required.'); return; }
    try {
      setSubmitting(true);
      const res  = await fetch('/api/retailer/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowAddModal(false);
        setFullName(''); setEmail(''); setPhone('');
        fetchCustomers();
      } else {
        setError(data.error || 'Failed to register patient');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = customers.filter((c) =>
    (c.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const thisMonthCount = customers.filter(c => {
    const d = new Date(c.createdAt);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#1E293B', margin: 0 }}>Patient Directory</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            Registered B2C retail customers &nbsp;
            <span style={{ fontSize: 11, color: '#94A3B8' }}>[ / ] Search · [ Ctrl+N ] Add</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={fetchCustomers}
            style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ background: '#F59E0B', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
          >
            <Plus style={{ width: 15, height: 15 }} />
            Register Patient
          </button>
        </div>
      </div>

      {/* ── Summary pills ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {[
          { icon: Users, label: 'Total Patients', val: customers.length, color: '#3B82F6', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)' },
          { icon: Clock, label: 'Registered This Month', val: thisMonthCount, color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
          { icon: Search, label: 'Matching Query', val: filtered.length, color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <Icon style={{ width: 18, height: 18, color: s.color }} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginTop: 1 }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Search ── */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: '#FFFFFF', borderRadius: 12, border: '1.5px solid #F1F5F9' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <Search style={{ width: 14, height: 14, color: '#94A3B8' }} />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by name or email address…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 12, color: '#334155' }}
          />
        </div>
      </div>

      {/* ── Patient Grid (Card-based) ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94A3B8' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Users style={{ width: 48, height: 48, color: '#E2E8F0' }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>No patients found</div>
          <div style={{ fontSize: 12 }}>Register a new patient or adjust your search</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map((c, idx) => {
            const initials = getInitials(c.fullName, c.email);
            const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCustomer(c)}
                style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #F1F5F9',
                  borderRadius: 16,
                  padding: 20,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.borderColor = avatarColor;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${avatarColor}20`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                  (e.currentTarget as HTMLElement).style.borderColor = '#F1F5F9';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${avatarColor}15`, border: `2px solid ${avatarColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: avatarColor }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#1E293B', fontSize: 14 }}>{c.fullName || 'Unnamed Patient'}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail style={{ width: 10, height: 10 }} />
                        {c.email}
                      </div>
                    </div>
                  </div>
                  <ChevronRight style={{ width: 16, height: 16, color: '#CBD5E1' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #F8FAFC' }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar style={{ width: 10, height: 10 }} />
                    {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: avatarColor, background: `${avatarColor}10`, padding: '2px 8px', borderRadius: 20 }}>
                    REGISTERED
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Patient Detail Modal ── */}
      {selectedCustomer && (() => {
        const initials = getInitials(selectedCustomer.fullName, selectedCustomer.email);
        const avatarColor = AVATAR_COLORS[customers.indexOf(selectedCustomer) % AVATAR_COLORS.length];
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 440, background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}>
              {/* Header */}
              <div style={{ padding: '24px', background: `linear-gradient(135deg, ${avatarColor}10, transparent)`, borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: `${avatarColor}15`, border: `2px solid ${avatarColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: avatarColor }}>
                    {initials}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1E293B', margin: 0 }}>{selectedCustomer.fullName || 'Unnamed Patient'}</h3>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Retail Pharmacy Patient</p>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomer(null)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
              {/* Body */}
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: Mail, label: 'Email', val: selectedCustomer.email },
                  { icon: Hash, label: 'Patient ID', val: selectedCustomer.id.substring(0, 12).toUpperCase(), mono: true },
                  { icon: Calendar, label: 'Registered On', val: new Date(selectedCustomer.createdAt).toLocaleString() },
                ].map((row) => {
                  const RowIcon = row.icon;
                  return (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: '#F8FAFC', borderRadius: 10 }}>
                      <RowIcon style={{ width: 16, height: 16, color: '#94A3B8', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{row.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', fontFamily: (row as any).mono ? 'monospace' : undefined }}>{row.val}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10 }}>
                <button onClick={() => setSelectedCustomer(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                  Close
                </button>
                <a
                  href={`/retailer/billing`}
                  style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none' }}
                >
                  <Receipt style={{ width: 14, height: 14 }} />
                  View Invoices
                </a>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Add Patient Modal ── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form
            onSubmit={handleAddCustomer}
            style={{ width: '100%', maxWidth: 420, background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #F1F5F9', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}
          >
            <div style={{ padding: '22px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User style={{ width: 18, height: 18, color: '#F59E0B' }} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0 }}>Register New Patient</h3>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 12, fontWeight: 600 }}>
                  <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {[
                { icon: User, label: 'Full Name', type: 'text', placeholder: 'e.g. Alice Johnson', val: fullName, set: setFullName, required: true },
                { icon: Mail, label: 'Email Address', type: 'email', placeholder: 'e.g. alice@email.com', val: email, set: setEmail, required: true },
              ].map((f) => {
                const FIcon = f.icon;
                return (
                  <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FIcon style={{ width: 10, height: 10 }} />{f.label}
                      {f.required && <span style={{ color: '#EF4444' }}>*</span>}
                    </label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      required={f.required}
                      style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, transition: 'border-color 0.15s' }}
                      onFocus={(e) => e.target.style.borderColor = '#F59E0B'}
                      onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFFFFF', color: '#475569' }}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: '#F59E0B', color: '#FFFFFF', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Registering…' : 'Register Patient'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
