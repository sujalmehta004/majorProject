"use client";

import React, { useState, useEffect, useRef } from "react";
import { formatDateNPT, formatDateTimeNPT } from '@/lib/timezone';
import {
  Building, Calendar, ShieldCheck, Save,
  AlertCircle, CheckCircle, Search, Trash2, Plus, 
  User, ShieldAlert, Edit2, Lock, X, MapPin, Navigation,
  Eye, FileImage, ChevronLeft, ChevronRight, Upload,
  Phone, Send, ZoomIn, Check, Trash
} from 'lucide-react';
import { logActivity } from "@/components/WholesalerLayout";

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
  registrationData?: {
    verificationStatus: string;
    verificationRejectReason: string | null;
    registrationImagesJson: string;
  };
}

const AVAILABLE_FEATURES = [
  { key: "Dashboard", label: "Dashboard Home" },
  { key: "Medicines", label: "Manage Medicines" },
  { key: "Orders", label: "Sales & Orders" },
  { key: "POS", label: "POS Billing" },
  { key: "Billing", label: "Billing & Profits" },
  { key: "Profile", label: "Distributor Profile" },
  { key: "Logs", label: "Activity Logs" },
];

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

const lockedInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'var(--table-header-bg)',
  cursor: 'not-allowed',
  opacity: 0.7,
};

const btnStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#0EA5E9',
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
  userRole,
  allowedFeaturesList,
  initialProfile,
  subscriptionEnd,
  initialStaff,
  initialLogs,
  registrationData,
}: SettingsClientProps) {
  const isOwner = userRole === "WHOLESALER";

  const verificationStatus = registrationData?.verificationStatus || 'PENDING';
  const isPending = verificationStatus === 'PENDING';
  const isVerified = verificationStatus === 'VERIFIED';
  const isRejected = verificationStatus === 'REJECTED';

  const hasProfileAccess = isOwner || allowedFeaturesList.includes("Profile");
  const hasLogsAccess = isOwner || allowedFeaturesList.includes("Logs");

  const getInitialTab = () => {
    if (hasProfileAccess) return "profile";
    if (isOwner) return "staff";
    if (hasLogsAccess) return "logs";
    return "security";
  };

  const [activeTab, setActiveTab] = useState<'profile' | 'staff' | 'security' | 'logs' | 'theme'>(getInitialTab());
  const [loading, setLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile Form Fields State
  const [companyName, setCompanyName] = useState(initialProfile.companyName);
  const [taxId, setTaxId] = useState(initialProfile.taxId);
  const [address, setAddress] = useState(initialProfile.address);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [registrationNumber, setRegistrationNumber] = useState(initialProfile.registrationNumber || "");
  const [contactPerson, setContactPerson] = useState(initialProfile.contactPerson || "");
  const [latitude, setLatitude] = useState(initialProfile.latitude ? String(initialProfile.latitude) : "27.7172");
  const [longitude, setLongitude] = useState(initialProfile.longitude ? String(initialProfile.longitude) : "85.3240");

  // Edit Mode state
  const [isEditingVerifiedDetails, setIsEditingVerifiedDetails] = useState(false);

  // Document Uploads State
  const initialImages: string[] = (() => {
    try { return JSON.parse(registrationData?.registrationImagesJson || '[]'); } catch { return []; }
  })();
  const [registrationImages, setRegistrationImages] = useState<string[]>(initialImages);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Map Modal State
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapPickedLat, setMapPickedLat] = useState<number | null>(null);
  const [mapPickedLng, setMapPickedLng] = useState<number | null>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState<any[]>([]);
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapMarkerRef = useRef<any>(null);

  // Document Viewer Modal State
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [docViewerIndex, setDocViewerIndex] = useState(0);
  const [docZoomed, setDocZoomed] = useState(false);

  // Custom Fields
  const [customFields, setCustomFields] = useState<Array<{ label: string; value: string }>>(() => {
    try { return JSON.parse(initialProfile.customFieldsJson || "[]"); } catch { return []; }
  });
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [showAddFieldForm, setShowAddFieldForm] = useState(false);

  // Security / Alerts State
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [fontScale, setFontScale] = useState<'sm' | 'md' | 'lg'>('md');
  const [inactivityTimeout, setInactivityTimeout] = useState('60');
  const [lowStockBoxes, setLowStockBoxes] = useState(10);
  const [lowStockStrips, setLowStockStrips] = useState(0);
  const [lowStockTablets, setLowStockTablets] = useState(0);
  const [expiryAlertDays, setExpiryAlertDays] = useState(30);

  // Staff State
  const [staffList, setStaffList] = useState<StaffUser[]>(initialStaff);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffFullName, setStaffFullName] = useState("");
  const [staffFeatures, setStaffFeatures] = useState<string[]>(AVAILABLE_FEATURES.map(f => f.key));
  const [staffIsActive, setStaffIsActive] = useState(true);

  // Logs State
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Lock status check
  const fieldsLocked = !isOwner || ((isPending || isVerified) && !isEditingVerifiedDetails);

  // Load Leaflet Script
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).L) { setLeafletLoaded(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize Leaflet Map in Modal
  useEffect(() => {
    if (!showMapModal || !leafletLoaded || !mapContainerRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const L = (window as any).L;
    const initLat = parseFloat(latitude) || 27.7172;
    const initLng = parseFloat(longitude) || 85.3240;
    setMapPickedLat(initLat);
    setMapPickedLng(initLng);

    setTimeout(() => {
      if (!mapContainerRef.current) return;
      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([initLat, initLng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const icon = L.divIcon({
        html: `<div style="background:#0EA5E9;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([initLat, initLng], { draggable: true, icon }).addTo(map);
      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        setMapPickedLat(parseFloat(pos.lat.toFixed(6)));
        setMapPickedLng(parseFloat(pos.lng.toFixed(6)));
      });
      map.on('click', (e: any) => {
        const { lat: cLat, lng: cLng } = e.latlng;
        marker.setLatLng([cLat, cLng]);
        setMapPickedLat(parseFloat(cLat.toFixed(6)));
        setMapPickedLng(parseFloat(cLng.toFixed(6)));
      });

      mapInstanceRef.current = map;
      mapMarkerRef.current = marker;
      map.invalidateSize();
    }, 120);
  }, [showMapModal, leafletLoaded]);

  // OpenStreetMap Nominatim place search
  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim()) return;
    setMapSearchLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}&limit=5`);
      const data = await res.json();
      setMapSearchResults(data);
    } catch { }
    setMapSearchLoading(false);
  };

  const handleSelectMapResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setMapPickedLat(lat);
    setMapPickedLng(lng);
    setMapSearchResults([]);
    setMapSearchQuery(result.display_name.split(',')[0]);
    if (mapInstanceRef.current && mapMarkerRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16);
      mapMarkerRef.current.setLatLng([lat, lng]);
    }
  };

  const handleConfirmMapLocation = () => {
    if (mapPickedLat !== null && mapPickedLng !== null) {
      setLatitude(String(mapPickedLat));
      setLongitude(String(mapPickedLng));
    }
    setShowMapModal(false);
    setMapSearchQuery('');
    setMapSearchResults([]);
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
      setThemeMode(savedTheme);
      const savedFontScale = localStorage.getItem('font_scale') as 'sm' | 'md' | 'lg' || 'md';
      setFontScale(savedFontScale);
      const savedTimeout = localStorage.getItem("wholesaler_inactivity_timeout");
      if (savedTimeout) setInactivityTimeout(savedTimeout);
      const savedBoxes = localStorage.getItem("medhub_low_stock_threshold_boxes");
      if (savedBoxes) setLowStockBoxes(parseInt(savedBoxes, 10));
      const savedStrips = localStorage.getItem("medhub_low_stock_threshold_strips");
      if (savedStrips) setLowStockStrips(parseInt(savedStrips, 10));
      const savedTablets = localStorage.getItem("medhub_low_stock_threshold_tablets");
      if (savedTablets) setLowStockTablets(parseInt(savedTablets, 10));
      const savedExpiry = localStorage.getItem("medhub_expiry_alert_days");
      if (savedExpiry) setExpiryAlertDays(parseInt(savedExpiry, 10));

      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'logs' && hasLogsAccess) setActiveTab('logs');
      else if (tabParam === 'staff' && isOwner) setActiveTab('staff');
      else if (tabParam === 'security') setActiveTab('security');
    }
  }, []);

  // Save phone number standalone
  const handleSavePhoneOnly = async () => {
    if (!phone.trim()) return;
    setPhoneLoading(true);
    setError(''); setSuccessMsg('');
    try {
      const res = await fetch('/api/wholesaler/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, phoneOnly: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update phone');
      setSuccessMsg('Contact phone number updated successfully.');
      logActivity("UPDATE_WHOLESALER_PHONE", `Updated phone to ${phone}`);
    } catch (err: any) {
      setError(err.message || 'Error updating phone');
    } finally {
      setPhoneLoading(false);
    }
  };

  // Full Profile Submit
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/wholesaler/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          taxId,
          address,
          phone,
          registrationNumber,
          contactPerson,
          latitude: parseFloat(latitude) || null,
          longitude: parseFloat(longitude) || null,
          customFieldsJson: JSON.stringify(customFields),
          registrationImages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile.");

      setSuccessMsg("Company Profile & registration documents submitted successfully. Verification status set to PENDING.");
      if (typeof window !== "undefined") {
        setTimeout(() => { window.location.reload(); }, 1400);
      }
      logActivity(
        "UPDATE_PROFILE",
        `Updated company profile & submitted for verification. Company: ${companyName}, Tax ID: ${taxId}`,
      );
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTheme = (mode: 'light' | 'dark') => {
    setThemeMode(mode);
    localStorage.setItem('theme', mode);
    if (mode === 'dark') document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  };

  const handleToggleFontScale = (scale: 'sm' | 'md' | 'lg') => {
    setFontScale(scale);
    localStorage.setItem('font_scale', scale);
    document.body.classList.remove('font-sm', 'font-md', 'font-lg');
    document.body.classList.add(`font-${scale}`);
  };

  const handleSaveTimeout = (val: string) => {
    setInactivityTimeout(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("wholesaler_inactivity_timeout", val);
      setSuccessMsg(`Session inactivity timeout updated to ${val === "never" ? "Never" : `${val} minutes`}.`);
    }
  };

  const handleSaveAlerts = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("medhub_low_stock_threshold_boxes", lowStockBoxes.toString());
      localStorage.setItem("medhub_low_stock_threshold_strips", lowStockStrips.toString());
      localStorage.setItem("medhub_low_stock_threshold_tablets", lowStockTablets.toString());
      localStorage.setItem("medhub_expiry_alert_days", expiryAlertDays.toString());
      setSuccessMsg("Alert threshold settings saved successfully.");
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    setCustomFields([...customFields, { label: newFieldLabel.trim(), value: newFieldValue.trim() }]);
    setNewFieldLabel("");
    setNewFieldValue("");
    setShowAddFieldForm(false);
  };

  const handleDeleteCustomField = (label: string) => {
    setCustomFields(customFields.filter((f) => f.label !== label));
  };

  // Staff Handlers
  const handleOpenCreateStaff = () => {
    setEditingStaff(null); setStaffEmail(""); setStaffPassword(""); setStaffFullName("");
    setStaffFeatures(AVAILABLE_FEATURES.map(f => f.key)); setStaffIsActive(true); setError(""); setSuccessMsg("");
    setShowStaffModal(true);
  };

  const handleOpenEditStaff = (emp: StaffUser) => {
    setEditingStaff(emp); setStaffEmail(emp.email); setStaffPassword(""); setStaffFullName(emp.fullName || "");
    setStaffFeatures(emp.allowedFeatures.split(",")); setStaffIsActive(emp.isActive);
    setError(""); setSuccessMsg(""); setShowStaffModal(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccessMsg("");
    if (!staffEmail || !staffFullName || (!editingStaff && !staffPassword)) {
      setError("Please fill all required staff fields"); return;
    }
    try {
      setLoading(true);
      const url = editingStaff ? `/api/wholesaler/staff/${editingStaff.id}` : '/api/wholesaler/staff';
      const method = editingStaff ? 'PUT' : 'POST';
      const payload: any = { email: staffEmail, fullName: staffFullName, allowedFeatures: staffFeatures.join(','), isActive: staffIsActive };
      if (staffPassword) payload.password = staffPassword;

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save staff member');
      setSuccessMsg(editingStaff ? 'Staff account updated' : 'New staff member registered');
      setShowStaffModal(false);
      if (typeof window !== 'undefined') setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      setError(err.message || 'Error saving staff');
    } finally { setLoading(false); }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Delete employee: "${name}"?`)) return;
    try {
      const res = await fetch(`/api/wholesaler/staff/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { setSuccessMsg(`Account "${name}" deleted.`); setTimeout(() => window.location.reload(), 1200); }
      else setError(data.error || 'Failed to delete staff account');
    } catch (err: any) { setError(err.message || 'Error deleting staff account'); }
  };

  const toggleFeature = (key: string) => {
    setStaffFeatures(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter ? log.action === actionFilter : true;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)));

  const verStatusBadge = isVerified ? { bg: '#F0FDF4', border: '#BBF7D0', color: '#059669', icon: '✅', text: 'VERIFIED & ACTIVE' }
    : isPending ? { bg: '#FFFBEB', border: '#FDE68A', color: '#D97706', icon: '⏳', text: 'PENDING REVIEW' }
    : isRejected ? { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626', icon: '❌', text: 'REJECTED' }
    : { bg: '#F0F9FF', border: '#BAE6FD', color: '#0369A1', icon: '📝', text: 'NOT SUBMITTED' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100vh', width: '100%' }}>

      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--card-border)', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Distributor Control & Profile Settings</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Manage company registration, warehouse GPS, staff accounts, alert thresholds & audit logs.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 800, background: verStatusBadge.bg, color: verStatusBadge.color, border: `1px solid ${verStatusBadge.border}` }}>
            {verStatusBadge.icon} {verStatusBadge.text}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px' }}>
            <Calendar style={{ width: 15, height: 15, color: '#0EA5E9' }} />
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>License Expiry</div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: 1 }}>
                {subscriptionEnd ? formatDateNPT(subscriptionEnd) : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Buttons */}
      <div style={{ display: 'flex', gap: 6, background: 'var(--table-header-bg)', padding: 4, borderRadius: 8, border: '1px solid var(--card-border)', flexWrap: 'wrap' }}>
        {hasProfileAccess && (
          <button
            onClick={() => { setActiveTab('profile'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === 'profile' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'profile' ? '#0EA5E9' : 'var(--text-secondary)',
              boxShadow: activeTab === 'profile' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            🏢 Profile & Registration
          </button>
        )}
        {isOwner && (
          <button
            onClick={() => { setActiveTab('staff'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === 'staff' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'staff' ? '#0EA5E9' : 'var(--text-secondary)',
              boxShadow: activeTab === 'staff' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            👥 Staff Accounts ({staffList.length})
          </button>
        )}
        <button
          onClick={() => { setActiveTab('security'); setError(''); setSuccessMsg(''); }}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
            background: activeTab === 'security' ? 'var(--card-bg)' : 'transparent',
            color: activeTab === 'security' ? '#0EA5E9' : 'var(--text-secondary)',
            boxShadow: activeTab === 'security' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          🔒 Security & Alerts
        </button>
        {hasLogsAccess && (
          <button
            onClick={() => { setActiveTab('logs'); setError(''); setSuccessMsg(''); }}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === 'logs' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'logs' ? '#0EA5E9' : 'var(--text-secondary)',
              boxShadow: activeTab === 'logs' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            📋 Activity Logs
          </button>
        )}
        <button
          onClick={() => { setActiveTab('theme'); setError(''); setSuccessMsg(''); }}
          style={{
            padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
            background: activeTab === 'theme' ? 'var(--card-bg)' : 'transparent',
            color: activeTab === 'theme' ? '#0EA5E9' : 'var(--text-secondary)',
            boxShadow: activeTab === 'theme' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
          }}
        >
          🎨 Appearance
        </button>
      </div>

      {/* Messages */}
      {successMsg && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, color: '#10B981', fontSize: 13, fontWeight: 600 }}>
          <CheckCircle style={{ width: 16, height: 16 }} /><span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
          <AlertCircle style={{ width: 16, height: 16 }} /><span>{error}</span>
        </div>
      )}

      {/* ── PROFILE & REGISTRATION TAB ── */}
      {activeTab === 'profile' && hasProfileAccess && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Verification Status Banners */}
          {isVerified && !isEditingVerifiedDetails && (
            <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#ECFDF5)', border: '1.5px solid #86EFAC', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 26 }}>✅</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#065F46' }}>Distributor Account Verified & Active</div>
                  <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>Company details are locked. Contact phone number can be updated anytime. To edit other company information, click <strong>Unlock & Re-verify</strong>.</div>
                </div>
              </div>
              {isOwner && (
                <button onClick={() => setIsEditingVerifiedDetails(true)}
                  style={{ padding: '8px 16px', background: '#D97706', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <Lock style={{ width: 13, height: 13 }} /> Unlock & Re-verify
                </button>
              )}
            </div>
          )}

          {isVerified && isEditingVerifiedDetails && (
            <div style={{ background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 12, padding: '12px 18px', fontSize: 12, color: '#92400E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <span>⚠ <strong>Edit Mode Active:</strong> Saving changes to company profile details or license images will set your status to <strong>PENDING</strong> for Superadmin re-review.</span>
            </div>
          )}

          {isPending && (
            <div style={{ background: 'linear-gradient(135deg,#FFFBEB,#FEF9C3)', border: '1.5px solid #FDE68A', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 26 }}>⏳</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>Verification Under Review</div>
                <div style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>Superadmin is reviewing your registration documents. Profile fields are locked. You can still update your <strong>Contact Phone Number</strong> below.</div>
              </div>
            </div>
          )}

          {isRejected && (
            <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 26 }}>❌</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#991B1B' }}>Verification Rejected</div>
                  <div style={{ fontSize: 12, color: '#DC2626', marginTop: 2 }}>Please update your information or documents below and resubmit for verification.</div>
                </div>
              </div>
              {registrationData?.verificationRejectReason && (
                <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#7F1D1D' }}>
                  <strong>Rejection Reason:</strong> {registrationData.verificationRejectReason}
                </div>
              )}
            </div>
          )}

          {/* Contact Phone Number — Always Editable */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Phone style={{ width: 16, height: 16, color: '#10B981' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Contact Phone Number</span>
              <span style={{ fontSize: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#059669', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>ALWAYS EDITABLE</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!isOwner} style={{ ...inputStyle, flex: 1 }} placeholder="e.g. 98xxxxxxxx" />
              {isOwner && (
                <button type="button" onClick={handleSavePhoneOnly} disabled={phoneLoading} style={{ ...btnStyle, background: '#10B981', flexShrink: 0 }}>
                  {phoneLoading ? '...' : <><Check style={{ width: 14, height: 14 }} /> Save Phone</>}
                </button>
              )}
            </div>
          </div>

          {/* Core Profile Form */}
          <form onSubmit={handleUpdateProfile} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building style={{ width: 16, height: 16, color: '#0EA5E9' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Distributor Identity & Location</span>
                {fieldsLocked && (
                  <span style={{ fontSize: 10, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#D97706', padding: '1px 7px', borderRadius: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Lock style={{ width: 10, height: 10 }} /> LOCKED
                  </span>
                )}
              </div>
              {fieldsLocked && isOwner && (
                <button type="button" onClick={() => setIsEditingVerifiedDetails(true)}
                  style={{ ...btnStyle, background: '#D97706', fontSize: 12, padding: '6px 14px' }}>
                  <Edit2 style={{ width: 13, height: 13 }} /> Edit & Resubmit Application
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Company Name *</label>
                <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={fieldsLocked} style={fieldsLocked ? lockedInputStyle : inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>VAT / TAX ID Number *</label>
                <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} disabled={fieldsLocked} style={fieldsLocked ? lockedInputStyle : inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Registration / License Number</label>
                <input type="text" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} disabled={fieldsLocked} style={fieldsLocked ? lockedInputStyle : inputStyle} placeholder="e.g. REG-98234-DIST" />
              </div>
              <div>
                <label style={labelStyle}>Contact Person Name</label>
                <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} disabled={fieldsLocked} style={fieldsLocked ? lockedInputStyle : inputStyle} placeholder="e.g. Harry Prasad" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Warehouse Street Address *</label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} disabled={fieldsLocked} style={fieldsLocked ? lockedInputStyle : inputStyle} required />
              </div>
            </div>

            {/* GPS Location Section */}
            <div style={{ background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin style={{ width: 16, height: 16, color: '#0EA5E9' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Warehouse Location (GPS)</span>
                </div>
                {!fieldsLocked && isOwner && (
                  <button type="button" onClick={() => setShowMapModal(true)}
                    style={{ ...btnStyle, background: '#0EA5E9', fontSize: 12, padding: '7px 14px' }}>
                    <MapPin style={{ width: 13, height: 13 }} /> Set from Map
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Latitude</label>
                  <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)} disabled={fieldsLocked} style={{ ...(fieldsLocked ? lockedInputStyle : inputStyle), fontFamily: 'monospace' }} placeholder="e.g. 27.7172" />
                </div>
                <div>
                  <label style={labelStyle}>Longitude</label>
                  <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)} disabled={fieldsLocked} style={{ ...(fieldsLocked ? lockedInputStyle : inputStyle), fontFamily: 'monospace' }} placeholder="e.g. 85.3240" />
                </div>
              </div>
              {latitude && longitude && (
                <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: '#0EA5E9', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Navigation style={{ width: 11, height: 11 }} /> Verify on Google Maps ↗
                </a>
              )}
            </div>

            {/* Custom Fields */}
            {!fieldsLocked && isOwner && (
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
                <span style={labelStyle}>Custom / Dynamic Parameters</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {customFields.map((field) => (
                    <div key={field.label} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120, color: 'var(--text-secondary)' }}>{field.label}</span>
                      <input type="text" value={field.value} onChange={(e) => { const val = e.target.value; setCustomFields(customFields.map((f) => f.label === field.label ? { ...f, value: val } : f)); }} style={{ ...inputStyle, flex: 1 }} />
                      <button type="button" onClick={() => handleDeleteCustomField(field.label)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  ))}
                </div>
                {showAddFieldForm ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <input type="text" placeholder="Field Name (e.g. Website)" value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <input type="text" placeholder="Value" value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={handleAddCustomField} style={btnStyle}>Add</button>
                    <button type="button" onClick={() => setShowAddFieldForm(false)} style={{ ...btnStyle, background: 'var(--table-header-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>Cancel</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowAddFieldForm(true)} style={{ ...btnStyle, background: 'var(--table-header-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)', marginTop: 10, fontSize: 12 }}>
                    <Plus style={{ width: 13, height: 13 }} /> Add Custom Parameter
                  </button>
                )}
              </div>
            )}

            {/* Registration Documents */}
            <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ ...labelStyle, fontSize: 12, marginBottom: 2 }}>📷 Registration & License Documents</span>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                    Company registration, VAT/PAN certificate, citizenship, warehouse license (Max 500MB each, up to 10 images)
                  </p>
                </div>
                {registrationImages.length > 0 && (
                  <button type="button" onClick={() => { setDocViewerIndex(0); setShowDocViewer(true); }}
                    style={{ ...btnStyle, background: '#0EA5E9', fontSize: 12, padding: '7px 14px' }}>
                    <Eye style={{ width: 13, height: 13 }} /> View Documents ({registrationImages.length})
                  </button>
                )}
              </div>

              {/* Upload Grid */}
              <input type="file" accept="image/*" multiple id="wholesaler-doc-upload-input" style={{ display: 'none' }}
                onChange={async (e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  setUploadingDoc(true);
                  const { compressImageToBase64 } = await import('@/lib/imageCompressor');
                  for (let i = 0; i < files.length; i++) {
                    if (registrationImages.length >= 10) { alert('Maximum 10 images allowed.'); break; }
                    try {
                      const compressed = await compressImageToBase64(files[i]);
                      setRegistrationImages(prev => [...prev, compressed]);
                    } catch (err) { console.error(err); }
                  }
                  setUploadingDoc(false);
                  e.target.value = '';
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {registrationImages.map((src, idx) => (
                  <div key={idx} onClick={() => { setDocViewerIndex(idx); setShowDocViewer(true); }}
                    style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', border: '2px solid var(--card-border)', position: 'relative', cursor: 'zoom-in', flexShrink: 0 }}>
                    <img src={src} alt={`Doc ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {!fieldsLocked && isOwner && (
                      <button type="button" onClick={(ev) => { ev.stopPropagation(); setRegistrationImages(prev => prev.filter((_, i) => i !== idx)); }}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ✕
                      </button>
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center', padding: '2px 0' }}>
                      {idx + 1}
                    </div>
                  </div>
                ))}
                {!fieldsLocked && isOwner && registrationImages.length < 10 && (
                  <label htmlFor="wholesaler-doc-upload-input"
                    style={{ width: 72, height: 72, borderRadius: 8, border: '2px dashed #0EA5E9', background: 'rgba(14,165,233,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0EA5E9', fontSize: 10, fontWeight: 700, textAlign: 'center', gap: 4, flexShrink: 0 }}>
                    <Upload style={{ width: 18, height: 18 }} />
                    {uploadingDoc ? '...' : `Upload\n(${registrationImages.length}/10)`}
                  </label>
                )}
                {registrationImages.length === 0 && fieldsLocked && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No documents uploaded yet.</span>
                )}
              </div>
            </div>

            {/* Submit / CTA Button */}
            {!fieldsLocked && isOwner && (
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="submit" disabled={loading} style={{ ...btnStyle, flex: '0 0 auto' }}>
                  <Send style={{ width: 14, height: 14 }} />
                  {loading ? 'Submitting...' : isRejected || !registrationData ? 'Submit for Verification' : 'Save & Resubmit for Verification'}
                </button>
                {isEditingVerifiedDetails && (
                  <button type="button" onClick={() => setIsEditingVerifiedDetails(false)}
                    style={{ ...btnStyle, background: 'var(--table-header-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)', flex: '0 0 auto' }}>
                    Cancel Edit
                  </button>
                )}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                  {isRejected ? 'Fix the issues and resubmit for Superadmin review.' : 'Submitting will set your status to PENDING for Superadmin review.'}
                </span>
              </div>
            )}
          </form>
        </div>
      )}

      {/* ── STAFF TAB ── */}
      {activeTab === 'staff' && isOwner && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Configure distributor internal accounts for sales & warehouse management.</span>
            <button onClick={handleOpenCreateStaff} style={btnStyle}>
              <Plus style={{ width: 15, height: 15 }} /> Add Staff Employee
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
                    <th style={thStyle}>Login Email</th>
                    <th style={thStyle}>Authorized Tabs</th>
                    <th style={thStyle}>Status</th>
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
                            <span key={f} style={{ fontSize: 11, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', padding: '2px 6px', borderRadius: 4, fontWeight: 600, color: 'var(--text-secondary)' }}>{f}</span>
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
          <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Session Auto-Logout Timer</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Automatically sign out after a period of inactivity to protect your account.</p>
            <select value={inactivityTimeout} onChange={(e) => handleSaveTimeout(e.target.value)} style={{ ...inputStyle, marginTop: 12 }}>
              <option value="15">15 minutes of inactivity</option>
              <option value="30">30 minutes of inactivity</option>
              <option value="60">60 minutes of inactivity (Default)</option>
              <option value="120">120 minutes of inactivity</option>
              <option value="never">Never (Disabled)</option>
            </select>
          </div>
          <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Low-Stock Warning Thresholds</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Warn when available distributor inventory drops below limits.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div><label style={labelStyle}>BOXES</label><input type="number" value={lowStockBoxes} onChange={(e) => setLowStockBoxes(parseInt(e.target.value) || 0)} style={inputStyle} /></div>
              <div><label style={labelStyle}>STRIPS</label><input type="number" value={lowStockStrips} onChange={(e) => setLowStockStrips(parseInt(e.target.value) || 0)} style={inputStyle} /></div>
              <div><label style={labelStyle}>TABLETS</label><input type="number" value={lowStockTablets} onChange={(e) => setLowStockTablets(parseInt(e.target.value) || 0)} style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>EXPIRY ALERT WARN THRESHOLD (DAYS)</label><input type="number" value={expiryAlertDays} onChange={(e) => setExpiryAlertDays(parseInt(e.target.value) || 0)} style={inputStyle} /></div>
            <button onClick={handleSaveAlerts} style={{ ...btnStyle, alignSelf: 'flex-end' }}>Save Threshold Rules</button>
          </div>
        </div>
      )}

      {/* ── APPEARANCE TAB ── */}
      {activeTab === 'theme' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🌗 Interface Theme</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 14 }}>Choose between light and dark mode for the distributor dashboard.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => handleToggleTheme('light')} style={{
                flex: 1, padding: '14px 10px', borderRadius: 10,
                border: themeMode === 'light' ? '2px solid #0EA5E9' : '1px solid var(--card-border)',
                background: themeMode === 'light' ? '#F0F9FF' : 'var(--card-bg)',
                color: themeMode === 'light' ? '#0369A1' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 28 }}>☀️</span>
                Light Mode
                {themeMode === 'light' && <span style={{ fontSize: 10, background: '#0EA5E9', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>ACTIVE</span>}
              </button>
              <button type="button" onClick={() => handleToggleTheme('dark')} style={{
                flex: 1, padding: '14px 10px', borderRadius: 10,
                border: themeMode === 'dark' ? '2px solid #0EA5E9' : '1px solid var(--card-border)',
                background: themeMode === 'dark' ? '#1E293B' : 'var(--card-bg)',
                color: themeMode === 'dark' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 28 }}>🌙</span>
                Dark Mode
                {themeMode === 'dark' && <span style={{ fontSize: 10, background: '#0EA5E9', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>ACTIVE</span>}
              </button>
            </div>
          </div>
          <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>🔤 Font Size Scale</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 14 }}>Adjust the base font size of all dashboard text.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              {([
                { key: 'sm', label: 'Small', desc: 'Compact, more content visible' },
                { key: 'md', label: 'Medium', desc: 'Default balanced size' },
                { key: 'lg', label: 'Large', desc: 'Easier to read, larger text' },
              ] as const).map(s => (
                <button key={s.key} type="button" onClick={() => handleToggleFontScale(s.key)} style={{
                  flex: 1, padding: '14px 10px', borderRadius: 10,
                  border: fontScale === s.key ? '2px solid #0EA5E9' : '1px solid var(--card-border)',
                  background: fontScale === s.key ? '#F0F9FF' : 'var(--card-bg)',
                  color: fontScale === s.key ? '#0369A1' : 'var(--text-secondary)',
                  fontWeight: 700, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: s.key === 'sm' ? 18 : s.key === 'md' ? 22 : 28, fontWeight: 700 }}>Aa</span>
                  <span style={{ fontSize: 13 }}>{s.label}</span>
                  <span style={{ fontSize: 10, color: fontScale === s.key ? '#0369A1' : 'var(--text-muted)', textAlign: 'center' }}>{s.desc}</span>
                  {fontScale === s.key && <span style={{ fontSize: 10, background: '#0EA5E9', color: '#fff', padding: '2px 8px', borderRadius: 10, marginTop: 2 }}>ACTIVE</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── LOGS TAB ── */}
      {activeTab === 'logs' && hasLogsAccess && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 10, border: '1px solid var(--card-border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--table-header-bg)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)' }}>
              <Search style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
              <input type="text" placeholder="Search audit logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--text-primary)' }} />
            </div>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--card-border)', fontSize: 13, outline: 'none', background: 'var(--table-header-bg)', color: 'var(--text-secondary)' }}>
              <option value="">All Actions</option>
              {uniqueActions.map((act) => <option key={act} value={act}>{act}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto' }}>
            {filteredLogs.map((log) => (
              <div key={log.id} style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: 12, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: log.action.includes('ERR') || log.action.includes('DELETE') ? '#FEF2F2' : '#F0FDF4', color: log.action.includes('ERR') || log.action.includes('DELETE') ? '#EF4444' : '#10B981' }}>{log.action}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatDateTimeNPT(log.timestamp)}</span>
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>{log.details}</div>
                {log.user && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                    By: <strong>{log.user.fullName || log.user.email}</strong> ({log.user.role})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STAFF MODAL ── */}
      {showStaffModal && (
        <div onClick={() => setShowStaffModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--table-header-bg)' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{editingStaff ? 'Update Employee Permissions' : 'Register New Staff Member'}</span>
              <button onClick={() => setShowStaffModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
              <form onSubmit={handleSaveStaff} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={labelStyle}>Full Name</label><input type="text" required value={staffFullName} onChange={(e) => setStaffFullName(e.target.value)} placeholder="e.g. Ram Kumar" style={inputStyle} /></div>
                <div><label style={labelStyle}>Email Address (Login ID)</label><input type="email" required disabled={!!editingStaff} value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="e.g. ram@distributor.com" style={{ ...inputStyle, background: editingStaff ? 'var(--table-header-bg)' : 'var(--card-bg)' }} /></div>
                <div><label style={labelStyle}>Password {editingStaff && '(Leave blank to keep current)'}</label><input type="password" required={!editingStaff} value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder="••••••••" style={inputStyle} /></div>
                <div>
                  <label style={labelStyle}>Authorized Dashboard Tabs</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--table-header-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--card-border)' }}>
                    {AVAILABLE_FEATURES.map((feat) => (
                      <label key={feat.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={staffFeatures.includes(feat.key)} onChange={() => toggleFeature(feat.key)} style={{ cursor: 'pointer' }} />{feat.label}
                      </label>
                    ))}
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
                  <button type="submit" disabled={loading} style={{ flex: 2, padding: 10, border: 'none', background: '#0EA5E9', color: '#FFFFFF', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {loading ? 'Processing…' : 'Save Employee Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── MAP MODAL ── */}
      {showMapModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 720, background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden', boxShadow: '0 32px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--table-header-bg)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin style={{ width: 16, height: 16, color: '#0EA5E9' }} />
                <span style={{ fontSize: 15, fontWeight: 800 }}>Set Warehouse Location from Map</span>
              </div>
              <button onClick={() => { setShowMapModal(false); setMapSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)', background: 'var(--card-bg)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: '8px 12px' }}>
                  <Search style={{ width: 14, height: 14, color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search for a warehouse, place, or address..."
                    value={mapSearchQuery}
                    onChange={(e) => setMapSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleMapSearch()}
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13, color: 'var(--text-primary)' }}
                  />
                </div>
                <button onClick={handleMapSearch} disabled={mapSearchLoading} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0EA5E9', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {mapSearchLoading ? '...' : 'Search'}
                </button>
              </div>
              {mapSearchResults.length > 0 && (
                <div style={{ marginTop: 6, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  {mapSearchResults.map((r, i) => (
                    <button key={i} onClick={() => handleSelectMapResult(r)}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', borderBottom: i < mapSearchResults.length - 1 ? '1px solid var(--card-border)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--table-header-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ fontWeight: 600 }}>{r.display_name.split(',')[0]}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.display_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div ref={mapContainerRef} style={{ flex: 1, minHeight: 360, background: '#E5E7EB' }}>
              {!leafletLoaded && (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  Loading map...
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--table-header-bg)', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                📍 Click on map or drag marker to set location.{mapPickedLat !== null && <span style={{ marginLeft: 8, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{mapPickedLat?.toFixed(5)}, {mapPickedLng?.toFixed(5)}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setShowMapModal(false); setMapSearchResults([]); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleConfirmMapLocation} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#10B981', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Confirm Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENT VIEWER MODAL ── */}
      {showDocViewer && registrationImages.length > 0 && (
        <div onClick={() => { if (!docZoomed) setShowDocViewer(false); }} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 680, background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '94vh', overflow: 'hidden', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--table-header-bg)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileImage style={{ width: 16, height: 16, color: '#0EA5E9' }} />
                <span style={{ fontSize: 14, fontWeight: 800 }}>Registration & License Documents</span>
                <span style={{ fontSize: 11, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                  {docViewerIndex + 1} / {registrationImages.length}
                </span>
              </div>
              <button onClick={() => setShowDocViewer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', position: 'relative', minHeight: 320 }}>
              <img
                src={registrationImages[docViewerIndex]}
                alt={`Document ${docViewerIndex + 1}`}
                onClick={() => setDocZoomed(!docZoomed)}
                style={{
                  maxWidth: docZoomed ? '100%' : '90%',
                  maxHeight: docZoomed ? 'none' : 420,
                  objectFit: 'contain',
                  cursor: 'zoom-in',
                  borderRadius: docZoomed ? 0 : 8,
                  transition: 'all 0.2s',
                }}
              />
              {docViewerIndex > 0 && (
                <button onClick={() => setDocViewerIndex(i => i - 1)}
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                  <ChevronLeft style={{ width: 20, height: 20 }} />
                </button>
              )}
              {docViewerIndex < registrationImages.length - 1 && (
                <button onClick={() => setDocViewerIndex(i => i + 1)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                  <ChevronRight style={{ width: 20, height: 20 }} />
                </button>
              )}
              <div style={{ position: 'absolute', bottom: 10, right: 12, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '4px 8px', color: 'rgba(255,255,255,0.6)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <ZoomIn style={{ width: 11, height: 11 }} /> Click image to zoom
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: 8, overflowX: 'auto', background: 'var(--table-header-bg)', flexShrink: 0 }}>
              {registrationImages.map((src, idx) => (
                <div key={idx} onClick={() => setDocViewerIndex(idx)}
                  style={{ width: 56, height: 56, borderRadius: 7, overflow: 'hidden', border: `2px solid ${idx === docViewerIndex ? '#0EA5E9' : 'var(--card-border)'}`, flexShrink: 0, cursor: 'pointer', opacity: idx === docViewerIndex ? 1 : 0.6, transition: 'all 0.15s', position: 'relative' }}>
                  <img src={src} alt={`Thumb ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Document {docViewerIndex + 1} of {registrationImages.length}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={registrationImages[docViewerIndex]} target="_blank" rel="noopener noreferrer"
                  style={{ ...btnStyle, background: '#0EA5E9', fontSize: 12, padding: '7px 14px', textDecoration: 'none' }}>
                  <Eye style={{ width: 13, height: 13 }} /> Open Full Size
                </a>
                {!fieldsLocked && isOwner && (
                  <button onClick={() => { setRegistrationImages(prev => prev.filter((_, i) => i !== docViewerIndex)); setDocViewerIndex(i => Math.min(i, registrationImages.length - 2)); }}
                    style={{ ...btnStyle, background: '#EF4444', fontSize: 12, padding: '7px 14px' }}>
                    <Trash2 style={{ width: 13, height: 13 }} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
