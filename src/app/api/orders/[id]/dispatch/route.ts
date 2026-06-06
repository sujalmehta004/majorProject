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
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            allocations: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PICKING) {
      return NextResponse.json({ error: 'Order is not in pending or picking state' }, { status: 400 });
    }

    // Isolated database transaction for dispatch
    const updatedOrder = await db.$transaction(async (tx) => {
      // 1. Update order status
      const updated = await tx.order.update({
        where: { id },
        data: { status: OrderStatus.DISPATCHED },
      });

      // 2. Populate InTransitLog
      for (const item of order.items) {
        for (const allocation of item.allocations) {
          await tx.inTransitLog.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              batchId: allocation.batchId,
              quantity: allocation.quantity,
            },
          });
        }
      }

      // 3. System audit logging
      await tx.systemAuditLog.create({
        data: {
          action: 'ORDER_DISPATCH',
          userId: user.userId,
          details: `Order ${order.id} updated to DISPATCHED. Stock moved to transit log.`,
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Error dispatching order:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
