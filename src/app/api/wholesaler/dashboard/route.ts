import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({ where: { id: user.userId } });

    let profile = null;
    if (user.role === 'WHOLESALER') {
      profile = await db.wholesalerProfile.findUnique({ where: { userId: user.userId } });
    } else if (user.role === 'WHOLESALER_STAFF' && dbUser?.wholesalerId) {
      profile = await db.wholesalerProfile.findUnique({ where: { id: dbUser.wholesalerId } });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const [
      productCount,
      activeBatches,
      pendingOrders,
      dispatchedOrders,
      nearExpiryCount,
      staffCount,
    ] = await Promise.all([
      db.product.count({ where: { wholesalerId: profile.id } }),
      db.inventoryBatch.count({
        where: {
          product: { wholesalerId: profile.id },
          availableBaseUnits: { gt: 0 },
          expiryDate: { gt: new Date() },
        },
      }),
      db.order.count({ where: { wholesalerId: profile.id, status: 'PENDING' } }),
      db.order.count({ where: { wholesalerId: profile.id, status: 'DISPATCHED' } }),
      db.inventoryBatch.count({
        where: {
          product: { wholesalerId: profile.id },
          availableBaseUnits: { gt: 0 },
          expiryDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gt: new Date(),
          },
        },
      }),
      db.user.count({ where: { wholesalerId: profile.id, role: 'WHOLESALER_STAFF' } }),
    ]);

    // Revenue & profit from delivered orders
    const deliveredOrders = await db.order.findMany({
      where: { wholesalerId: profile.id, status: 'DELIVERED' },
      include: {
        items: {
          include: { allocations: { include: { batch: true } } },
        },
      },
    });

    let totalRevenue = 0;
    let estimatedProfit = 0;
    deliveredOrders.forEach((o) => {
      totalRevenue += o.netAmount;
      let cost = 0;
      o.items.forEach((item) => {
        item.allocations.forEach((alloc) => {
          cost += alloc.quantity * alloc.batch.manufacturingCost;
        });
      });
      estimatedProfit += o.netAmount - cost;
    });

    // Audit logs
    const staffUsers = await db.user.findMany({
      where: { wholesalerId: profile.id },
      select: { id: true },
    });
    const staffUserIds = staffUsers.map((s) => s.id);
    const auditLogs = await db.systemAuditLog.findMany({
      take: 6,
      orderBy: { timestamp: 'desc' },
      where: { userId: { in: [profile.userId, ...staffUserIds] } },
      include: { user: true },
    });

    // Pending & rejected settlements
    const [pendingSettlements, rejectedSettlements] = await Promise.all([
      db.order.findMany({
        where: { wholesalerId: profile.id, settleStatus: 'PENDING_VERIFICATION' },
        include: { retailer: true, b2bSettlements: true, items: { include: { product: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      db.order.findMany({
        where: { wholesalerId: profile.id, settleStatus: 'REJECTED' },
        include: { retailer: true, b2bSettlements: true, items: { include: { product: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      success: true,
      metrics: {
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
        verificationStatus: dbUser?.verificationStatus || 'PENDING',
        verificationRejectReason: dbUser?.verificationRejectReason || null,
      },
      auditLogs: JSON.parse(JSON.stringify(auditLogs)),
      pendingSettlements: JSON.parse(JSON.stringify(pendingSettlements)),
      rejectedSettlements: JSON.parse(JSON.stringify(rejectedSettlements)),
    });
  } catch (error: any) {
    console.error('Error fetching wholesaler dashboard:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
