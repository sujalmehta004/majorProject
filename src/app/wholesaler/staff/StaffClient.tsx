'use client';

import React, { useState } from 'react';
import { 
  Users, UserPlus, FileText, CheckCircle, AlertCircle, RefreshCw, 
  Trash2, User, Key, Eye, Clock, ShieldAlert, ShieldCheck, Edit, X, ToggleLeft, ToggleRight
} from 'lucide-react';
import { logActivity } from '@/components/WholesalerLayout';

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
    role: string;
    fullName?: string | null;
  } | null;
}

interface StaffClientProps {
  initialStaff: StaffUser[];
  initialLogs: any[];
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

export default function StaffClient({ initialStaff, initialLogs }: StaffClientProps) {
  const [staff, setStaff] = useState<StaffUser[]>(initialStaff);
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State for creating staff
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [allowedFeatures, setAllowedFeatures] = useState<string[]>(
    AVAILABLE_FEATURES.map(f => f.key)
  );

  // Edit Modal State
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editAllowedFeatures, setEditAllowedFeatures] = useState<string[]>([]);
  const [editIsActive, setEditIsActive] = useState(true);

  const refreshData = async () => {
    setLoading(true);
    setError('');
    try {
      const staffRes = await fetch('/api/wholesaler/staff');
      const staffData = await staffRes.json();
      if (!staffRes.ok) throw new Error(staffData.error || 'Failed to fetch employees');
      setStaff(staffData.staff);
      
      // Force reload to get audit logs
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to refresh data.');
    } finally {
      setLoading(false);
    }
  };

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
      
