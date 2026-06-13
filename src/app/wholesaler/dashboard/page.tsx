import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WholesalerLayout from '@/components/WholesalerLayout';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function WholesalerDashboard() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
    redirect('/');
  }

  // Load the wholesaler profile dynamically (check if user is owner or staff)
  let profile = null;
  let dbUser = await db.user.findUnique({
    where: { id: user.userId },
  });

  if (user.role === 'WHOLESALER') {
    profile = await db.wholesalerProfile.findUnique({
      where: { userId: user.userId },
    });
  } else if (user.role === 'WHOLESALER_STAFF' && dbUser?.wholesalerId) {
    profile = await db.wholesalerProfile.findUnique({
      where: { id: dbUser.wholesalerId },
    });
  }

  if (!profile) {
    redirect('/subscription-expired'); 
  }

  // Fetch summary statistics
  const productCount = await db.product.count({
    where: { wholesalerId: profile.id },
  });

  const activeBatches = await db.inventoryBatch.count({
    where: {
      product: { wholesalerId: profile.id },
      availableBaseUnits: { gt: 0 },
      expiryDate: { gt: new Date() },
    },
  });

  const pendingOrders = await db.order.count({
    where: {
      wholesalerId: profile.id,
      status: 'PENDING',
    },
  });

  const dispatchedOrders = await db.order.count({
    where: {
      wholesalerId: profile.id,
      status: 'DISPATCHED',
    },
  });

  // Calculate near expiry count (expiring in next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const nearExpiryCount = await db.inventoryBatch.count({
    where: {
      product: { wholesalerId: profile.id },
      availableBaseUnits: { gt: 0 },
      expiryDate: { lte: thirtyDaysFromNow, gt: new Date() },
    },
  });

  // Fetch staff count
  const staffCount = await db.user.count({
    where: {
      wholesalerId: profile.id,
      role: 'WHOLESALER_STAFF',
    },
  });

  // Load B2B orders to calculate revenue and estimated profits
  const orders = await db.order.findMany({
    where: { wholesalerId: profile.id },
    include: {
      items: {
        include: {
          allocations: {
            include: {
              batch: true,
            },
          },
        },
      },
    },
  });

  let totalRevenue = 0;
  let estimatedProfit = 0;
  orders.forEach((o) => {
    if (o.status === 'DELIVERED') {
      totalRevenue += o.netAmount;
      let cost = 0;
      o.items.forEach((item) => {
        item.allocations.forEach((alloc) => {
          cost += alloc.quantity * alloc.batch.manufacturingCost;
        });
      });
      estimatedProfit += (o.netAmount - cost);
    }
  });

  // Fetch associated staff user IDs to query all related logs safely
  const staffUsers = await db.user.findMany({
    where: { wholesalerId: profile.id },
    select: { id: true },
  });
  const staffUserIds = staffUsers.map((s) => s.id);

  const auditLogs = await db.systemAuditLog.findMany({
    take: 6,
    orderBy: { timestamp: 'desc' },
    where: {
      userId: {
        in: [profile.userId, ...staffUserIds],
      },
    },
    include: {
      user: true,
    },
  });

  const serializedLogs = JSON.parse(JSON.stringify(auditLogs));

  // Fetch pending B2B settlement requests waiting for verification
  const pendingSettlements = await db.order.findMany({
    where: {
      wholesalerId: profile.id,
      settleStatus: 'PENDING_VERIFICATION',
    },
    include: {
      retailer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const rejectedSettlements = await db.order.findMany({
    where: {
      wholesalerId: profile.id,
      settleStatus: 'REJECTED',
    },
    include: {
      retailer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const serializedSettlements = JSON.parse(JSON.stringify(pendingSettlements));
  const serializedRejected = JSON.parse(JSON.stringify(rejectedSettlements));

  return (
    <WholesalerLayout
      user={{
        userId: user.userId,
        email: user.email,
        role: user.role,
        fullName: dbUser?.fullName,
        allowedFeatures: dbUser?.allowedFeatures,
      }}
      profile={{
        id: profile.id,
        companyName: profile.companyName,
        taxId: profile.taxId,
      }}
    >
      <DashboardClient
        profileId={profile.id}
        metrics={{
          productCount,
          activeBatches,
          pendingOrders,
          dispatchedOrders,
          nearExpiryCount,
          totalRevenue,
          estimatedProfit,
          staffCount,
          latitude: profile.latitude,
          longitude: profile.longitude,
          companyName: profile.companyName,
        }}
        auditLogs={serializedLogs}
        pendingSettlements={serializedSettlements}
        rejectedSettlements={serializedRejected}
      />
    </WholesalerLayout>
  );
}
