'use client';

import React, { useState, useEffect } from 'react';
import {
  Building, Calendar, Clock, ShieldCheck, Save,
  AlertCircle, CheckCircle, Search, Trash2, Plus, Settings,
  User, ShieldAlert, Edit2, Lock, Eye, EyeOff, X, MapPin, Navigation
} from 'lucide-react';
import { useRealtimeEvent, broadcastUpdate } from '@/lib/events';

interface RetailerProfile {
  id: string;
  userId: string;
  pharmacyName: string;
  registrationNumber: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  creditLimit: number;
  lifetimeSpend: number;
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  user: {
    email: string;
    fullName?: string | null;
    role: string;
  } | null;
}

interface StaffUser {
  id: string;
  email: string;
  fullName?: string | null;
  allowedFeatures: string;
  isActive: boolean;
  createdAt: string;
  plainPassword?: string | null;
}

interface SettingsClientProps {
  initialProfile: RetailerProfile;
  subscriptionEnd: string;
  initialLogs: AuditLog[];
  initialStaff: StaffUser[];
}

const AVAILABLE_FEATURES = ['Dashboard', 'Inventory', 'Orders', 'Suppliers', 'POS', 'Billing', 'Settings'];

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid var(--card-border)',
  outline: 'none',
  fontSize: 14,
  width: '100%',
  background: 'var(--card-bg)',
  color: 'var(--text-primary)',
  boxSizing: 'border-box' as const,
};

const btnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#F59E0B',
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  transition: 'background 0.15s',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  marginBottom: 6,
  display: 'block',
};

