import React from 'react';
import { db } from '@/lib/db';
import Link from 'next/link';
import { LogOut, ShieldCheck } from 'lucide-react';
import SuperadminClient from './SuperadminClient';

export const dynamic = 'force-dynamic';

export default async function SuperadminMatrixDashboard() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      wholesalerProfile: {
        include: {
          products: { take: 50, include: { batches: true } },
          orders: { take: 50, include: { retailer: true }, orderBy: { createdAt: 'desc' } },
          staff: true,
        }
      },
      retailerProfile: {
        include: {
          inventories: { take: 50, include: { product: true } },
          orders: { take: 50, include: { wholesaler: true }, orderBy: { createdAt: 'desc' } },
          staff: true,
        }
      },
      clinicProfile: true,
      auditLogs: { take: 30, orderBy: { timestamp: 'desc' } }
    },
  });

  const logs = await db.systemAuditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 500,
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
          role: true,
          wholesalerProfile: { select: { companyName: true } },
          retailerProfile: { select: { pharmacyName: true } },
          clinicProfile: { select: { clinicName: true } },
        }
      }
    }
  });

  let packages = await db.subscriptionPackage.findMany({
    orderBy: { price: 'asc' },
  });

  if (packages.length === 0) {
    await db.subscriptionPackage.createMany({
      data: [
        { name: 'Free Plan', price: 0, description: 'Basic Operational License - 365 Days Access', features: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs', isActive: true },
        { name: 'Pro Package', price: 10000, description: 'Priority Support & Custom Invoicing Node', features: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs', isActive: false },
        { name: 'Enterprise Tier', price: 25000, description: 'Multi-Location Enterprise Chain Management', features: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs', isActive: false },
      ],
      skipDuplicates: true,
    });
    packages = await db.subscriptionPackage.findMany({ orderBy: { price: 'asc' } });
  }

  const serializedUsers = JSON.parse(JSON.stringify(users));
  const serializedLogs = JSON.parse(JSON.stringify(logs));
  const serializedPackages = JSON.parse(JSON.stringify(packages));

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top Navigation Bar */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '0 32px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: '#1E293B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck style={{ width: 17, height: 17, color: '#FFFFFF' }} />
          </div>
          <div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
              MedHub
            </span>
            <span style={{ fontSize: 12, color: '#64748B', marginLeft: 8, fontWeight: 500 }}>
              / Admin Console
            </span>
          </div>
        </div>

        <Link href="/api/auth/logout" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px',
          background: '#F1F5F9',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          color: '#475569',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'all 0.15s',
        }}>
          <LogOut style={{ width: 14, height: 14 }} />
          Sign Out
        </Link>
      </header>

      {/* Main Page Content */}
      <div style={{ flex: 1, display: 'flex', width: '100%' }}>
        <SuperadminClient initialUsers={serializedUsers} initialLogs={serializedLogs} initialPackages={serializedPackages} />
      </div>
    </div>
  );
}
