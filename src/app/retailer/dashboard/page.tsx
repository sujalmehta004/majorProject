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

  // Load B2C sales (POS) with items
  const sales = await db.order.findMany({
    where: {
      retailerId: profile.id,
      overrideJustification: { contains: 'B2C POS' },
    },
    include: { items: true },
  });

  // Load B2C online (consumer) orders
  const consumerOrderPending = await db.consumerOrder.count({
    where: { retailerId: profile.id, status: 'PENDING' },
  });
  const consumerOrderShipped = await db.consumerOrder.count({
    where: { retailerId: profile.id, status: 'SHIPPED' },
  });
  const consumerOrderDelivered = await db.consumerOrder.count({
    where: { retailerId: profile.id, status: 'DELIVERED' },
  });
  const consumerDeliveredRevenue = await db.consumerOrder.aggregate({
    where: { retailerId: profile.id, status: 'DELIVERED' },
    _sum: { totalAmount: true },
  });
  const consumerSalesItems = await db.consumerOrderItem.findMany({
    where: { consumerOrder: { retailerId: profile.id } },
    select: { productId: true, pricePerUnit: true, quantity: true },
  });

  const totalSalesRevenue =
    sales.reduce((sum, s) => sum + s.netAmount, 0) +
    (consumerDeliveredRevenue._sum.totalAmount || 0);

  // Compute item-level profit using inventory buyingPrice (weighted avg per product)
  // NOTE: buyingPrice on RetailerInventory is per BOX, OrderItem.pricePerUnit is per BASE UNIT (tablet).
  // We must convert buyingPrice → per-base-unit by dividing by (tabletsPerStrip × stripsPerBox).
  const inventoryPrices = await db.retailerInventory.findMany({
    where: { retailerId: profile.id },
    select: { productId: true, buyingPrice: true, quantity: true },
  });

  // Collect product dims for unit conversion
  const productIds = [...new Set(inventoryPrices.map((i) => i.productId))];
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, tabletsPerStrip: true, stripsPerBox: true },
  });
  const tabletsPerBoxMap: Record<string, number> = {};
  for (const p of products) {
    tabletsPerBoxMap[p.id] = (p.tabletsPerStrip || 1) * (p.stripsPerBox || 1);
  }

  // Build weighted-average buying price per BASE UNIT per product
  const buyingPricePerUnitMap: Record<string, number> = {};
  const bptMap: Record<string, { tc: number; tq: number }> = {};
  for (const inv of inventoryPrices) {
    if (!bptMap[inv.productId]) bptMap[inv.productId] = { tc: 0, tq: 0 };
    bptMap[inv.productId].tc += inv.buyingPrice * inv.quantity; // buyingPrice is per-box, qty is base units
    bptMap[inv.productId].tq += inv.quantity;
  }
  for (const [pid, val] of Object.entries(bptMap)) {
    const tpb = tabletsPerBoxMap[pid] || 1;
    // weighted avg buying price per box ÷ tabletsPerBox = buying price per base unit
    buyingPricePerUnitMap[pid] = val.tq > 0 ? (val.tc / val.tq) / tpb : 0;
  }

  let totalProfit = 0;
  for (const sale of sales) {
    for (const item of sale.items) {
      const bppu = buyingPricePerUnitMap[item.productId] || 0;
      totalProfit += (item.pricePerUnit - bppu) * item.quantity;
    }
  }
  for (const item of consumerSalesItems) {
    const bppu = buyingPricePerUnitMap[item.productId] || 0;
    totalProfit += (item.pricePerUnit - bppu) * item.quantity;
  }

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

  const returnRequests = await db.returnRequest.findMany({
    where: {
      retailerId: profile.id,
      status: 'PENDING',
    },
    include: {
      order: true,
      wholesaler: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const serializedLogs = JSON.parse(JSON.stringify(auditLogs));
  const serializedRejected = JSON.parse(JSON.stringify(rejectedSettlements));
  const serializedReturns = JSON.parse(JSON.stringify(returnRequests));

  return (
    <RetailerLayout
      user={{
        userId: user.userId,
        email: user.email,
        role: user.role,
        fullName: dbUser.fullName || user.email.split('@')[0],
        allowedFeatures: dbUser.allowedFeatures,
        isVerified: dbUser.isVerified,
        verificationStatus: dbUser.verificationStatus,
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
          totalProfit,
          creditLimit: profile.creditLimit,
          lifetimeSpend: profile.lifetimeSpend,
          pharmacyName: profile.pharmacyName,
          consumerOrderPending,
          consumerOrderShipped,
          consumerOrderDelivered,
          verificationStatus: dbUser.verificationStatus || 'PENDING',
          verificationRejectReason: dbUser.verificationRejectReason || null,
        }}
        auditLogs={serializedLogs}
        rejectedSettlements={serializedRejected}
        pendingReturns={serializedReturns}
      />
    </RetailerLayout>
  );
}
