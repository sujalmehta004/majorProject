import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = await db.order.findUnique({
      where: { id },
      include: {
        inTransitLogs: {
          include: {
            batch: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isRetailer = user.role === 'RETAILER';
    const isWholesaler = user.role === 'WHOLESALER' || user.role === 'WHOLESALER_STAFF';

    if (!isRetailer && !isWholesaler) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 401 });
    }

    const retailer = await db.retailerProfile.findUnique({
      where: { id: order.retailerId },
    });

    if (!retailer) {
      return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
    }

    if (isRetailer) {
      const retailerUser = await db.retailerProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!retailerUser || retailerUser.id !== order.retailerId) {
        return NextResponse.json({ error: 'Unauthorized order access' }, { status: 403 });
      }
    }

    if (order.status !== OrderStatus.DISPATCHED) {
      return NextResponse.json({ error: 'Order is not in DISPATCHED state' }, { status: 400 });
    }

    // Atomic cross-table transaction for delivery confirmation handshake
    const confirmedOrder = await db.$transaction(async (tx) => {
      // 1. Update order status to DELIVERED
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.DELIVERED },
      });

      // 2. Map transit log entries to RetailerInventory
      for (const transit of order.inTransitLogs) {
        // Upsert into RetailerInventory
        await tx.retailerInventory.upsert({
          where: {
            retailerId_productId_batchNumber: {
              retailerId: retailer.id,
              productId: transit.productId,
              batchNumber: transit.batch.batchNumber,
            },
          },
          update: {
            quantity: {
              increment: transit.quantity,
            },
          },
          create: {
            retailerId: retailer.id,
            productId: transit.productId,
            batchNumber: transit.batch.batchNumber,
            quantity: transit.quantity,
            expiryDate: transit.batch.expiryDate,
          },
        });
      }

      // 3. Delete in-transit logs for this order
      await tx.inTransitLog.deleteMany({
        where: { orderId: order.id },
      });

      // 4. Record audit log
      await tx.systemAuditLog.create({
        data: {
          action: 'DELIVERY_CONFIRM',
          userId: user.userId,
          details: `Retailer ${retailer.pharmacyName} confirmed delivery for Order ${order.id}. Stock entries transferred to retail inventory.`,
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, order: confirmedOrder });
  } catch (error: any) {
    console.error('Error confirming order delivery:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
