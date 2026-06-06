import React from 'react';
import { db } from '@/lib/db';
import Link from 'next/link';
import { LogOut, ShieldCheck, Users, Building, Activity } from 'lucide-react';
import SuperadminClient from './SuperadminClient';

export const dynamic = 'force-dynamic';

export default async function SuperadminMatrixDashboard() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      wholesalerProfile: true,
      retailerProfile: true,
      clinicProfile: true,
    },
  });

  const logs = await db.systemAuditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 300,
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
          role: true,
        }
      }
    }
  });

  const serializedUsers = JSON.parse(JSON.stringify(users));
  const serializedLogs = JSON.parse(JSON.stringify(logs));

  const stats = [
    { label: 'Total Accounts', value: users.length, icon: Users, color: '#818CF8', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)' },
    { label: 'Distributors', value: users.filter(u => u.role === 'WHOLESALER').length, icon: Building, color: '#38BDF8', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.25)' },
    { label: 'Pharmacies', value: users.filter(u => u.role === 'RETAILER').length, icon: Activity, color: '#34D399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' },
    { label: 'Active Leases', value: users.filter(u => u.isActive).length, icon: ShieldCheck, color: '#FB923C', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)' },
  ];

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0A0F1E 0%, #0F172A 40%, #0D1B3E 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '32px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow effects */}
      <div style={{ position: 'absolute', top: '-200px', right: '-100px', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-200px', left: '-100px', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto' }}>

        {/* Top Nav Bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck style={{ width: 22, height: 22, color: '#818CF8' }} />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#818CF8', fontFamily: 'monospace', marginBottom: 2 }}>
                ● SYSTEM DIAGNOSTICS
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>
                Matrix Control Dashboard
              </h1>
            </div>
          </div>
          <Link href="/" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700,
            textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.05em',
            transition: 'all 0.2s',
          }}>
            <LogOut style={{ width: 14, height: 14 }} />
            Exit Admin
          </Link>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {stats.map(({ label, value, icon: Icon, color, bg, border }) => (
            <div key={label} style={{
              background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: '20px 24px',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `rgba(255,255,255,0.08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 20, height: 20, color }} />
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: 'white', fontFamily: 'monospace', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Client Component */}
        <SuperadminClient initialUsers={serializedUsers} initialLogs={serializedLogs} />
      </div>
    </main>
  );
}
