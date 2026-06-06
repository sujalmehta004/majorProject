'use client';

import React, { useState } from 'react';
import { 
  FileText, Search, Filter, Calendar, RefreshCw, XCircle, ChevronRight, User, ShieldAlert
} from 'lucide-react';
import { logActivity } from '@/components/WholesalerLayout';

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

interface LogsClientProps {
  initialLogs: AuditLog[];
}

export default function LogsClient({ initialLogs }: LogsClientProps) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  // Extract unique actions & users for filters
  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueUsers = Array.from(new Set(logs.map(log => log.user?.email).filter(Boolean)));

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // Simple page reload to pull fresh logs
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Filter logs locally
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
    <div className="space-y-8 animate-fadeIn">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-[0_15px_30px_rgba(0,0,0,0.01)]">
        <div>
          <h2 className="text-xl font-black text-zinc-950 uppercase tracking-tight">Audit Trail Database</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Chronological record of system accesses, coordinate modifications, order allocations, and POS checkout invoices.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-3 rounded-2xl border border-slate-200 bg-white hover:border-slate-350 text-zinc-550 hover:text-zinc-800 transition-all shadow-sm cursor-pointer self-start sm:self-auto"
          title="Refresh Logs"
        >
          <RefreshCw className={`${loading ? 'animate-spin' : ''} w-4 h-4`} />
        </button>
      </div>

      {/* Filter panel */}
      <div className="border border-slate-200 bg-white p-5 rounded-3xl shadow-sm space-y-4">
        <div className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Filter className="w-4 h-4 text-sky-500" />
          Filter Action Ledger
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold">
          {/* Text search */}
          <div>
            <label className="block text-zinc-550 mb-1">Search Description</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g. coordinates, pos checkout..."
              className="w-full bg-slate-50 border border-slate-250 rounded-2xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:border-sky-400 text-xs"
            />
          </div>

          {/* Action type */}
          <div>
            <label className="block text-zinc-555 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250 rounded-2xl px-3.5 py-2.5 text-zinc-900 focus:outline-none text-xs"
            >
              <option value="">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {/* Operator dropdown */}
          <div>
            <label className="block text-zinc-555 mb-1">Operator Email</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-255 rounded-2xl px-3.5 py-2.5 text-zinc-900 focus:outline-none text-xs"
            >
              <option value="">All Operators</option>
              {uniqueUsers.map(email => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </div>

          {/* Clear filters button */}
          <div className="flex items-end">
            {(searchTerm || actionFilter || userFilter) ? (
              <button
                type="button"
                onClick={clearFilters}
                className="w-full py-2.5 border border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-650 rounded-2xl flex justify-center items-center gap-1.5 cursor-pointer transition-colors text-xs font-extrabold uppercase tracking-wider"
              >
                <XCircle className="w-4 h-4" />
                Clear Filters
              </button>
            ) : (
              <div className="text-[10px] text-zinc-400 italic py-3 text-center w-full bg-slate-50 border border-slate-100 rounded-2xl font-mono">
                NO ACTIVE LEDGER FILTERS
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit table logs */}
      <div className="border border-slate-200 bg-white rounded-3xl shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 p-5 flex justify-between items-center">
          <div className="text-xs uppercase font-extrabold text-zinc-800 tracking-wider flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-sky-400"></span>
            Ledger Output: showing {filteredLogs.length} entries
          </div>
          <span className="text-[9.5px] text-zinc-400 font-mono font-bold bg-white px-2 py-1 border border-slate-150 rounded-lg">
            SYNCED
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/20 text-zinc-450 uppercase text-[9px] tracking-wider font-bold">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Action Token</th>
                <th className="p-4">Operator details</th>
                <th className="p-4">Detailed Description</th>
                <th className="p-4">Security Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-zinc-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-zinc-400 font-mono italic">
                    NO REGISTERED AUDIT LOGS MATCHING SEARCH CRITERIA.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isStaff = log.user?.role === 'WHOLESALER_STAFF';
                  const timestampStr = new Date(log.timestamp).toLocaleString();

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="p-4 font-mono text-zinc-450 whitespace-nowrap">{timestampStr}</td>
                      <td className="p-4">
                        <span className="text-sky-655 font-bold uppercase text-[9px] border border-sky-100 bg-sky-50 px-2 py-0.5 rounded-lg font-mono">
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-zinc-850">
                          {log.user?.fullName || log.user?.email.split('@')[0] || 'System'}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {log.user?.email || 'system@medhub.com'}
                        </div>
                      </td>
                      <td className="p-4 text-xs font-semibold text-zinc-800 font-sans leading-relaxed">
                        {log.details}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-bold border uppercase tracking-wider font-mono ${
                          isStaff 
                            ? 'bg-pink-50 border-pink-100 text-pink-655' 
                            : log.user?.role === 'WHOLESALER'
                            ? 'bg-sky-50 border-sky-200 text-sky-655'
                            : 'bg-slate-50 border-slate-200 text-zinc-400'
                        }`}>
                          {log.user ? (isStaff ? 'STAFF' : 'OWNER') : 'SYSTEM'}
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
    </div>
  );
}