const thStyle: React.CSSProperties = {
  padding: '12px 18px',
  color: 'var(--text-muted)',
  fontWeight: 600,
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export default function SettingsClient({
  initialProfile,
  subscriptionEnd,
  initialLogs,
  initialStaff
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'staff' | 'security' | 'logs'>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile fields
  const [pharmacyName, setPharmacyName] = useState(initialProfile.pharmacyName);
  const [address, setAddress] = useState(initialProfile.address);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [latitude, setLatitude] = useState(String(initialProfile.latitude));
  const [longitude, setLongitude] = useState(String(initialProfile.longitude));

  // GPS capture state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');

  // Custom Fields
  const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showAddFieldForm, setShowAddFieldForm] = useState(false);

  // Theme Mode Settings
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
      setThemeMode(saved);
    }
  }, []);

  const handleToggleTheme = (mode: 'light' | 'dark') => {
    setThemeMode(mode);
    localStorage.setItem('theme', mode);
    if (mode === 'dark') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  // Font Scale Settings
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>('md');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('font_scale') as 'sm' | 'md' | 'lg' || 'md';
      setFontScale(saved);
    }
  }, []);

  const handleToggleFontScale = (scale: 'sm' | 'md' | 'lg') => {
    setFontScale(scale);
    localStorage.setItem('font_scale', scale);
    document.body.classList.remove('font-sm', 'font-md', 'font-lg');
    document.body.classList.add(`font-${scale}`);
  };

  // Security preferences
  const [inactivityTimeout, setInactivityTimeout] = useState('60');
  const [lowStockBoxes, setLowStockBoxes] = useState(10);
  const [lowStockStrips, setLowStockStrips] = useState(0);
  const [lowStockTablets, setLowStockTablets] = useState(0);
  const [expiryAlertDays, setExpiryAlertDays] = useState(30);

  // Logs state
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Staff Management state
  const [staffList, setStaffList] = useState<StaffUser[]>(initialStaff);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  
  // Staff form fields
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffFullName, setStaffFullName] = useState('');
  const [staffFeatures, setStaffFeatures] = useState<string[]>(AVAILABLE_FEATURES);
  const [staffIsActive, setStaffIsActive] = useState(true);

  // Fetch updates in realtime
  useRealtimeEvent('SETTINGS_UPDATE', () => { fetchLogs(); });
  useRealtimeEvent('STAFF_UPDATE', () => { fetchStaff(); fetchLogs(); });

  const fetchLogs = async () => {
    try {
      await fetch('/api/retailer/billing');
    } catch (e) {}
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/retailer/staff');
      const data = await res.json();
      if (data.success) {
        setStaffList(data.staff);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTimeout = localStorage.getItem('retailer_inactivity_timeout');
      if (storedTimeout) setInactivityTimeout(storedTimeout);

      const storedLowStockBoxes = localStorage.getItem('retailer_low_stock_boxes');
      if (storedLowStockBoxes) setLowStockBoxes(parseInt(storedLowStockBoxes, 10));

      const storedLowStockStrips = localStorage.getItem('retailer_low_stock_strips');
      if (storedLowStockStrips) setLowStockStrips(parseInt(storedLowStockStrips, 10));

      const storedLowStockTablets = localStorage.getItem('retailer_low_stock_tablets');
      if (storedLowStockTablets) setLowStockTablets(parseInt(storedLowStockTablets, 10));

      const storedExpiry = localStorage.getItem('retailer_expiry_alert_days');
      if (storedExpiry) setExpiryAlertDays(parseInt(storedExpiry, 10));

      const storedFields = localStorage.getItem(`retailer_custom_fields_${initialProfile.id}`);
      if (storedFields) {
        try { setCustomFields(JSON.parse(storedFields)); } catch (e) {}
      }

      // Check query parameter for active tab
      const params = new URLSearchParams(window.location.search);
      const tabVal = params.get('tab');
      if (tabVal) {
        if (tabVal === 'features' || tabVal === 'staff') {
          setActiveTab('staff');
        } else if (tabVal === 'logs') {
          setActiveTab('logs');
        } else if (tabVal === 'security') {
          setActiveTab('security');
        } else if (tabVal === 'profile') {
          setActiveTab('profile');
        }
      }
      
      const searchParam = params.get('search') || params.get('q');
      if (searchParam) {
        setSearchTerm(searchParam);
        setActiveTab('logs');
      }
    }
  }, [initialProfile.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/retailer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyName,
          address,
          phone,
          latitude: parseFloat(latitude) || 27.7172,
          longitude: parseFloat(longitude) || 85.3240,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

      setSuccessMsg('Pharmacy Profile updated successfully.');
      if (typeof window !== 'undefined') {
        localStorage.setItem(`retailer_custom_fields_${initialProfile.id}`, JSON.stringify(customFields));
      }
      broadcastUpdate('SETTINGS_UPDATE');
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecurity = (val: string) => {
    setInactivityTimeout(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('retailer_inactivity_timeout', val);
      setSuccessMsg(`Session inactivity timeout updated to ${val === 'never' ? 'Never' : `${val} minutes`}.`);
      broadcastUpdate('SETTINGS_UPDATE');
    }
  };

  const handleSaveAlerts = (boxes: number, strips: number, tablets: number, expiryDays: number) => {
    setLowStockBoxes(boxes);
    setLowStockStrips(strips);
    setLowStockTablets(tablets);
    setExpiryAlertDays(expiryDays);
    if (typeof window !== 'undefined') {
      localStorage.setItem('retailer_low_stock_boxes', boxes.toString());
      localStorage.setItem('retailer_low_stock_strips', strips.toString());
      localStorage.setItem('retailer_low_stock_tablets', tablets.toString());
      localStorage.setItem('retailer_expiry_alert_days', expiryDays.toString());
      setSuccessMsg('Alert and threshold settings updated.');
      broadcastUpdate('SETTINGS_UPDATE');
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    setCustomFields([...customFields, { label: newFieldLabel.trim(), value: newFieldValue.trim() }]);
    setNewFieldLabel('');
    setNewFieldValue('');
    setShowAddFieldForm(false);
  };

  const handleDeleteCustomField = (label: string) => {
    setCustomFields(customFields.filter((f) => f.label !== label));
  };

  const handleOpenCreateStaff = () => {
    setEditingStaff(null);
    setStaffEmail('');
    setStaffPassword('');
    setStaffFullName('');
    setStaffFeatures(AVAILABLE_FEATURES);
    setStaffIsActive(true);
    setError('');
    setSuccessMsg('');
    setShowStaffModal(true);
  };

  const handleOpenEditStaff = (emp: StaffUser) => {
    setEditingStaff(emp);
    setStaffEmail(emp.email);
    setStaffPassword('');
    setStaffFullName(emp.fullName || '');
    setStaffFeatures(emp.allowedFeatures.split(','));
    setStaffIsActive(emp.isActive);
    setError('');
    setSuccessMsg('');
    setShowStaffModal(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!staffEmail || !staffFullName || (!editingStaff && !staffPassword)) {
      setError('Please fill all required staff fields');
      return;
    }

    try {
      setLoading(true);
      const url = editingStaff ? `/api/retailer/staff/${editingStaff.id}` : '/api/retailer/staff';
      const method = editingStaff ? 'PUT' : 'POST';
      const payload: any = {
        email: staffEmail,
        fullName: staffFullName,
        allowedFeatures: staffFeatures.join(','),
        isActive: staffIsActive,
      };

      if (staffPassword) {
        payload.password = staffPassword;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save staff member');

      setSuccessMsg(editingStaff ? 'Employee credentials updated' : 'New employee registered successfully');
      setShowStaffModal(false);
      broadcastUpdate('STAFF_UPDATE');
    } catch (err: any) {
      setError(err.message || 'Error saving staff member');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely sure you want to delete employee: "${name}"?`)) return;
    try {
      const res = await fetch(`/api/retailer/staff/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Account "${name}" deleted.`);
        broadcastUpdate('STAFF_UPDATE');
      } else {
        setError(data.error || 'Failed to delete account');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting account');
    }
  };

  const toggleFeature = (feature: string) => {
    setStaffFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user?.role || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter ? log.action === actionFilter : true;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

  const Modal = ({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) => (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100vh', width: '100%' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--card-border)', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Pharmacy Settings &amp; Configuration</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Configure profile details, manage shop employees, adjust alert thresholds, and audit activity logs.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px' }}>
          <Calendar style={{ width: 15, height: 15, color: '#F59E0B' }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Store lease End</div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: 1 }}>
              {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Tab Buttons (Clean, flat styling) */}
      <div style={{ display: 'flex', gap: 6, background: 'var(--table-header-bg)', padding: 4, borderRadius: 8, border: '1px solid var(--card-border)', flexWrap: 'wrap' }}>
        {([
          { id: 'profile', label: 'Store Profile' },
          { id: 'staff', label: `Staff Accounts (${staffList.length})` },
          { id: 'security', label: 'Security & Alert Thresholds' },
          { id: 'logs', label: 'Store Activity Logs' }
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === tab.id ? 'var(--card-bg)' : 'transparent',
              color: activeTab === tab.id ? '#F59E0B' : 'var(--text-secondary)',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, color: '#10B981', fontSize: 13, fontWeight: 600 }}>
          <CheckCircle style={{ width: 16, height: 16 }} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
          <AlertCircle style={{ width: 16, height: 16 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && (
        <form onSubmit={handleUpdateProfile} style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Pharmacy Store Name</label>
              <input type="text" value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Registration License Number</label>
              <input type="text" value={initialProfile.registrationNumber} disabled style={{ ...inputStyle, background: 'var(--table-header-bg)', cursor: 'not-allowed' }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Physical Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <label style={labelStyle}>Store Phone Contact</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>GPS Latitude Coordinate</label>
              <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>GPS Longitude Coordinate</label>
              <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} style={inputStyle} required />
            </div>
          </div>

          {/* GPS Auto-Detect */}
          <div style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <MapPin style={{ width: 18, height: 18, color: '#3B82F6' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Auto-Detect Coordinates</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {gpsMessage || 'Use browser GPS coordinates configuration to locate your pharmacy node.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={gpsLoading}
              onClick={() => {
                setGpsLoading(true);
                setGpsMessage('Detecting coordinate node location…');
                if (!navigator.geolocation) {
                  setGpsMessage('Geolocation is not supported by your browser.');
                  setGpsLoading(false);
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setLatitude(String(pos.coords.latitude));
                    setLongitude(String(pos.coords.longitude));
                    setGpsMessage(`✓ Captured: ${pos.coords.latitude.toFixed(5)}°N, ${pos.coords.longitude.toFixed(5)}°E`);
                    setGpsLoading(false);
                  },
                  (err) => {
                    setGpsMessage(`Error: ${err.message}. Ensure location permissions are active.`);
                    setGpsLoading(false);
                  },
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }}
              style={{ ...btnStyle, background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}
            >
              <Navigation style={{ width: 14, height: 14 }} /> Capture Node Location
            </button>
          </div>

          {/* Custom Fields */}
          <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
            <span style={labelStyle}>Dynamic Fields</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {customFields.map((field) => (
                <div key={field.label} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120 }}>{field.label}</span>
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomFields(customFields.map((f) => f.label === field.label ? { ...f, value: val } : f));
                    }}
                    style={inputStyle}
                  />
                  <button type="button" onClick={() => handleDeleteCustomField(field.label)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}>
                    <Trash2 style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              ))}
            </div>

            {showAddFieldForm ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <input type="text" placeholder="Field Label (e.g. VAT Reg)" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <input type="text" placeholder="Value detail" value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={handleAddCustomField} style={btnStyle}>Add Field</button>
                <button type="button" onClick={() => setShowAddFieldForm(false)} style={{ ...btnStyle, background: 'var(--table-header-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowAddFieldForm(true)} style={{ ...btnStyle, background: 'var(--table-header-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)', marginTop: 12 }}>
                <Plus style={{ width: 14, height: 14 }} /> Add Custom Field
              </button>
            )}
          </div>

          <button type="submit" disabled={loading} style={{ ...btnStyle, marginTop: 10 }}>
            <Save style={{ width: 14, height: 14 }} /> {loading ? 'Saving updates…' : 'Save Profile Settings'}
          </button>
        </form>
      )}

      {/* ── STAFF TAB ── */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Configure internal shop accounts allowed to process counter sales &amp; catalog inventory.</span>
            <button onClick={handleOpenCreateStaff} style={btnStyle}>
              <Plus style={{ width: 15, height: 15 }} /> Add Shop Employee
            </button>
          </div>

          <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
            {staffList.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No staff accounts registered yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={thStyle}>Full Name</th>
                    <th style={thStyle}>Login Username / Email</th>
                    <th style={thStyle}>Authorized Tabs</th>
                    <th style={thStyle}>Account Status</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((emp) => (
                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 700 }}>{emp.fullName}</td>
                      <td style={{ padding: '12px 18px', fontFamily: 'monospace' }}>{emp.email}</td>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {emp.allowedFeatures.split(',').map((f) => (
                            <span key={f} style={{ fontSize: 11, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', padding: '2px 6px', borderRadius: 4, fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: emp.isActive ? '#F0FDF4' : '#FEF2F2', color: emp.isActive ? '#10B981' : '#EF4444' }}>
                          {emp.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => handleOpenEditStaff(emp)} style={{ border: '1px solid var(--card-border)', background: 'var(--table-header-bg)', padding: 5, borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <Edit2 style={{ width: 13, height: 13 }} />
                          </button>
                          <button onClick={() => handleDeleteStaff(emp.id, emp.fullName || '')} style={{ border: '1.5px solid #FECACA', background: '#FEF2F2', padding: 5, borderRadius: 6, cursor: 'pointer', color: '#EF4444' }}>
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Appearance & Themes */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Interface Theme Mode</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Toggle theme styling context across retailer dash pages.</p>
            
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => handleToggleTheme('light')}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: themeMode === 'light' ? '2px solid #F59E0B' : '1px solid var(--card-border)', background: themeMode === 'light' ? '#FFFBEB' : 'var(--card-bg)', color: themeMode === 'light' ? '#D97706' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Light Theme
              </button>
              <button
                type="button"
                onClick={() => handleToggleTheme('dark')}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: themeMode === 'dark' ? '2px solid #F59E0B' : '1px solid var(--card-border)', background: themeMode === 'dark' ? '#1E293B' : 'var(--card-bg)', color: themeMode === 'dark' ? '#FFFFFF' : 'var(--text-secondary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                Dark Theme
              </button>
            </div>
          </div>

          {/* Timeout */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Client Inactivity Auto-Logout</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Auto-logout timer threshold to prevent unauthorized dashboard access.</p>
            <select
              value={inactivityTimeout}
              onChange={(e) => handleSaveSecurity(e.target.value)}
              style={{ ...inputStyle, marginTop: 12 }}
            >
              <option value="15">15 minutes of inactivity</option>
              <option value="30">30 minutes of inactivity</option>
              <option value="60">60 minutes of inactivity (Default)</option>
              <option value="120">120 minutes of inactivity</option>
              <option value="never">Never (Disabled)</option>
            </select>
          </div>

          {/* Alert Thresholds */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Inventory Low-Stock Warning Thresholds</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Warn when available medicine units drop below these limits.</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div>
                <label style={labelStyle}>BOXES</label>
                <input type="number" value={lowStockBoxes} onChange={(e) => setLowStockBoxes(parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>STRIPS</label>
                <input type="number" value={lowStockStrips} onChange={(e) => setLowStockStrips(parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>TABLETS</label>
                <input type="number" value={lowStockTablets} onChange={(e) => setLowStockTablets(parseInt(e.target.value) || 0)} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>EXPIRY ALERT WARN THRESHOLD (DAYS)</label>
              <input type="number" value={expiryAlertDays} onChange={(e) => setExpiryAlertDays(parseInt(e.target.value) || 0)} style={inputStyle} />
            </div>

            <button onClick={() => handleSaveAlerts(lowStockBoxes, lowStockStrips, lowStockTablets, expiryAlertDays)} style={{ ...btnStyle, alignSelf: 'flex-end' }}>
              Save Threshold Rules
            </button>
          </div>

        </div>
      )}

      {/* ── LOGS TAB ── */}
      {activeTab === 'logs' && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--table-header-bg)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <Search style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Search audit logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--text-primary)' }} />
            </div>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, outline: 'none', background: 'var(--table-header-bg)', color: 'var(--text-secondary)' }}>
              <option value="">All Audited Actions</option>
              {uniqueActions.map((act) => <option key={act} value={act}>{act}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto' }}>
            {filteredLogs.map((log) => {
              const uuidMatch = log.details.match(/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/);
              const shortIdMatch = log.details.match(/(?:Order|invoice|INV-)\s*#?([a-fA-F0-9]{8})/i);
              const matchedId = uuidMatch ? uuidMatch[0] : (shortIdMatch ? shortIdMatch[1] : null);

              return (
                <div key={log.id} style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: 12, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: log.action.includes('ERR') || log.action.includes('DELETE') ? '#FEF2F2' : '#F0FDF4', color: log.action.includes('ERR') || log.action.includes('DELETE') ? '#EF4444' : '#10B981' }}>
                      {log.action}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
                    {log.details}
                    {matchedId && (
                      <div style={{ marginTop: 6 }}>
                        <a
                          href={`/retailer/billing?invoiceId=${matchedId}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#F59E0B', textDecoration: 'none', background: '#FFFBEB', padding: '3px 8px', borderRadius: 4, border: '1px solid #FDE68A' }}
                        >
                          🔍 View Related Invoice #{matchedId.substring(0, 8).toUpperCase()}
                        </a>
                      </div>
                    )}
                    {log.user && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                        Initiated by: <strong>{log.user.fullName || log.user.email}</strong> ({log.user.role})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showStaffModal && (
        <Modal onClose={() => setShowStaffModal(false)} title={editingStaff ? 'Update Employee Permissions' : 'Register New Shop Employee'}>
          <form onSubmit={handleSaveStaff} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input type="text" required value={staffFullName} onChange={(e) => setStaffFullName(e.target.value)} placeholder="e.g. Ram Kumar" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email Address (Login ID)</label>
              <input type="email" required disabled={!!editingStaff} value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="e.g. ram@pharmacy.com" style={{ ...inputStyle, background: editingStaff ? 'var(--table-header-bg)' : 'var(--card-bg)' }} />
            </div>
            <div>
              <label style={labelStyle}>Password {editingStaff && '(Leave blank to keep current)'}</label>
              <input type="password" required={!editingStaff} value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Authorized Dashboard Tabs</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--table-header-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--card-border)' }}>
                {AVAILABLE_FEATURES.map((feat) => {
                  const isChecked = staffFeatures.includes(feat);
                  return (
                    <label key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleFeature(feat)} style={{ cursor: 'pointer' }} />
                      {feat}
                    </label>
                  );
                })}
              </div>
            </div>

            {editingStaff && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                <input type="checkbox" id="staff-active" checked={staffIsActive} onChange={(e) => setStaffIsActive(e.target.checked)} style={{ cursor: 'pointer' }} />
                <label htmlFor="staff-active" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Account Status Active</label>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => setShowStaffModal(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={loading} style={{ flex: 2, padding: 10, border: 'none', background: '#F59E0B', color: '#FFFFFF', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {loading ? 'Processing…' : 'Save Employee Account'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
