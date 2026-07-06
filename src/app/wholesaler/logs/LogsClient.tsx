'use client';

import React, { useState } from 'react';
import {
  FileText, Search, Filter, RefreshCw, XCircle, Activity
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

  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueUsers = Array.from(new Set(logs.map(log => log.user?.email).filter(Boolean)));

  const handleRefresh = async () => {
    setLoading(true);
    try {
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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

  const hasFilters = searchTerm || actionFilter || userFilter;

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Page Header — matches dashboard style */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16,
        background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(186,230,253,0.5)', borderRadius: 20,
        padding: '20px 24px', boxShadow: '0 2px 12px rgba(14,165,233,0.07)',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity style={{ width: 22, height: 22, color: '#F97316' }} />
            Audit Trail Database
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            Chronological record of system accesses, order allocations, and POS checkout invoices.
          </p>
        </div>
        <button onClick={handleRefresh} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw style={{ width: 14, height: 14, color: '#F97316' }} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter Panel */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {/* Text search */}
        <div className="filter-field">
          <label className="filter-label">
            <Search style={{ width: 10, height: 10 }} />
            Search Description
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g. pos checkout..."
            className="filter-input"
          />
        </div>

        {/* Action type */}
        <div className="filter-field">
          <label className="filter-label">Action Type</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Actions</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Operator dropdown */}
        <div className="filter-field">
          <label className="filter-label">Operator Email</label>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Operators</option>
            {uniqueUsers.map(email => (
              <option key={email} value={email}>{email}</option>
            ))}
          </select>
        </div>

        {/* Clear */}
        <div style={{ flexShrink: 0, minWidth: 120 }}>
          {hasFilters ? (
            <button onClick={clearFilters} className="btn-danger" style={{ width: '100%', height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11 }}>
              <XCircle style={{ width: 13, height: 13 }} />
              Clear Filters
            </button>
          ) : (
            <div style={{ height: 32, padding: '0 12px', background: 'rgba(241,245,249,0.5)', border: '1px solid rgba(226,232,240,0.5)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, textTransform: 'uppercase' }}>
              No Filters
            </div>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card" style={{ background: 'rgba(255,255,255,0.85)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 12, marginBottom: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0EA5E9', display: 'inline-block' }} />
            Ledger Output — {filteredLogs.length} entries
          </h3>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace', textTransform: 'uppercase', background: 'var(--table-header-bg)', border: '1px solid var(--card-border)', padding: '3px 10px', borderRadius: 8 }}>
            SYNCED
          </span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action Token</th>
                <th>Operator</th>
                <th>Detailed Description</th>
                <th>Security Role</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 14 }}>
                    No registered audit logs matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isStaff = log.user?.role === 'WHOLESALER_STAFF';
                  const timestampStr = new Date(log.timestamp).toLocaleString();

                  return (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{timestampStr}</td>
                      <td>
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', fontFamily: 'monospace',
                          color: '#C2410C', background: '#FFF7ED', border: '1px solid #FED7AA',
                          padding: '2px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                        }}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                          {log.user?.fullName || log.user?.email.split('@')[0] || 'System'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                          {log.user?.email || 'system@medhub.com'}
                        </div>
                      </td>
                      <td style={{ fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details}>
                        {log.details}
                      </td>
                      <td>
                        <span className={`status-pill ${
                          isStaff
                            ? 'status-pill-pending'
                            : log.user?.role === 'WHOLESALER'
                            ? 'status-pill-active'
                            : 'status-pill-inactive'
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
