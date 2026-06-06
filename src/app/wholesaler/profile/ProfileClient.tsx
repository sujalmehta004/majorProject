'use client';

import React, { useState } from 'react';
import { 
  User, Building, FileText, Phone, MapPin, Calendar, 
  CheckCircle, AlertCircle, RefreshCw, Key, ShieldAlert, Navigation, Plus, Trash
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

interface ProfileClientProps {
  userRole: string;
  initialProfile: WholesalerProfile;
  subscriptionEnd: string;
}

// Simulated grid locations in Kathmandu
const KATHMANDU_GRID = [
  { name: 'Maharajgunj', lat: 27.7340, lng: 85.3300 },
  { name: 'Bansbari', lat: 27.7420, lng: 85.3350 },
  { name: 'Balaju', lat: 27.7280, lng: 85.3050 },
  { name: 'Thamel', lat: 27.7150, lng: 85.3120 },
  { name: 'Lazimpat', lat: 27.7220, lng: 85.3180 },
  { name: 'Kantipath', lat: 27.7120, lng: 85.3210 },
  { name: 'Putalisadak', lat: 27.7040, lng: 85.3240 },
  { name: 'Baneshwor', lat: 27.6910, lng: 85.3420 },
  { name: 'Koteshwor', lat: 27.6780, lng: 85.3490 },
  { name: 'Lalitpur City', lat: 27.6710, lng: 85.3220 },
  { name: 'Javalakhel', lat: 27.6740, lng: 85.3115 },
  { name: 'Swayambhu', lat: 27.7160, lng: 85.2900 }
];

export default function ProfileClient({ userRole, initialProfile, subscriptionEnd }: ProfileClientProps) {
  const [profile, setProfile] = useState<WholesalerProfile>(initialProfile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [taxId, setTaxId] = useState(profile.taxId);
  const [address, setAddress] = useState(profile.address);
  const [phone, setPhone] = useState(profile.phone);
  const [registrationNumber, setRegistrationNumber] = useState(profile.registrationNumber || '');
  const [contactPerson, setContactPerson] = useState(profile.contactPerson || '');
  const [latitude, setLatitude] = useState(profile.latitude ? profile.latitude.toString() : '27.7172');
  const [longitude, setLongitude] = useState(profile.longitude ? profile.longitude.toString() : '85.3240');

  // Dynamic Custom Fields State
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

  const isOwner = userRole === 'WHOLESALER';

  // Get location via Geolocation API
  const handleGetLocation = () => {
    if (!isOwner) return;
    setError('');
    setSuccessMsg('');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
          setSuccessMsg('GPS coordinates captured from browser geolocation API!');
          logActivity('FETCH_GPS_LOCATION', `Retrieved browser coordinates: [${position.coords.latitude}, ${position.coords.longitude}]`);
        },
        (err) => {
          console.error(err);
          setError('Browser Geolocation request rejected. Please verify browser location permissions.');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setError('Geolocation services not supported in this browser version.');
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

  // Add a dynamic field box
  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    
    // Check if label already exists
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

  // Delete a custom field
  const handleDeleteCustomField = (label: string) => {
    setCustomFields(customFields.filter(f => f.label !== label));
    logActivity('DELETE_CUSTOM_FIELD', `Removed dynamic custom field: "${label}"`);
  };

  // Update a custom field's value in state
  const handleCustomFieldValueChange = (label: string, newValue: string) => {
    setCustomFields(customFields.map(f => 
      f.label === label ? { ...f, value: newValue } : f
    ));
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-[0_15px_30px_rgba(0,0,0,0.01)]">
        <div>
          <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">Distributor Profile Settings</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Manage warehouse contact details, registration codes, configure store GPS coordinates, and add custom information boxes.</p>
        </div>
      </div>

      {/* Owner Warning */}
      {!isOwner && (
        <div className="p-4 border border-amber-200 bg-amber-50 text-amber-650 text-xs rounded-2xl flex items-center gap-2 font-medium">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Only the primary distributor owner account can modify store profiles, GPS coordinates, and custom fields. Staff access is read-only.</span>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-655 text-xs rounded-2xl flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 border border-emerald-200 bg-emerald-50 text-emerald-655 text-xs rounded-2xl flex items-center gap-2 font-mono">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT: Details Form */}
        <div className="lg:col-span-7 border border-slate-200 bg-white rounded-3xl p-6 shadow-sm">
          <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-4.5 h-4.5 text-sky-500" />
            Distributor Details Form
          </h3>

          <form onSubmit={handleUpdateProfile} className="space-y-5 text-xs font-semibold">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-500 uppercase mb-1 font-bold">Company Name</label>
                <input
                  type="text"
                  required
                  disabled={!isOwner}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-60 text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-zinc-500 uppercase mb-1 font-bold">VAT / Tax ID Number</label>
                <input
                  type="text"
                  required
                  disabled={!isOwner}
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-60 font-mono text-sm transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-500 uppercase mb-1 font-bold">Registration / License Number</label>
                <input
                  type="text"
                  placeholder="e.g. REG-98234-DIST"
                  disabled={!isOwner}
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-60 font-mono text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-zinc-500 uppercase mb-1 font-bold">Contact Person Name</label>
                <input
                  type="text"
                  placeholder="e.g. Harry Prasad"
                  disabled={!isOwner}
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-60 text-sm transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-500 uppercase mb-1 font-bold">Contact Phone Number</label>
                <input
                  type="text"
                  required
                  disabled={!isOwner}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-60 font-mono text-sm transition-all"
                />
              </div>
              <div>
                <label className="block text-zinc-500 uppercase mb-1 font-bold">Warehouse Street Address</label>
                <input
                  type="text"
                  required
                  disabled={!isOwner}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-60 text-sm transition-all"
                />
              </div>
            </div>

            {/* GPS coordinates with Capture button */}
            <div className="border-t border-slate-100 pt-4 space-y-3.5">
              <div className="flex justify-between items-center">
                <span className="block text-zinc-550 uppercase font-bold text-[10.5px] tracking-wider">Store GPS Coordinates:</span>
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    className="py-2 px-4 rounded-xl border border-sky-200 hover:border-sky-350 bg-sky-50 text-sky-655 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 animate-pulse" />
                    Use My GPS Location
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 uppercase mb-1 font-bold">Latitude Coordinate</label>
                  <input
                    type="text"
                    disabled
                    value={latitude}
                    className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-3.5 py-3 text-zinc-500 cursor-not-allowed font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 uppercase mb-1 font-bold">Longitude Coordinate</label>
                  <input
                    type="text"
                    disabled
                    value={longitude}
                    className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-3.5 py-3 text-zinc-500 cursor-not-allowed font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* DYNAMIC CUSTOM FIELDS BOX */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="block text-zinc-550 uppercase font-bold text-[10.5px] tracking-wider">Dynamic Profile Fields:</span>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setShowAddFieldForm(!showAddFieldForm)}
                    className="py-1.5 px-3 rounded-xl border border-pink-200 hover:border-pink-305 bg-pink-50 text-pink-650 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Custom Field
                  </button>
                )}
              </div>

              {showAddFieldForm && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3 shadow-inner">
                  <div className="text-[10px] font-black uppercase text-zinc-450 border-b border-slate-150 pb-1.5">Configure Dynamic Input Box</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                    <div>
                      <label className="block text-zinc-500 mb-1">Field Label (e.g. Website)</label>
                      <input
                        type="text"
                        placeholder="Label"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-500 mb-1">Field Value (e.g. medhub.com)</label>
                      <input
                        type="text"
                        placeholder="Value"
                        value={newFieldValue}
                        onChange={(e) => setNewFieldValue(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      className="py-1.5 px-3 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg transition-all text-[10.5px] uppercase cursor-pointer"
                    >
                      Add Box
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddFieldForm(false)}
                      className="py-1.5 px-3 border border-slate-250 bg-white text-zinc-650 rounded-lg hover:bg-slate-50 transition-all text-[10.5px] uppercase cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* List of custom fields */}
              {customFields.length === 0 ? (
                <div className="text-center py-5 border border-dashed border-slate-200 rounded-2xl text-zinc-400 italic text-[11px]">
                  No dynamic form boxes added yet. Use the button to extend your profile configuration.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {customFields.map((field) => (
                    <div key={field.label} className="bg-slate-50/50 border border-slate-150 p-3.5 rounded-2xl flex flex-col justify-between gap-1.5 relative group">
                      <div className="flex justify-between items-start">
                        <label className="block text-zinc-450 uppercase text-[9.5px] font-bold truncate max-w-[80%]">{field.label}</label>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomField(field.label)}
                            className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3 top-3 cursor-pointer"
                            title="Remove Field"
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
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-zinc-900 text-xs focus:outline-none"
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
                className="w-full py-4 bg-gradient-to-r from-sky-400 to-pink-400 hover:from-sky-500 hover:to-pink-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-sm hover:shadow transition-all duration-300 flex justify-center items-center gap-2 cursor-pointer font-mono"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                Save Distributor Settings
              </button>
            )}
          </form>
        </div>

        {/* RIGHT: GPS Location Kathmandu Grid Picker */}
        <div className="lg:col-span-5 space-y-6">
          <div className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider mb-2 flex items-center gap-2 border-b border-slate-100 pb-3">
                <MapPin className="w-4.5 h-4.5 text-pink-400" />
                Grid Location Selector (Kathmandu)
              </h3>
              <p className="text-[10px] text-zinc-450 leading-relaxed font-medium mb-4">
                Select your warehouse location on the Kathmandu city map below. Click on any sector to update your coordinates.
              </p>

              <div className="grid grid-cols-3 gap-2.5 bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
                {KATHMANDU_GRID.map((loc) => {
                  const isSelected = 
                    Math.abs(parseFloat(latitude) - loc.lat) < 0.001 && 
                    Math.abs(parseFloat(longitude) - loc.lng) < 0.001;

                  return (
                    <button
                      key={loc.name}
                      type="button"
                      disabled={!isOwner}
                      onClick={() => handleGridSelect(loc)}
                      className={`p-3 border rounded-2xl text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-sky-400 bg-sky-50 text-sky-655 font-bold shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-350 hover:bg-slate-50 text-zinc-650'
                      }`}
                    >
                      <div className="text-[10.5px] uppercase font-bold tracking-tight truncate">{loc.name}</div>
                      <div className="text-[7.5px] text-zinc-400 font-mono font-bold mt-1">
                        [{loc.lat.toFixed(3)}, {loc.lng.toFixed(3)}]
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl mt-6 space-y-1.5 text-[11px] font-medium font-mono text-zinc-550">
              <div className="flex justify-between">
                <span>Selected Grid:</span>
                <span className="text-sky-655 font-bold">
                  {KATHMANDU_GRID.find(l => Math.abs(parseFloat(latitude) - l.lat) < 0.001 && Math.abs(parseFloat(longitude) - l.lng) < 0.001)?.name || 'Custom GPS'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Latitude:</span>
                <span className="text-zinc-800 font-bold">{latitude}</span>
              </div>
              <div className="flex justify-between">
                <span>Longitude:</span>
                <span className="text-zinc-800 font-bold">{longitude}</span>
              </div>
            </div>
          </div>

          {/* Lease Plan card */}
          <div className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm space-y-3 bg-gradient-to-br from-white to-pink-50/10">
            <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calendar className="w-4.5 h-4.5 text-sky-500 animate-pulse" />
              Store subscription lease
            </h3>
            
            <div className="text-xs space-y-2 font-medium">
              <div className="flex justify-between">
                <span className="text-zinc-450">Lease Plan:</span>
                <span className="text-sky-600 font-bold">FREE EVALUATION (365 days)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-450">Expiration Date:</span>
                <span className="text-zinc-800 font-mono font-bold">
                  {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-450">Lease Price:</span>
                <span className="text-emerald-500 font-mono font-bold">Rs. 0 / Year</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