      // Refresh staff list
      const staffRes = await fetch('/api/wholesaler/staff');
      const staffData = await staffRes.json();
      if (staffRes.ok) {
        setStaff(staffData.staff);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create staff.');
    }
  };

  const handleOpenEdit = (emp: StaffUser) => {
    setEditingStaff(emp);
    setEditEmail(emp.email);
    setEditFullName(emp.fullName || '');
    setEditPassword(''); // leave blank by default
    setEditIsActive(emp.isActive);
    setEditAllowedFeatures(emp.allowedFeatures ? emp.allowedFeatures.split(',') : []);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setError('');
    setSuccessMsg('');

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

      // Refresh staff list
      const staffRes = await fetch('/api/wholesaler/staff');
      const staffData = await staffRes.json();
      if (staffRes.ok) {
        setStaff(staffData.staff);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update employee.');
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(`Are you absolutely sure you want to delete staff account: "${name}"? This action cannot be undone.`)) {
      return;
    }

    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/wholesaler/staff/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account.');

      setSuccessMsg(`Staff account "${name}" has been deleted.`);
      
      // Refresh staff list
      const staffRes = await fetch('/api/wholesaler/staff');
      const staffData = await staffRes.json();
      if (staffRes.ok) {
        setStaff(staffData.staff);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete employee.');
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

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-[0_15px_30px_rgba(0,0,0,0.01)]">
        <div>
          <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">Employee Directory & Access Control</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Manage staff login details, view plaintext credentials, configure system feature checklists, or delete accounts.</p>
        </div>
        <button
          onClick={refreshData}
          className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-slate-350 text-zinc-550 hover:text-zinc-800 transition-all shadow-sm cursor-pointer self-start sm:self-auto"
          title="Refresh Data"
        >
          <RefreshCw className={`${loading ? 'animate-spin' : ''} w-4 h-4`} />
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-650 text-xs rounded-2xl flex items-center gap-2 font-mono">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 border border-emerald-200 bg-emerald-50 text-emerald-650 text-xs rounded-2xl flex items-center gap-2 font-mono">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT: Add New Employee Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm bg-gradient-to-b from-white to-slate-50/10">
            <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserPlus className="w-4.5 h-4.5 text-sky-500" />
              Add New Employee
            </h3>

            <form onSubmit={handleCreateStaff} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-zinc-500 uppercase mb-1 font-bold">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ram Bahadur"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-zinc-500 uppercase mb-1 font-bold">Email / Username</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ram@distributor.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-zinc-500 uppercase mb-1 font-bold">Password (Plaintext Visible)</label>
                <input
                  type="text"
                  required
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 shadow-sm font-mono"
                />
              </div>

              {/* Permissions checklist */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <label className="block text-zinc-500 uppercase font-bold text-[10px] tracking-wider mb-2">Allowed Terminal Features:</label>
                <div className="grid grid-cols-1 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  {AVAILABLE_FEATURES.map((f) => {
                    const isChecked = allowedFeatures.includes(f.key);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => handleToggleFeature(f.key)}
                        className="flex items-center gap-2 p-1.5 rounded-lg text-left hover:bg-white transition-colors cursor-pointer text-zinc-700 font-semibold"
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'bg-sky-400 border-sky-400 text-white' : 'border-slate-350 bg-white'}`}>
                          {isChecked && '✓'}
                        </span>
                        <span className="text-[11px]">{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-sky-400 to-pink-400 hover:from-sky-500 hover:to-pink-500 text-white font-extrabold text-xs uppercase tracking-wider transition-all duration-300 rounded-2xl shadow-sm hover:shadow-md cursor-pointer font-mono"
              >
                Register Staff Account
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT: Employee directory & Plaintext passwords list */}
        <div className="lg:col-span-8 space-y-6">
          <div className="border border-slate-200 bg-white rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase text-zinc-800 tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Users className="w-4.5 h-4.5 text-pink-400" />
              Distributor Staff Roster
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staff.length === 0 ? (
                <div className="col-span-2 text-center text-zinc-400 py-10 italic text-xs font-mono">
                  NO STAFF ACCOUNTS REGISTERED YET.
                </div>
              ) : (
                staff.map((emp) => (
                  <div 
                    key={emp.id} 
                    className="p-4 border border-slate-150 rounded-3xl bg-slate-50/30 flex flex-col justify-between gap-4 hover:border-slate-300 transition-all"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <div className="text-zinc-950 font-black text-xs uppercase tracking-wide truncate">{emp.fullName}</div>
                          <div className="text-[10px] text-zinc-450 truncate font-mono mt-0.5">{emp.email}</div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-bold border uppercase tracking-wider font-mono ${
                          emp.isActive ? 'bg-emerald-50 border-emerald-250 text-emerald-600' : 'bg-slate-100 border-slate-300 text-zinc-400'
                        }`}>
                          {emp.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </div>

                      {/* Plaintext Password visualizer */}
                      <div className="bg-slate-100 border border-slate-200/80 p-2 rounded-xl mt-3 flex items-center gap-2 text-[10px] font-mono font-bold text-zinc-650">
                        <Key className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>PASSCODE:</span>
                        <span className="text-zinc-900 select-all font-mono font-extrabold">{emp.plainPassword || 'N/A'}</span>
                      </div>

                      {/* Display of allowed features */}
                      <div className="mt-3.5 space-y-1">
                        <div className="text-[9.5px] uppercase font-bold text-zinc-400 tracking-wider">Features Enabled:</div>
                        <div className="flex flex-wrap gap-1">
                          {emp.allowedFeatures ? (
                            emp.allowedFeatures.split(',').map((f) => (
                              <span 
                                key={f} 
                                className="px-1.5 py-0.5 bg-sky-50 border border-sky-100 text-sky-600 rounded text-[9px] font-bold"
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

                    <div className="flex gap-2 border-t border-slate-100 pt-3.5 justify-end">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(emp)}
                        className="py-1.5 px-3 rounded-lg border border-slate-200 hover:border-slate-350 bg-white text-zinc-700 hover:text-zinc-950 shadow-sm flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-sky-500" />
                        Edit Access
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(emp.id, emp.fullName || emp.email)}
                        className="py-1.5 px-3 rounded-lg border border-slate-200 hover:border-red-200 bg-white hover:bg-red-50 text-zinc-700 hover:text-red-650 shadow-sm flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-pink-400" />
                        Delete Staff
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* EDIT ACCESS CONTROL MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6 no-print">
          <div 
            className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm uppercase text-zinc-950 tracking-wider flex items-center gap-2">
                <Edit className="w-4.5 h-4.5 text-sky-500" />
                Modify Staff Permissions
              </h3>
              <button
                onClick={() => setEditingStaff(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-zinc-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStaff} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-zinc-550 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-550 mb-1">Email / Username</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-550 mb-1">Password (Leave blank to keep current)</label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new plain passcode"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-zinc-900 focus:outline-none font-mono"
                />
              </div>

              <div className="flex justify-between items-center bg-slate-50 border border-slate-150 p-3 rounded-2xl">
                <span className="text-zinc-650 font-bold uppercase text-[10.5px]">Account Status:</span>
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-sky-655"
                >
                  {editIsActive ? (
                    <>
                      <ToggleRight className="w-8 h-8 text-sky-500 cursor-pointer" />
                      <span>ENABLED</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-8 h-8 text-zinc-400 cursor-pointer" />
                      <span className="text-zinc-450">DISABLED</span>
                    </>
                  )}
                </button>
              </div>

              {/* Edit checklist */}
              <div className="space-y-2">
                <label className="block text-zinc-550 mb-1 font-bold uppercase text-[10px] tracking-wider">Features Enabled Checklist:</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  {AVAILABLE_FEATURES.map((f) => {
                    const isChecked = editAllowedFeatures.includes(f.key);
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => handleToggleFeature(f.key, true)}
                        className="flex items-center gap-2 p-1.5 rounded-lg text-left hover:bg-white transition-colors cursor-pointer text-zinc-700 font-semibold"
                      >
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isChecked ? 'bg-sky-400 border-sky-400 text-white' : 'border-slate-350 bg-white'}`}>
                          {isChecked && '✓'}
                        </span>
                        <span className="text-[10.5px]">{f.key}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="submit"
                  className="flex-grow py-3 bg-gradient-to-r from-sky-400 to-pink-400 hover:from-sky-500 hover:to-pink-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow transition-all cursor-pointer font-mono"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="py-3 px-5 border border-slate-200 bg-white hover:bg-slate-50 text-zinc-650 font-bold rounded-2xl transition-colors cursor-pointer"
                >
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
