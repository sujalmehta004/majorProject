import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const retailer = await db.retailerProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!retailer) {
      return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
    }

    // 1. Unique products in retail inventory
    const productsCount = await db.retailerInventory.count({
      where: {
        retailerId: retailer.id,
        quantity: { gt: 0 },
      },
    });

    // 2. Total base units of stock
    const stockAgg = await db.retailerInventory.aggregate({
      where: {
        retailerId: retailer.id,
        quantity: { gt: 0 },
      },
      _sum: {
        quantity: true,
      },
    });
    const totalStockQty = stockAgg._sum.quantity || 0;

    // 3. Pending B2B purchases from wholesalers
    const pendingPurchases = await db.order.count({
      where: {
        retailerId: retailer.id,
        status: { in: ['PENDING', 'PICKING', 'DISPATCHED'] },
      },
    });

    // 4. Completed B2B orders
    const completedPurchases = await db.order.count({
      where: {
        retailerId: retailer.id,
        status: 'DELIVERED',
      },
    });

    // 5. Expiring soon in retail inventory (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const nearExpiryCount = await db.retailerInventory.count({
      where: {
        retailerId: retailer.id,
        quantity: { gt: 0 },
        expiryDate: { lte: thirtyDaysFromNow, gt: new Date() },
      },
    });

    // 6. Recent audit logs for this user
    const auditLogs = await db.systemAuditLog.findMany({
      take: 6,
      orderBy: { timestamp: 'desc' },
      where: { userId: user.userId },
    });

    return NextResponse.json({
      success: true,
      metrics: {
        productsCount,
        totalStockQty,
        pendingPurchases,
        completedPurchases,
        nearExpiryCount,
        creditLimit: retailer.creditLimit,
        lifetimeSpend: retailer.lifetimeSpend,
        pharmacyName: retailer.pharmacyName,
      },
      auditLogs,
    });
  } catch (error: any) {
    console.error('Error loading retailer dashboard data:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
