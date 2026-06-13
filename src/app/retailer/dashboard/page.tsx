import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import RetailerLayout from '@/components/RetailerLayout';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function RetailerDashboard() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'RETAILER' && user.role !== 'RETAILER_STAFF')) {
    redirect('/');
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.userId },
  });

  if (!dbUser) {
    redirect('/');
  }

  let profile = null;
  if (user.role === 'RETAILER') {
    profile = await db.retailerProfile.findUnique({
      where: { userId: user.userId },
    });
  } else if (user.role === 'RETAILER_STAFF' && dbUser.retailerId) {
    profile = await db.retailerProfile.findUnique({
      where: { id: dbUser.retailerId },
    });
    // check features
    const features = dbUser.allowedFeatures.split(',').map(f => f.trim());
    if (!features.includes('Dashboard')) {
      redirect('/');
    }
  }

  if (!profile) {
    redirect('/subscription-expired');
  }

  // Fetch metrics
  const productCount = await db.retailerInventory.count({
    where: {
      retailerId: profile.id,
      quantity: { gt: 0 },
    },
  });

  const stockAgg = await db.retailerInventory.aggregate({
    where: {
      retailerId: profile.id,
      quantity: { gt: 0 },
    },
    _sum: {
      quantity: true,
    },
  });
  const totalStockQty = stockAgg._sum.quantity || 0;

  const pendingPurchases = await db.order.count({
    where: {
      retailerId: profile.id,
      status: { in: ['PENDING', 'PICKING', 'DISPATCHED'] },
    },
  });

  // Calculate near expiry count (expiring in next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const nearExpiryCount = await db.retailerInventory.count({
    where: {
      retailerId: profile.id,
      quantity: { gt: 0 },
      expiryDate: { lte: thirtyDaysFromNow, gt: new Date() },
    },
  });

  // Load B2C sales
  const sales = await db.order.findMany({
    where: {
      retailerId: profile.id,
      overrideJustification: { contains: 'B2C POS' },
    },
  });

  let totalSalesRevenue = sales.reduce((sum, s) => sum + s.netAmount, 0);

  const auditLogs = await db.systemAuditLog.findMany({
    take: 6,
    orderBy: { timestamp: 'desc' },
    where: { userId: user.userId },
  });

  const rejectedSettlements = await db.order.findMany({
    where: {
      retailerId: profile.id,
      settleStatus: 'REJECTED',
    },
    include: {
      wholesaler: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const serializedLogs = JSON.parse(JSON.stringify(auditLogs));
  const serializedRejected = JSON.parse(JSON.stringify(rejectedSettlements));

  return (
    <RetailerLayout
      user={{
        userId: user.userId,
        email: user.email,
        role: user.role,
        fullName: dbUser.fullName || user.email.split('@')[0],
        allowedFeatures: dbUser.allowedFeatures,
      }}
      profile={{
        id: profile.id,
        pharmacyName: profile.pharmacyName,
        registrationNumber: profile.registrationNumber,
      }}
    >
      <DashboardClient
        profileId={profile.id}
        metrics={{
          productCount,
          totalStockQty,
          pendingPurchases,
          nearExpiryCount,
          totalSalesRevenue,
          creditLimit: profile.creditLimit,
          lifetimeSpend: profile.lifetimeSpend,
          pharmacyName: profile.pharmacyName,
        }}
        auditLogs={serializedLogs}
        rejectedSettlements={serializedRejected}
      />
    </RetailerLayout>
  );
}
