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
  const [showPasswordsList, setShowPasswordsList] = useState(false);

  // Fetch updates in realtime
  useRealtimeEvent('SETTINGS_UPDATE', () => {
    fetchLogs();
  });
  
  useRealtimeEvent('STAFF_UPDATE', () => {
    fetchStaff();
    fetchLogs();
  });

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/retailer/billing'); // Fetch triggers page-refresh updates indirectly
      // We can also fetch the settings logs if needed, but we keep local audit log updates via page refresh
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
      
      // If there is a search term query param (e.g. order id or search string), pre-populate and switch to logs
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
    setStaffPassword(''); // keep blank unless overriding
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0', maxWidth: 800 }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', border: '1.5px solid #F1F5F9', borderRadius: 16, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings style={{ width: 22, height: 22, color: '#F59E0B' }} />
            Pharmacy Registry Console
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            Configure store profile, register shop employees, check logs and security settings.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '8px 14px' }}>
          <Calendar style={{ width: 16, height: 16, color: '#F97316' }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#94A3B8' }}>Store lease End</div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#1E293B', marginTop: 2 }}>
              {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F8FAFC', borderRadius: 12, padding: 4, border: '1px solid #E2E8F0' }}>
        {([
          { id: 'profile', label: 'Profile' },
          { id: 'staff', label: `Staff Employees (${staffList.length})` },
          { id: 'security', label: 'Security & Alerts' },
          { id: 'logs', label: 'Activity Logs' }
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setError(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 9,
              border: 'none',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === tab.id ? '#FFFFFF' : 'transparent',
              color: activeTab === tab.id ? '#F59E0B' : '#64748B',
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.07)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div style={{ display: 'flex', gap: 8, padding: 12, background: 'rgba(16,185,129,0.08)', borderRadius: 8, color: '#10B981', fontSize: 12, fontWeight: 600 }}>
          <CheckCircle style={{ width: 15, height: 15 }} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', gap: 8, padding: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 8, color: '#EF4444', fontSize: 12, fontWeight: 600 }}>
          <AlertCircle style={{ width: 15, height: 15 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Profile Settings Tab */}
      {activeTab === 'profile' && (
        <form onSubmit={handleUpdateProfile} style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #F1F5F9', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Pharmacy Name</label>
            <input type="text" value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Physical Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Contact Phone</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Latitude</label>
              <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Longitude</label>
              <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13 }} required />
            </div>
          </div>

          {/* GPS Capture */}
          <div style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(14,165,233,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin style={{ width: 18, height: 18, color: '#0EA5E9' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0C4A6E' }}>Auto-Detect GPS Location</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                {gpsMessage || 'Use your device GPS to automatically fill latitude & longitude coordinates.'}
              </div>
            </div>
            <button
              type="button"
              disabled={gpsLoading}
              onClick={() => {
                setGpsLoading(true);
                setGpsMessage('Detecting your location…');
                if (!navigator.geolocation) {
                  setGpsMessage('Geolocation is not supported by your browser.');
                  setGpsLoading(false);
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setLatitude(String(pos.coords.latitude));
                    setLongitude(String(pos.coords.longitude));
                    setGpsMessage(`✓ Location captured: ${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E`);
                    setGpsLoading(false);
                  },
                  (err) => {
                    setGpsMessage(`Error: ${err.message}. Please allow location access.`);
                    setGpsLoading(false);
                  },
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 9, border: 'none',
                background: gpsLoading ? '#94A3B8' : 'linear-gradient(135deg, #0EA5E9, #38BDF8)',
                color: 'white', fontSize: 12, fontWeight: 800, cursor: gpsLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap',
              }}
            >
              <Navigation style={{ width: 14, height: 14 }} />
              {gpsLoading ? 'Detecting…' : 'Capture My Location'}
            </button>
          </div>

          {/* Custom Fields section */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
            <h4 style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 12 }}>Dynamic Custom Fields</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {customFields.map((field) => (
                <div key={field.label} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 100 }}>{field.label}:</span>
                  <input
                    type="text"
                    value={field.value}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomFields(customFields.map((f) => f.label === field.label ? { ...f, value: val } : f));
                    }}
                    style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}
                  />
                  <button type="button" onClick={() => handleDeleteCustomField(field.label)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444' }}>
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              ))}
            </div>

            {showAddFieldForm ? (
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <input type="text" placeholder="Label name" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} style={{ padding: '8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <input type="text" placeholder="Value" value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} style={{ padding: '8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <button type="button" onClick={handleAddCustomField} style={{ padding: '6px 12px', background: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>Add</button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowAddFieldForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#F59E0B', cursor: 'pointer', fontSize: 12, fontWeight: 700, marginTop: 12 }}>
                <Plus style={{ width: 14, height: 14 }} />
                Add Custom Field
              </button>
            )}
          </div>

          <button type="submit" disabled={loading} style={{ background: '#F59E0B', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: 8, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <Save style={{ width: 15, height: 15 }} />
            {loading ? 'Saving...' : 'Save Profile Settings'}
          </button>
        </form>
      )}

      {/* Staff Management Tab */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#64748B' }}>Add employee users to let staff check POS counters and process inventory.</div>
            <button
              onClick={handleOpenCreateStaff}
              style={{ padding: '8px 14px', background: '#F59E0B', color: '#FFFFFF', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
            >
              Add Shop Employee
            </button>
          </div>

          {/* Table display staff list */}
          <div style={{ background: '#FFFFFF', border: '1.5px solid #F1F5F9', borderRadius: 16, overflow: 'hidden' }}>
            {staffList.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#CBD5E1' }}>No employee users created yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 20px', color: '#64748B' }}>Full Name</th>
                    <th style={{ padding: '12px 20px', color: '#64748B' }}>Email Account</th>
                    <th style={{ padding: '12px 20px', color: '#64748B' }}>Feature Set</th>
                    <th style={{ padding: '12px 20px', color: '#64748B' }}>Status</th>
                    <th style={{ padding: '12px 20px', color: '#64748B', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((emp) => (
                    <tr key={emp.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                      <td style={{ padding: '12px 20px', fontWeight: 800 }}>{emp.fullName}</td>
                      <td style={{ padding: '12px 20px', fontFamily: 'monospace' }}>{emp.email}</td>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {emp.allowedFeatures.split(',').map((f) => (
                            <span key={f} style={{ fontSize: 10, background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{f}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: emp.isActive ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', color: emp.isActive ? '#10B981' : '#EF4444' }}>
                          {emp.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button onClick={() => handleOpenEditStaff(emp)} style={{ border: 'none', background: '#F8FAFC', padding: 6, borderRadius: 6, cursor: 'pointer', color: '#3B82F6' }}>
                            <Edit2 style={{ width: 12, height: 12 }} />
                          </button>
                          <button onClick={() => handleDeleteStaff(emp.id, emp.fullName || '')} style={{ border: 'none', background: 'rgba(239,68,68,0.06)', padding: 6, borderRadius: 6, cursor: 'pointer', color: '#EF4444' }}>
                            <Trash2 style={{ width: 12, height: 12 }} />
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

      {/* Security Prefs Tab */}
      {activeTab === 'security' && (
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #F1F5F9', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>Client Inactivity Auto-Logout</h3>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Protect terminal node if left idle.</p>
            <select
              value={inactivityTimeout}
              onChange={(e) => handleSaveSecurity(e.target.value)}
              style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', outline: 'none', fontSize: 13, background: '#FFFFFF', marginTop: 12, width: '100%' }}
            >
              <option value="15">15 minutes of inactivity</option>
              <option value="30">30 minutes of inactivity</option>
              <option value="60">60 minutes of inactivity (Default)</option>
              <option value="120">120 minutes of inactivity</option>
              <option value="never">Never (Disabled)</option>
            </select>
          </div>

          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1E293B' }}>Stock alert thresholds</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>BOXES</label>
                <input type="number" value={lowStockBoxes} onChange={(e) => setLowStockBoxes(parseInt(e.target.value) || 0)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>STRIPS</label>
                <input type="number" value={lowStockStrips} onChange={(e) => setLowStockStrips(parseInt(e.target.value) || 0)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>TABLETS</label>
                <input type="number" value={lowStockTablets} onChange={(e) => setLowStockTablets(parseInt(e.target.value) || 0)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>EXPIRY ALERT THRESHOLD (DAYS)</label>
              <input type="number" value={expiryAlertDays} onChange={(e) => setExpiryAlertDays(parseInt(e.target.value) || 0)} style={{ padding: '8px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12 }} />
            </div>
            <button onClick={() => handleSaveAlerts(lowStockBoxes, lowStockStrips, lowStockTablets, expiryAlertDays)} style={{ background: '#F59E0B', color: '#FFFFFF', border: 'none', padding: '10px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}>
              Save Thresholds
            </button>
          </div>
        </div>
      )}

      {/* Activity Logs Tab */}
      {activeTab === 'logs' && (
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #F1F5F9', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <Search style={{ width: 14, height: 14, color: '#94A3B8' }} />
              <input type="text" placeholder="Search logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 12 }} />
            </div>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, outline: 'none', background: '#FFFFFF' }}>
              <option value="">All Actions</option>
              {uniqueActions.map((act) => <option key={act} value={act}>{act}</option>)}
            </select>
          </div>

          <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredLogs.map((log) => (
              <div key={log.id} style={{ borderBottom: '1px solid #F1F5F9', padding: '8px 0', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>{log.action}</span>
                  <span style={{ color: '#94A3B8' }}>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div style={{ color: '#64748B', marginTop: 4 }}>
                  {log.details}
                  {log.user && (
                    <span style={{ fontSize: 10, color: '#94A3B8', display: 'block', marginTop: 2 }}>
                      By: {log.user.fullName || log.user.email} (${log.user.role})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Editor Modal */}
      {showStaffModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <form onSubmit={handleSaveStaff} style={{ width: '100%', maxWidth: 480, background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User style={{ width: 18, height: 18, color: '#F59E0B' }} />
                {editingStaff ? 'Update employee Profile' : 'register new employee'}
              </h3>
              <button type="button" onClick={() => setShowStaffModal(false)} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px', cursor: 'pointer', color: '#64748B' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>FULL NAME</label>
                <input type="text" required value={staffFullName} onChange={(e) => setStaffFullName(e.target.value)} placeholder="e.g. Ram Kumar" style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>EMAIL ACCOUNT (LOGIN ID)</label>
                <input type="email" required disabled={!!editingStaff} value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="e.g. ram@pharmacy.com" style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, background: editingStaff ? '#F1F5F9' : '#FFFFFF' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>PASSWORD {editingStaff && '(LEAVE BLANK TO KEEP SAME)'}</label>
                <input type="password" required={!editingStaff} value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder="••••••••" style={{ padding: '10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13 }} />
              </div>

              {/* Toggle features checkboxes */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }}>AUTHORIZED DASHBOARD TABS</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {AVAILABLE_FEATURES.map((feat) => {
                    const isChecked = staffFeatures.includes(feat);
                    return (
                      <label key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', cursor: 'pointer' }}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleFeature(feat)} style={{ cursor: 'pointer' }} />
                        {feat}
                      </label>
                    );
                  })}
                </div>
              </div>

              {editingStaff && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                  <input type="checkbox" id="staff-active" checked={staffIsActive} onChange={(e) => setStaffIsActive(e.target.checked)} style={{ cursor: 'pointer' }} />
                  <label htmlFor="staff-active" style={{ fontSize: 12, fontWeight: 700, color: '#475569', cursor: 'pointer' }}>Account Active</label>
                </div>
              )}
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowStaffModal(false)} style={{ flex: 1, padding: 11, borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#FFFFFF', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={loading} style={{ flex: 2, padding: 11, border: 'none', borderRadius: 10, background: '#F59E0B', color: '#FFFFFF', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                Save Employee Account
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
