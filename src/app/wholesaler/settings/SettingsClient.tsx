'use client';

import React, { useState, useEffect } from 'react';
import { 
  User, Building, FileText, Phone, MapPin, Calendar, 
  CheckCircle, AlertCircle, RefreshCw, Key, ShieldAlert, Navigation, Plus, Trash,
  Users, UserPlus, Trash2, Eye, EyeOff, Clock, ShieldCheck, Edit, X, ToggleLeft, ToggleRight,
  Filter, XCircle, ChevronRight, Lock, Bell, AlertTriangle
} from 'lucide-react';
import { logActivity } from '@/components/WholesalerLayout';

interface WholesalerProfile {
  id: string;
  userId: string;
  companyName: string;
  taxId: string;
  address: string;
  phone: string;
  registrationNumber: string | null;
  contactPerson: string | null;
  latitude: number | null;
  longitude: number | null;
  customFieldsJson: string | null;
  createdAt: string;
}

interface StaffUser {
  id: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  plainPassword: string | null;
  allowedFeatures: string;
  createdAt: string;
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

interface SettingsClientProps {
  userRole: string;
  allowedFeaturesList: string[];
  initialProfile: WholesalerProfile;
  subscriptionEnd: string;
  initialStaff: StaffUser[];
  initialLogs: AuditLog[];
}

const AVAILABLE_FEATURES = [
  { key: 'Dashboard', label: 'Dashboard Home' },
  { key: 'Medicines', label: 'Manage Medicines' },
  { key: 'Orders', label: 'Sales & Orders' },
  { key: 'POS', label: 'POS Billing' },
  { key: 'Billing', label: 'Billing & Profits' },
  { key: 'Profile', label: 'Distributor Profile' },
  { key: 'Logs', label: 'Activity Logs' }
];

export default function SettingsClient({ 
  userRole, 
  allowedFeaturesList,
  initialProfile, 
  subscriptionEnd,
  initialStaff,
  initialLogs
}: SettingsClientProps) {
  
  const isOwner = userRole === 'WHOLESALER';
  
  // Decide starting tab
  const hasProfileAccess = isOwner || allowedFeaturesList.includes('Profile');
  const hasLogsAccess = isOwner || allowedFeaturesList.includes('Logs');
  
  const getInitialTab = () => {
    if (hasProfileAccess) return 'profile';
    if (isOwner) return 'staff';
    if (hasLogsAccess) return 'logs';
    return 'security';
  };
  
  const [activeTab, setActiveTab] = useState<'profile' | 'staff' | 'logs' | 'security' | 'alerts'>(getInitialTab());
  
  const [loading, setLoading] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ----------------------------------------------------
  // PROFILE TAB STATE
  // ----------------------------------------------------
  const [profile, setProfile] = useState<WholesalerProfile>(initialProfile);
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [taxId, setTaxId] = useState(profile.taxId);
  const [address, setAddress] = useState(profile.address);
  const [phone, setPhone] = useState(profile.phone);
  const [registrationNumber, setRegistrationNumber] = useState(profile.registrationNumber || '');
  const [contactPerson, setContactPerson] = useState(profile.contactPerson || '');
  const [latitude, setLatitude] = useState(profile.latitude ? profile.latitude.toString() : '27.7172');
  const [longitude, setLongitude] = useState(profile.longitude ? profile.longitude.toString() : '85.3240');

  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>(() => {
    try {
      return JSON.parse(profile.customFieldsJson || '[]');
    } catch (e) {
      return [];
    }
  });
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showAddFieldForm, setShowAddFieldForm] = useState(false);

