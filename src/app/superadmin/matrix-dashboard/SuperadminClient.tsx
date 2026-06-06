'use client';

import React, { useState } from 'react';
import { 
  Users, Building, ShieldAlert, ArrowRight, ShieldCheck, 
  Activity, LogOut, Search, Eye, Edit3, Key, RefreshCw, 
  CheckCircle, AlertCircle, X, Check, Globe
} from 'lucide-react';

interface Profile {
  id: string;
  companyName?: string;
  taxId?: string;
  pharmacyName?: string;
  registrationNumber?: string;
  clinicName?: string;
  licenseNumber?: string;
  address?: string;
  phone?: string;
  latitude?: number | null;
  longitude?: number | null;
  customFieldsJson?: string | null;
}

interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  subscriptionStart: string;
  subscriptionEnd: string;
  isActive: boolean;
  createdAt: string;
  wholesalerProfile?: Profile | null;
  retailerProfile?: Profile | null;
  clinicProfile?: Profile | null;
  fullName?: string | null;
  wholesalerId?: string | null;
  allowedFeatures: string;
  packageName: string;
  packagePrice: number;
  plainPassword?: string | null;
}

interface AuditLog {
  id: string;
  action: string;
  userId: string | null;
  details: string;
  timestamp: string;
  user?: {
    email: string;
    fullName?: string | null;
    role: string;
  } | null;
}

interface SuperadminClientProps {
  initialUsers: User[];
  initialLogs: AuditLog[];
}