  // ----------------------------------------------------
  // STAFF TAB STATE
  // ----------------------------------------------------
  const [staff, setStaff] = useState<StaffUser[]>(initialStaff);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>(
    AVAILABLE_FEATURES.map(f => f.key)
  );

  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editAllowedFeatures, setEditAllowedFeatures] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  // ----------------------------------------------------
  // LOGS TAB STATE
  // ----------------------------------------------------
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueUsers = Array.from(new Set(logs.map(log => log.user?.email).filter(Boolean)));

  // ----------------------------------------------------
  // SECURITY TIMEOUT TAB STATE
  // ----------------------------------------------------
  const [inactivityTimeout, setInactivityTimeout] = useState('60');
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10);
  const [expiryAlertDays, setExpiryAlertDays] = useState<number>(30);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTimeout = localStorage.getItem('wholesaler_inactivity_timeout');
      if (storedTimeout) {
        setInactivityTimeout(storedTimeout);
      }
      const storedLowStock = localStorage.getItem('medhub_low_stock_threshold');
      if (storedLowStock) {
        setLowStockThreshold(parseInt(storedLowStock, 10));
      }
      const storedExpiry = localStorage.getItem('medhub_expiry_alert_days');
      if (storedExpiry) {
        setExpiryAlertDays(parseInt(storedExpiry, 10));
      }
    }
  }, []);

  const handleSaveTimeout = (val: string) => {
    setInactivityTimeout(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('wholesaler_inactivity_timeout', val);
      setSuccessMsg(`Client inactivity timeout threshold updated to ${val === 'never' ? 'Never (Disabled)' : `${val} minutes`}.`);
      logActivity('UPDATE_TIMEOUT_PREFERENCE', `Changed client session inactivity timeout to ${val} minutes`);
    }
  };

  const handleSaveAlerts = (lowStock: number, expiryDays: number) => {
    setLowStockThreshold(lowStock);
    setExpiryAlertDays(expiryDays);
    if (typeof window !== 'undefined') {
      localStorage.setItem('medhub_low_stock_threshold', lowStock.toString());
      localStorage.setItem('medhub_expiry_alert_days', expiryDays.toString());
      setSuccessMsg(`Alert thresholds updated. Low stock threshold: ${lowStock} boxes, Expiry warnings: ${expiryDays} days.`);
      logActivity('UPDATE_ALERT_THRESHOLDS', `Changed low stock threshold to ${lowStock} boxes and expiry warning to ${expiryDays} days`);
    }
  };

  // ----------------------------------------------------
  // PROFILE HANDLERS
  // ----------------------------------------------------
  const handleGetLocation = () => {
    if (!isOwner) return;
    setError('');
    setSuccessMsg('');
    setIsFetchingLocation(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
          setSuccessMsg('GPS coordinates captured from browser geolocation API!');
          setIsFetchingLocation(false);
          logActivity('FETCH_GPS_LOCATION', `Retrieved browser coordinates: [${position.coords.latitude}, ${position.coords.longitude}]`);
        },
        (err) => {
          console.error(err);
          setError('Browser Geolocation request rejected. Please verify browser location permissions.');
          setIsFetchingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setError('Geolocation services not supported in this browser version.');
      setIsFetchingLocation(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/wholesaler/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          taxId,
          address,
          phone,
          registrationNumber,
          contactPerson,
          latitude: parseFloat(latitude) || null,
          longitude: parseFloat(longitude) || null,
          customFieldsJson: JSON.stringify(customFields)
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

      setSuccessMsg('Distributor Profile settings updated successfully.');
      setProfile(data.profile);
      logActivity('UPDATE_PROFILE', `Modified distributor profile info. Coordinates set to [${latitude}, ${longitude}]`);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleGridSelect = (loc: { name: string; lat: number; lng: number }) => {
    if (!isOwner) return;
    setLatitude(loc.lat.toString());
    setLongitude(loc.lng.toString());
    logActivity('CLICK_MAP_GRID', `Selected Kathmandu map area: ${loc.name} ([${loc.lat}, ${loc.lng}])`);
  };

  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    if (customFields.some(f => f.label.toLowerCase() === newFieldLabel.toLowerCase().trim())) {
      setError(`A custom field named "${newFieldLabel}" already exists.`);
      return;
    }

    setCustomFields([
      ...customFields,
      { label: newFieldLabel.trim(), value: newFieldValue.trim() }
    ]);
    setNewFieldLabel('');
    setNewFieldValue('');
    setShowAddFieldForm(false);
    logActivity('ADD_CUSTOM_FIELD', `Added dynamic custom field: "${newFieldLabel.trim()}"`);
  };

  const handleDeleteCustomField = (label: string) => {
    setCustomFields(customFields.filter(f => f.label !== label));
    logActivity('DELETE_CUSTOM_FIELD', `Removed dynamic custom field: "${label}"`);
  };

  const handleCustomFieldValueChange = (label: string, newValue: string) => {
    setCustomFields(customFields.map(f => 
      f.label === label ? { ...f, value: newValue } : f
    ));
  };

  // ----------------------------------------------------
  // STAFF HANDLERS
  // ----------------------------------------------------
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email || !password || !fullName) {
      setError('Please fill in all employee credentials.');
      return;
    }

    if (allowedFeatures.length === 0) {
      setError('Please select at least one allowed feature for the employee.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/wholesaler/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password, 
          fullName, 
          allowedFeatures 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account.');

      setSuccessMsg(`Employee account created for "${fullName}" successfully.`);
      setEmail('');
      setPassword('');
      setFullName('');
      setAllowedFeatures(AVAILABLE_FEATURES.map(f => f.key));
      
      const staffRes = await fetch('/api/wholesaler/staff');
      const staffData = await staffRes.json();
      if (staffRes.ok) {
        setStaff(staffData.staff);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create staff.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (emp: StaffUser) => {
    setEditingStaff(emp);
    setEditEmail(emp.email);
    setEditFullName(emp.fullName || '');
    setEditPassword('');
    setEditIsActive(emp.isActive);
    setEditAllowedFeatures(emp.allowedFeatures ? emp.allowedFeatures.split(',') : []);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch(`/api/wholesaler/staff/${editingStaff.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: editEmail,
          fullName: editFullName,
          password: editPassword || undefined,
          isActive: editIsActive,
          allowedFeatures: editAllowedFeatures
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update employee account.');

      setSuccessMsg(`Updated settings for "${editFullName}" successfully.`);
      setEditingStaff(null);

      const staffRes = await fetch('/api/wholesaler/staff');
      const staffData = await staffRes.json();
      if (staffRes.ok) {
        setStaff(staffData.staff);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update employee.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely sure you want to delete staff account: "${name}"? This action cannot be undone.`)) {
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch(`/api/wholesaler/staff/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account.');

      setSuccessMsg(`Staff account "${name}" has been deleted.`);
      
      const staffRes = await fetch('/api/wholesaler/staff');
      const staffData = await staffRes.json();
      if (staffRes.ok) {
        setStaff(staffData.staff);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete employee.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeature = (key: string, isEditMode = false) => {
    if (isEditMode) {
      if (editAllowedFeatures.includes(key)) {
        setEditAllowedFeatures(editAllowedFeatures.filter(f => f !== key));
      } else {
        setEditAllowedFeatures([...editAllowedFeatures, key]);
      }
    } else {
      if (allowedFeatures.includes(key)) {
        setAllowedFeatures(allowedFeatures.filter(f => f !== key));
      } else {
        setAllowedFeatures([...allowedFeatures, key]);
      }
    }
  };

  // ----------------------------------------------------
  // LOGS FILTERING
  // ----------------------------------------------------
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter ? log.action === actionFilter : true;
    const matchesUser = userFilter ? log.user?.email === userFilter : true;

    return matchesSearch && matchesAction && matchesUser;
  });

  const clearFilters = () => {
    setSearchTerm('');
    setActionFilter('');
    setUserFilter('');
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">

      {/* Page Header — matches dashboard/billing/staff/logs style */}
      <div style={{
        background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(186,230,253,0.5)', borderRadius: 20,
        padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.07)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building style={{ width: 22, height: 22, color: '#F97316' }} />
              Registry Console &amp; Settings
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
              Configure profile details, staff permissions, audit logs, and security controls.
            </p>
          </div>
          {/* Subscription Lease Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '8px 14px' }}>
            <Calendar style={{ width: 16, height: 16, color: '#F97316', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8' }}>Store Lease Expiry</div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#1E293B', marginTop: 2 }}>
                {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
          {hasProfileAccess && (
            <button
              onClick={() => { setActiveTab('profile'); setError(''); setSuccessMsg(''); }}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.04em', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                background: activeTab === 'profile' ? 'linear-gradient(135deg, #F97316, #F59E0B)' : 'transparent',
                color: activeTab === 'profile' ? 'white' : '#64748B',
                boxShadow: activeTab === 'profile' ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
              }}
            >
              Profile Settings
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => { setActiveTab('staff'); setError(''); setSuccessMsg(''); }}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.04em', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                background: activeTab === 'staff' ? 'linear-gradient(135deg, #F97316, #F59E0B)' : 'transparent',
                color: activeTab === 'staff' ? 'white' : '#64748B',
                boxShadow: activeTab === 'staff' ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
              }}
            >
              Staff Directory
            </button>
          )}
          {hasLogsAccess && (
            <button
              onClick={() => { setActiveTab('logs'); setError(''); setSuccessMsg(''); }}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.04em', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                background: activeTab === 'logs' ? 'linear-gradient(135deg, #F97316, #F59E0B)' : 'transparent',
                color: activeTab === 'logs' ? 'white' : '#64748B',
                boxShadow: activeTab === 'logs' ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
              }}
            >
              Activity Logs
            </button>
          )}
          <button
            onClick={() => { setActiveTab('security'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.04em', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
              background: activeTab === 'security' ? 'linear-gradient(135deg, #F97316, #F59E0B)' : 'transparent',
              color: activeTab === 'security' ? 'white' : '#64748B',
              boxShadow: activeTab === 'security' ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
            }}
          >
            Security Prefs
          </button>
          <button
            onClick={() => { setActiveTab('alerts'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.04em', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
              background: activeTab === 'alerts' ? 'linear-gradient(135deg, #F97316, #F59E0B)' : 'transparent',
              color: activeTab === 'alerts' ? 'white' : '#64748B',
              boxShadow: activeTab === 'alerts' ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
            }}
          >
            Alert Thresholds
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert alert-error animate-scaleIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success animate-scaleIn">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* View Panels */}
      <div className="space-y-6">
        
        {/* PANEL: DISTRIBUTOR PROFILE */}
        {activeTab === 'profile' && hasProfileAccess && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Distributor Form */}
            <div className="lg:col-span-7 card bg-white/80 backdrop-blur-xl border border-white/60 p-6 space-y-6 shadow-sm">
              <div>
                <h3 className="text-sm font-black uppercase text-zinc-800 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Building className="w-4 h-4 text-orange-500" />
                  Distributor Registry Form
                </h3>
              </div>

              {!isOwner && (
                <div className="alert alert-warning text-xs">
                  <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                  <span>Staff accounts are read-only. Ask the store owner to update registration parameters.</span>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-zinc-500 uppercase text-[10px] font-black tracking-wider mb-1.5">Company Name</label>
                    <input
                      type="text"
                      required
                      disabled={!isOwner}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="input-crisp disabled:opacity-60 text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 uppercase text-[10px] font-black tracking-wider mb-1.5">VAT / TAX ID Number</label>
                    <input
                      type="text"
                      required
                      disabled={!isOwner}
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className="input-crisp disabled:opacity-60 font-mono text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 uppercase text-[10px] font-black tracking-wider mb-1.5">Registration / License Number</label>
                    <input
                      type="text"
                      placeholder="e.g. REG-98234-DIST"
                      disabled={!isOwner}
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      className="input-crisp disabled:opacity-60 font-mono text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 uppercase text-[10px] font-black tracking-wider mb-1.5">Contact Person Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Harry Prasad"
                      disabled={!isOwner}
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="input-crisp disabled:opacity-60 text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 uppercase text-[10px] font-black tracking-wider mb-1.5">Contact Phone Number</label>
                    <input
                      type="text"
                      required
                      disabled={!isOwner}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-crisp disabled:opacity-60 font-mono text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-500 uppercase text-[10px] font-black tracking-wider mb-1.5">Warehouse Street Address</label>
                    <input
                      type="text"
                      required
                      disabled={!isOwner}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="input-crisp disabled:opacity-60 text-sm transition-all"
                    />
                  </div>
                </div>

                {/* GPS Coordinates Section */}
                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="block text-zinc-700 uppercase font-black text-[10px] tracking-wider">GPS Coordinates</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={handleGetLocation}
                        className="py-1.5 px-3 rounded-lg border border-orange-200 hover:border-orange-350 bg-orange-50 text-orange-655 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer animate-pulse"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Capture GPS
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-zinc-400 uppercase text-[9px] font-black tracking-wider mb-1">Latitude</label>
                      <input
                        type="text"
                        disabled
                        value={latitude}
                        className="input-crisp bg-slate-50 cursor-not-allowed font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 uppercase text-[9px] font-black tracking-wider mb-1">Longitude</label>
                      <input
                        type="text"
                        disabled
                        value={longitude}
                        className="input-crisp bg-slate-50 cursor-not-allowed font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Dynamic custom fields */}
                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="block text-zinc-700 uppercase font-black text-[10px] tracking-wider">Additional Parameters</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setShowAddFieldForm(!showAddFieldForm)}
                        className="py-1.5 px-3 rounded-lg border border-amber-250 bg-amber-50 text-amber-700 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Field
                      </button>
                    )}
                  </div>

                  {showAddFieldForm && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                        <div>
                          <label className="block text-zinc-500 mb-1">Label</label>
                          <input
                            type="text"
                            placeholder="e.g. Website"
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            className="input-crisp bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-zinc-500 mb-1">Value</label>
                          <input
                            type="text"
                            placeholder="e.g. medhub.com"
                            value={newFieldValue}
                            onChange={(e) => setNewFieldValue(e.target.value)}
                            className="input-crisp bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={handleAddCustomField}
                          className="py-1.5 px-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-all text-[10px] uppercase cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddFieldForm(false)}
                          className="py-1.5 px-3 border border-slate-250 bg-white text-zinc-650 rounded-lg hover:bg-slate-50 transition-all text-[10px] uppercase cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {customFields.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {customFields.map((field) => (
                        <div key={field.label} className="bg-slate-50/50 border border-slate-150 p-3 rounded-2xl relative group space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="block text-zinc-500 uppercase text-[9px] font-black truncate max-w-[80%]">{field.label}</label>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomField(field.label)}
                                className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            disabled={!isOwner}
                            value={field.value}
                            onChange={(e) => handleCustomFieldValueChange(field.label, e.target.value)}
                            className="input-crisp bg-white text-xs py-1.5"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isOwner && (
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md hover:shadow-lg py-4 font-black uppercase text-xs tracking-wider"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> : null}
                    Save Distributor Settings
                  </button>
                )}
              </form>
            </div>

            {/* Map Locator */}
            <div className="lg:col-span-5 space-y-6">
              <div className="card bg-white/80 border border-white/60 p-6 space-y-4 shadow-sm">
                <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                  <MapPin className="w-4 h-4 text-orange-500" />
                  Map Geolocation View
                </h3>
                <p style={{ fontSize: 11, color: '#64748B' }}>
                  Your registered warehouse location coordinates. Once captured, verify them on Google Maps.
                </p>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>Manual Coordinates Override</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input 
                        type="number" step="0.0001" placeholder="Lat" value={latitude} 
                        onChange={e => setLatitude(e.target.value)} 
                        className="input-crisp" style={{ fontSize: 11, padding: 6, width: '100%', fontFamily: 'monospace' }} 
                      />
                      <input 
                        type="number" step="0.0001" placeholder="Lng" value={longitude} 
                        onChange={e => setLongitude(e.target.value)} 
                        className="input-crisp" style={{ fontSize: 11, padding: 6, width: '100%', fontFamily: 'monospace' }} 
                      />
                    </div>
                  </div>

                  {latitude && longitude && (
                    <a 
                      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="btn-ghost"
                      style={{ padding: '8px 14px', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'white' }}
                    >
                      <MapPin style={{ width: 14, height: 14, color: '#F97316' }} /> View Location on Google Maps
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL: STAFF ROSTER */}
        {activeTab === 'staff' && isOwner && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 card bg-white/80 border p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                <UserPlus className="w-4.5 h-4.5 text-orange-500" />
                Register Staff
              </h3>

              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div>
                  <label className="block text-zinc-500 uppercase text-[9px] font-black mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ram Bahadur"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-crisp text-xs py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 uppercase text-[9px] font-black mb-1">Email / Username</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. ram@distributor.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-crisp text-xs py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-zinc-500 uppercase text-[9px] font-black mb-1">Password</label>
                  <input
                    type="text"
                    required
                    placeholder="Create staff password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-crisp text-xs py-2.5 font-mono"
                  />
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <label className="block text-zinc-500 uppercase text-[9px] font-black tracking-wider">Features Enabled:</label>
                  <div className="grid grid-cols-1 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                    {AVAILABLE_FEATURES.map((f) => {
                      const isChecked = allowedFeatures.includes(f.key);
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => handleToggleFeature(f.key)}
                          className="flex items-center gap-2 p-1 text-left text-zinc-700 font-semibold cursor-pointer"
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 text-[10px] ${isChecked ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-350 bg-white'}`}>
                            {isChecked && '✓'}
                          </span>
                          <span className="text-[10px]">{f.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3.5 font-bold uppercase text-[10px]"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> : null}
                  Register Employee
                </button>
              </form>
            </div>

            <div className="lg:col-span-8 card bg-white/80 border p-6 space-y-4 shadow-sm">
              <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                <Users className="w-4.5 h-4.5 text-orange-500" />
                Staff Directory Roster
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {staff.length === 0 ? (
                  <div className="col-span-2 text-center text-zinc-400 py-10 italic text-xs font-mono">
                    NO REGISTERED STAFF MEMBERS.
                  </div>
                ) : (
                  staff.map((emp) => (
                    <div 
                      key={emp.id} 
                      className="p-4 border border-slate-150 rounded-2xl bg-white flex flex-col justify-between gap-4 hover:border-orange-350 transition-all shadow-sm"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <div className="min-w-0">
                            <div className="text-zinc-950 font-black text-xs uppercase tracking-wide truncate">{emp.fullName}</div>
                            <div className="text-[10px] text-zinc-450 truncate font-mono mt-0.5">{emp.email}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold border uppercase tracking-wider font-mono ${
                            emp.isActive ? 'bg-emerald-50 border-emerald-250 text-emerald-600' : 'bg-slate-100 border-slate-300 text-zinc-400'
                          }`}>
                            {emp.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-150 p-2 rounded-xl mt-3 flex items-center gap-2 text-[10px] font-mono font-bold text-zinc-650">
                          <Key className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                          <span>PASSCODE:</span>
                          <span className="text-zinc-900 select-all font-mono font-extrabold">{emp.plainPassword || 'N/A'}</span>
                        </div>

                        <div className="mt-3.5 space-y-1">
                          <div className="text-[9px] uppercase font-black text-zinc-400 tracking-wider">Permitted Pages:</div>
                          <div className="flex flex-wrap gap-1">
                            {emp.allowedFeatures ? (
                              emp.allowedFeatures.split(',').map((f) => (
                                <span 
                                  key={f} 
                                  className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-orange-655 rounded text-[9px] font-bold"
                                >
                                  {f}
                                </span>
                              ))
                            ) : (
                              <span className="text-[9px] text-zinc-400 italic">None</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 border-t border-slate-100 pt-3 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          className="py-1.5 px-3 rounded-lg border border-slate-200 hover:border-orange-300 bg-white text-zinc-700 hover:text-zinc-950 shadow-sm flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5 text-orange-500" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(emp.id, emp.fullName || emp.email)}
                          className="py-1.5 px-3 rounded-lg border border-slate-200 hover:border-red-200 bg-white hover:bg-red-50 text-zinc-700 hover:text-red-650 shadow-sm flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* PANEL: ACTIVITY LOGS */}
        {activeTab === 'logs' && hasLogsAccess && (
          <div className="card bg-white/80 border p-6 space-y-6 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                <FileText className="w-4.5 h-4.5 text-orange-500" />
                Operational Activity Logs
              </h3>
              <button
                onClick={() => window.location.reload()}
                className="py-1.5 px-3 rounded-xl border border-slate-200 hover:border-slate-350 bg-white text-zinc-650 hover:text-zinc-850 font-bold text-[10px] uppercase flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold bg-slate-50 p-4 border border-slate-150 rounded-2xl">
              <div>
                <label className="block text-zinc-500 mb-1.5">Search Logs</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search details..."
                  className="input-crisp bg-white"
                />
              </div>

              <div>
                <label className="block text-zinc-500 mb-1.5">Action Type</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="select-crisp bg-white"
                >
                  <option value="">All Actions</option>
                  {uniqueActions.map(action => (
                    <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-500 mb-1.5">Operator</label>
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="select-crisp bg-white"
                >
                  <option value="">All Operators</option>
                  {uniqueUsers.map(email => (
                    <option key={email} value={email}>{email}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                {(searchTerm || actionFilter || userFilter) && (
                  <button
                    onClick={clearFilters}
                    className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 rounded-xl font-bold uppercase transition-colors text-[10px] cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Redesigned Premium Bordered Table */}
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Operator</th>
                    <th>Description</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-400 italic">
                        No logs match filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isStaff = log.user?.role === 'WHOLESALER_STAFF';
                      const timestampStr = new Date(log.timestamp).toLocaleString();

                      return (
                        <tr key={log.id}>
                          <td className="font-mono text-[10px] text-zinc-500 whitespace-nowrap">{timestampStr}</td>
                          <td>
                            <span className="text-orange-700 font-bold uppercase text-[9px] border border-orange-100 bg-orange-50 px-2 py-0.5 rounded-lg font-mono">
                              {log.action}
                            </span>
                          </td>
                          <td>
                            <div className="font-bold text-zinc-800 truncate max-w-[120px]">
                              {log.user?.fullName || log.user?.email.split('@')[0] || 'System'}
                            </div>
                            <div className="text-[9.5px] text-zinc-400 font-mono mt-0.5">{log.user?.email}</div>
                          </td>
                          <td className="leading-relaxed text-[11px]">
                            {log.details}
                          </td>
                          <td>
                            <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold border uppercase tracking-wider font-mono ${
                              isStaff ? 'bg-pink-50 border-pink-150 text-pink-655' : 'bg-orange-50 border-orange-200 text-orange-655'
                            }`}>
                              {isStaff ? 'STAFF' : 'OWNER'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PANEL: SECURITY PREFERENCES */}
        {activeTab === 'security' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
            {/* Main Card */}
            <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 20 }}>
                <Lock style={{ width: 14, height: 14, color: '#F97316' }} />
                <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B' }}>
                  Security Preference Guard
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Client Inactivity Auto-Logout Threshold
                  </label>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12, lineHeight: 1.6 }}>
                    Set the duration after which an idle browser session is automatically signed out. Timer resets on every user interaction (click, keypress, mouse move).
                  </p>
                  <select
                    value={inactivityTimeout}
                    onChange={(e) => handleSaveTimeout(e.target.value)}
                    className="select-crisp"
                    style={{ fontWeight: 700 }}
                  >
                    <option value="1">1 Minute (Test Mode)</option>
                    <option value="5">5 Minutes</option>
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="60">60 Minutes (Default)</option>
                    <option value="120">120 Minutes</option>
                    <option value="never">Never (Disabled)</option>
                  </select>
                </div>
                {/* Active Setting Display */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8FAFC', border: '1.5px solid #E0F2FE', borderRadius: 12, padding: '14px 16px' }}>
                  <Clock style={{ width: 20, height: 20, color: '#F97316', flexShrink: 0 }} className="animate-pulse" />
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.06em' }}>Active Timeout Setting</div>
                    <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: '#1E293B', marginTop: 2 }}>
                      {inactivityTimeout === 'never' ? 'DISABLED — Never Timeout' : `${inactivityTimeout} Minutes`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Sidebar — finance-card dark panel */}
            <div className="finance-card">
              <div style={{ position: 'relative', zIndex: 1 }}>
                <h3 style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                  <ShieldAlert style={{ width: 14, height: 14, color: '#FB923C' }} />
                  Guard Details
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { label: 'Interaction tracking', value: 'Mouse, keyboard, clicks' },
                    { label: 'Timer resets on', value: 'Every user action' },
                    { label: 'On timeout', value: 'Auto-redirect to logout' },
                    { label: 'Scope', value: 'Client-side only' },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ paddingBottom: i < arr.length - 1 ? 14 : 0, borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>{row.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'white', marginTop: 3 }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL: ALERT THRESHOLDS */}
        {activeTab === 'alerts' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
            {/* Main Card */}
            <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 20 }}>
                <Bell style={{ width: 14, height: 14, color: '#F97316' }} />
                <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#1E293B' }}>
                  Alert & Notifications Threshold Configuration
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Low Stock Threshold (Boxes)
                  </label>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10, lineHeight: 1.6 }}>
                    Define the inventory count (in boxes, where 1 box = 20 base units) below which a medicine is considered low stock and flagged on the dashboard.
                  </p>
                  <input
                    type="number"
                    min="1"
                    value={lowStockThreshold}
                    onChange={(e) => handleSaveAlerts(parseInt(e.target.value, 10) || 1, expiryAlertDays)}
                    className="input-crisp"
                    style={{ maxWidth: 200, fontWeight: 700, fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Stock Expiry Alert Range (Days)
                  </label>
                  <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 10, lineHeight: 1.6 }}>
                    The number of days prior to a batch's expiration date when warning alerts should display on your dashboard.
                  </p>
                  <input
                    type="number"
                    min="1"
                    value={expiryAlertDays}
                    onChange={(e) => handleSaveAlerts(lowStockThreshold, parseInt(e.target.value, 10) || 1)}
                    className="input-crisp"
                    style={{ maxWidth: 200, fontWeight: 700, fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>

            {/* Info Sidebar Box */}
            <div className="card" style={{ background: '#FAFCFF', border: '1.5px solid #E0F2FE', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #E0F2FE', paddingBottom: 10 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: '#F97316' }} />
                <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1E293B' }}>
                  Current Threshold Summary
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Low Stock Flag</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace', marginTop: 2 }}>
                    &lt; {lowStockThreshold} Boxes
                  </div>
                  <p style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>({lowStockThreshold * 20} base units)</p>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Expiry Window Flag</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace', marginTop: 2 }}>
                    &lt; {expiryAlertDays} Days
                  </div>
                  <p style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Warnings display dynamically</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* EDIT STAFF ACCESS MODAL */}
      {editingStaff && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} className="no-print">
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-scaleIn"
            style={{ background: 'rgba(255,255,255,0.97)', border: '1.5px solid rgba(186,230,253,0.6)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(14,165,233,0.18)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 14, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Edit style={{ width: 16, height: 16, color: '#F97316' }} />
                Modify Staff Permissions
              </h3>
              <button onClick={() => setEditingStaff(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Full Name</label>
                <input type="text" required value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="input-crisp" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Email / Username</label>
                <input type="email" required value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="input-crisp" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>New Password (leave blank to keep current)</label>
                <input type="text" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Enter new plain passcode" className="input-crisp" style={{ fontFamily: 'monospace' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1.5px solid #E0F2FE', borderRadius: 10, padding: '10px 14px' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Status:</span>
                <button type="button" onClick={() => setEditIsActive(!editIsActive)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {editIsActive ? (
                    <>
                      <ToggleRight style={{ width: 32, height: 32, color: '#0EA5E9' }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#0EA5E9' }}>ENABLED</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft style={{ width: 32, height: 32, color: '#94A3B8' }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8' }}>DISABLED</span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Features Checklist</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: '#F8FAFC', border: '1.5px solid #E0F2FE', borderRadius: 10, padding: '8px 10px' }}>
                  {AVAILABLE_FEATURES.map((f) => {
                    const isChecked = editAllowedFeatures.includes(f.key);
                    return (
                      <button key={f.key} type="button" onClick={() => handleToggleFeature(f.key, true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, border: 'none', background: isChecked ? 'rgba(14,165,233,0.08)' : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                        <span style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${isChecked ? '#0EA5E9' : '#CBD5E1'}`, background: isChecked ? '#0EA5E9' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {isChecked && <span style={{ color: 'white', fontSize: 9, fontWeight: 900 }}>✓</span>}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: isChecked ? '#1E293B' : '#64748B' }}>{f.key}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px', background: 'linear-gradient(135deg, #F97316, #F59E0B)' }}>
                  Save Changes
                </button>
                <button type="button" onClick={() => setEditingStaff(null)} className="btn-ghost" style={{ padding: '12px 20px' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