export default function SuperadminClient({ initialUsers, initialLogs }: SuperadminClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null);
  const [selectedUserForPlan, setSelectedUserForPlan] = useState<User | null>(null);
  const [generatedTempPassword, setGeneratedTempPassword] = useState<{ email: string; pass: string } | null>(null);

  // Update Plan Form State
  const [packageName, setPackageName] = useState('');
  const [packagePrice, setPackagePrice] = useState('0');
  const [subscriptionEnd, setSubscriptionEnd] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>([]);

  const availableFeatures = ['Dashboard', 'Medicines', 'Orders', 'Billing', 'POS', 'Profile', 'Logs'];

  // Handle plan update modal trigger
  const triggerPlanUpdate = (user: User) => {
    setSelectedUserForPlan(user);
    setPackageName(user.packageName || 'Free Plan');
    setPackagePrice(String(user.packagePrice || 0));
    setSubscriptionEnd(new Date(user.subscriptionEnd).toISOString().split('T')[0]);
    setIsActive(user.isActive);
    setAllowedFeatures(user.allowedFeatures ? user.allowedFeatures.split(',') : availableFeatures);
  };

  // Submit plan updates
  const handleUpdatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPlan) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/superadmin/user/${selectedUserForPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName,
          packagePrice: parseFloat(packagePrice) || 0,
          subscriptionEnd: new Date(subscriptionEnd).toISOString(),
          isActive,
          allowedFeatures,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update plan.');

      setSuccessMsg(`Plan and status updated successfully for ${selectedUserForPlan.email}`);
      
      // Update state
      setUsers(users.map(u => u.id === selectedUserForPlan.id ? { 
        ...u, 
        packageName,
        packagePrice: parseFloat(packagePrice) || 0,
        subscriptionEnd: new Date(subscriptionEnd).toISOString(),
        isActive,
        allowedFeatures: allowedFeatures.join(','),
      } : u));

      setSelectedUserForPlan(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Submit password reset
  const handleResetPassword = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to force password reset for ${email}?`)) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setGeneratedTempPassword(null);

    try {
      const res = await fetch(`/api/superadmin/user/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password.');

      setGeneratedTempPassword({ email, pass: data.tempPassword });
      setSuccessMsg(`Password reset triggered successfully.`);
      
      // Update locally hashed password to trigger state refresh
      setUsers(users.map(u => u.id === userId ? { 
        ...u, 
        passwordHash: data.user.passwordHash,
        plainPassword: data.tempPassword,
      } : u));
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on unified search bar
  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    // Search matches: id, email, role, packageName, fullName
    if (user.id.toLowerCase().includes(q)) return true;
    if (user.email.toLowerCase().includes(q)) return true;
    if (user.role.toLowerCase().includes(q)) return true;
    if (user.packageName.toLowerCase().includes(q)) return true;
    if (user.fullName && user.fullName.toLowerCase().includes(q)) return true;

    // Profile searches
    if (user.wholesalerProfile) {
      const p = user.wholesalerProfile;
      if (p.companyName && p.companyName.toLowerCase().includes(q)) return true;
      if (p.taxId && p.taxId.toLowerCase().includes(q)) return true;
      if (p.address && p.address.toLowerCase().includes(q)) return true;
      if (p.phone && p.phone.toLowerCase().includes(q)) return true;
    }
    if (user.retailerProfile) {
      const p = user.retailerProfile;
      if (p.pharmacyName && p.pharmacyName.toLowerCase().includes(q)) return true;
      if (p.registrationNumber && p.registrationNumber.toLowerCase().includes(q)) return true;
      if (p.address && p.address.toLowerCase().includes(q)) return true;
      if (p.phone && p.phone.toLowerCase().includes(q)) return true;
    }
    if (user.clinicProfile) {
      const p = user.clinicProfile;
      if (p.clinicName && p.clinicName.toLowerCase().includes(q)) return true;
      if (p.licenseNumber && p.licenseNumber.toLowerCase().includes(q)) return true;
      if (p.address && p.address.toLowerCase().includes(q)) return true;
      if (p.phone && p.phone.toLowerCase().includes(q)) return true;
    }

    return false;
  });

  const now = new Date();

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* ── Page Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F2744 100%)',
        borderRadius: 20, padding: '24px 28px', position: 'relative', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(15,23,42,0.35)',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 50%, rgba(99,102,241,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck style={{ width: 18, height: 18, color: '#818CF8' }} />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>Matrix Control Dashboard</h1>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>Superadmin — All partner nodes, lease plans, and access control</p>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Total Nodes', value: users.length, color: '#818CF8' },
              { label: 'Active', value: users.filter(u => u.isActive).length, color: '#34D399' },
              { label: 'Expired', value: users.filter(u => new Date(u.subscriptionEnd) < new Date()).length, color: '#F87171' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 16px', textAlign: 'center', minWidth: 72 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: stat.color, fontFamily: 'monospace', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Alerts ── */}
      {error && <div className="alert alert-error"><AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} /><span>{error}</span></div>}
      {successMsg && <div className="alert alert-success"><CheckCircle style={{ width: 14, height: 14, flexShrink: 0 }} /><span>{successMsg}</span></div>}

      {/* ── Temp Password Banner ── */}
      {generatedTempPassword && (
        <div style={{ background: 'linear-gradient(135deg, #4C1D95, #2D3748)', border: '1.5px solid rgba(167,139,250,0.4)', borderRadius: 16, padding: '16px 20px', position: 'relative', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Key style={{ width: 18, height: 18, color: '#A78BFA', flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#C4B5FD', marginBottom: 4 }}>Temporary Access Passcode Generated</div>
            <div style={{ fontSize: 12, color: 'white', marginBottom: 4 }}>User: <strong style={{ fontFamily: 'monospace' }}>{generatedTempPassword.email}</strong></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Passcode:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 16, color: '#A78BFA', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', padding: '4px 14px', borderRadius: 8 }}>{generatedTempPassword.pass}</span>
            </div>
          </div>
          <button onClick={() => setGeneratedTempPassword(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {/* ── Search Bar ── */}
      <div style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #E2E8F0', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Search style={{ width: 16, height: 16, color: '#6366F1', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search by name, email, role, VAT ID, pharmacy name, address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: '#1E293B' }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')}
            style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', background: '#F1F5F9', border: 'none', cursor: 'pointer', padding: '3px 10px', borderRadius: 6 }}>
            Clear
          </button>
        )}
        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: '#94A3B8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {filteredUsers.length} / {users.length} Nodes
        </span>
      </div>

      {/* ── Registry Table ── */}
      <div style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #E2E8F0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User / Email</th>
                <th>Role</th>
                <th>Lease Plan</th>
                <th>Annual Fee</th>
                <th>Coordinates</th>
                <th>Lease Expiry</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontFamily: 'monospace', fontSize: 11 }}>
                    NO NODE MATCHING "{searchQuery.toUpperCase()}" FOUND IN REGISTRY.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const diffDays = Math.ceil((new Date(user.subscriptionEnd).getTime() - now.getTime()) / 86400000);
                  const daysLeft = Math.max(0, diffDays);
                  const isExpired = daysLeft === 0;

                  let gpsCoords = '—';
                  const profile = user.wholesalerProfile || user.retailerProfile;
                  if (profile && typeof profile.latitude === 'number' && typeof profile.longitude === 'number') {
                    gpsCoords = `[${profile.latitude.toFixed(3)}, ${profile.longitude.toFixed(3)}]`;
                  }

                  const roleMap: Record<string, { bg: string; color: string; border: string; label: string }> = {
                    SUPERADMIN:       { bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3', label: 'Superadmin' },
                    WHOLESALER:       { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE', label: 'Distributor' },
                    WHOLESALER_STAFF: { bg: '#FDF4FF', color: '#7C3AED', border: '#E9D5FF', label: 'Staff' },
                    RETAILER:         { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', label: 'Retailer' },
                  };
                  const role = roleMap[user.role] || { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0', label: user.role };

                  return (
                    <tr key={user.id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#1E293B' }}>{user.email}</div>
                        {(user.wholesalerProfile?.companyName || user.retailerProfile?.pharmacyName) && (
                          <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
                            {user.wholesalerProfile?.companyName || user.retailerProfile?.pharmacyName}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'monospace', background: role.bg, color: role.color, border: `1px solid ${role.border}`, padding: '3px 10px', borderRadius: 20 }}>
                          {role.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#1E293B' }}>{user.packageName}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>{daysLeft}d remaining</div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1E293B', fontSize: 12 }}>
                          Rs. {user.packagePrice.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: gpsCoords === '—' ? '#CBD5E1' : '#475569' }}>{gpsCoords}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: isExpired ? '#DC2626' : '#059669' }}>
                          {new Date(user.subscriptionEnd).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                            background: user.isActive ? '#10B981' : '#CBD5E1',
                            boxShadow: user.isActive ? '0 0 8px rgba(16,185,129,0.5)' : 'none'
                          }} title={user.isActive ? 'Active' : 'Deactivated'} />
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setSelectedUserForDetails(user)}
                            style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'white', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
                            title="Inspect">
                            <Eye style={{ width: 11, height: 11 }} /> View
                          </button>
                          {user.role !== 'SUPERADMIN' && (
                            <>
                              <button onClick={() => triggerPlanUpdate(user)}
                                style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderRadius: 8, border: '1.5px solid #DDD6FE', background: '#F5F3FF', color: '#6D28D9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
                                title="Edit Plan">
                                <Edit3 style={{ width: 11, height: 11 }} /> Plan
                              </button>
                              <button onClick={() => handleResetPassword(user.id, user.email)}
                                style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', borderRadius: 8, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
                                title="Reset Password">
                                <Key style={{ width: 11, height: 11 }} /> Reset
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL 1: Account Details ── */}
      {selectedUserForDetails && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 20, padding: 28, width: '100%', maxWidth: 720, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>Node Diagnostics</h3>
                <p style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>ID: {selectedUserForDetails.id}</p>
              </div>
              <button onClick={() => setSelectedUserForDetails(null)}
                style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                Close ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.07em', marginBottom: 10 }}>Account Credentials</div>
                {[
                  ['Email', selectedUserForDetails.email],
                  ['Role', selectedUserForDetails.role],
                  ['Package', selectedUserForDetails.packageName],
                  ['Expiry', new Date(selectedUserForDetails.subscriptionEnd).toLocaleDateString()],
                  ['Features', selectedUserForDetails.allowedFeatures || 'N/A'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11 }}>
                    <span style={{ color: '#94A3B8', fontWeight: 700, width: 70, flexShrink: 0 }}>{k}:</span>
                    <span style={{ color: '#1E293B', fontFamily: 'monospace', wordBreak: 'break-all' }}>{v}</span>
                  </div>
                ))}
                {selectedUserForDetails.plainPassword && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 10, fontSize: 11, color: '#7C3AED', fontFamily: 'monospace', fontWeight: 700 }}>
                    Temp Password: {selectedUserForDetails.plainPassword}
                  </div>
                )}
              </div>

              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748B', letterSpacing: '0.07em', marginBottom: 10 }}>Profile Registry</div>
                {selectedUserForDetails.wholesalerProfile && (
                  <>
                    {[
                      ['Company', selectedUserForDetails.wholesalerProfile.companyName],
                      ['VAT ID', selectedUserForDetails.wholesalerProfile.taxId],
                      ['Address', selectedUserForDetails.wholesalerProfile.address],
                      ['Phone', selectedUserForDetails.wholesalerProfile.phone],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 700, width: 60, flexShrink: 0 }}>{k}:</span>
                        <span style={{ color: '#1E293B', fontFamily: 'monospace' }}>{v || '—'}</span>
                      </div>
                    ))}
                  </>
                )}
                {selectedUserForDetails.retailerProfile && (
                  <>
                    {[
                      ['Pharmacy', selectedUserForDetails.retailerProfile.pharmacyName],
                      ['Reg No', selectedUserForDetails.retailerProfile.registrationNumber],
                      ['Address', selectedUserForDetails.retailerProfile.address],
                      ['Phone', selectedUserForDetails.retailerProfile.phone],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 11 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 700, width: 60, flexShrink: 0 }}>{k}:</span>
                        <span style={{ color: '#1E293B', fontFamily: 'monospace' }}>{v || '—'}</span>
                      </div>
                    ))}
                  </>
                )}
                {!selectedUserForDetails.wholesalerProfile && !selectedUserForDetails.retailerProfile && !selectedUserForDetails.clinicProfile && (
                  <p style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>No companion profile struct — staff or superadmin account.</p>
                )}
              </div>
            </div>

            {/* Audit Logs */}
            <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity style={{ width: 13, height: 13, color: '#6366F1' }} />
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B' }}>Audit Trail</span>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: 11 }}>
                  <thead><tr><th>Timestamp</th><th>Action</th><th>Details</th></tr></thead>
                  <tbody>
                    {logs.filter(l => l.userId === selectedUserForDetails.id).length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', padding: '20px' }}>No audit logs for this node.</td></tr>
                    ) : (
                      logs.filter(l => l.userId === selectedUserForDetails.id).map(log => (
                        <tr key={log.id}>
                          <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>{new Date(log.timestamp).toLocaleString()}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#6366F1', fontSize: 10 }}>{log.action}</td>
                          <td style={{ color: '#475569' }}>{log.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Update Plan ── */}
      {selectedUserForPlan && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'white', border: '1.5px solid #E2E8F0', borderRadius: 20, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1E293B', marginBottom: 4 }}>Update Lease Plan</h3>
                <p style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>{selectedUserForPlan.email}</p>
              </div>
              <button onClick={() => setSelectedUserForPlan(null)}
                style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#64748B' }}>
                Cancel
              </button>
            </div>

            <form onSubmit={handleUpdatePlanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>Package Name</label>
                  <input type="text" required value={packageName} onChange={e => setPackageName(e.target.value)}
                    placeholder="e.g. Gold Enterprise" className="input-crisp" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>Annual Fee (Rs.)</label>
                  <input type="number" required min="0" value={packagePrice} onChange={e => setPackagePrice(e.target.value)}
                    className="input-crisp" style={{ width: '100%', fontFamily: 'monospace' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>Lease Expiry Date</label>
                  <input type="date" required value={subscriptionEnd} onChange={e => setSubscriptionEnd(e.target.value)}
                    className="input-crisp" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 6 }}>Account Status</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569' }}>
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#6366F1' }} />
                    Active Lease
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: 8 }}>Feature Access</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {availableFeatures.map(feat => {
                    const isChecked = allowedFeatures.includes(feat);
                    return (
                      <label key={feat} style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                        background: isChecked ? '#EEF2FF' : '#F8FAFC', border: `1.5px solid ${isChecked ? '#A5B4FC' : '#E2E8F0'}`, color: isChecked ? '#4338CA' : '#64748B',
                        transition: 'all 0.15s',
                      }}>
                        <input type="checkbox" checked={isChecked}
                          onChange={e => e.target.checked ? setAllowedFeatures([...allowedFeatures, feat]) : setAllowedFeatures(allowedFeatures.filter(f => f !== feat))}
                          style={{ width: 14, height: 14, accentColor: '#6366F1' }} />
                        {feat}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button type="submit" disabled={loading}
                  style={{ flex: 1, padding: '13px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6366F1, #0EA5E9)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading && <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" />}
                  Commit Lease Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
