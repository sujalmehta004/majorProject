import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { broadcastToWholesaler } from '@/app/api/events/route';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let wholesalerId = '';
    if (user.role === 'WHOLESALER') {
      const wholesaler = await db.wholesalerProfile.findUnique({ where: { userId: user.userId } });
      if (!wholesaler) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      wholesalerId = wholesaler.id;
    } else {
      const dbUser = await db.user.findUnique({ where: { id: user.userId } });
      if (!dbUser?.wholesalerId) return NextResponse.json({ error: 'Association not found' }, { status: 404 });
      wholesalerId = dbUser.wholesalerId;
    }

    const orderId = params.id;
    const body = await request.json();
    // items: [{ orderItemId: string, quantity: number, reason: string }]
    const { items, reason } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Return items are required' }, { status: 400 });
    }

    // Verify the order belongs to this wholesaler
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { allocations: true } },
        retailer: true,
      },
    });

    if (!order || order.wholesalerId !== wholesalerId) {
      return NextResponse.json({ error: 'Order not found or unauthorized' }, { status: 404 });
    }

    // Process each return item
    await db.$transaction(async (tx) => {
      for (const returnItem of items) {
        const { orderItemId, quantity } = returnItem;

        // Find the order item with its allocations
        const orderItem = order.items.find((i) => i.id === orderItemId);
        if (!orderItem) continue;

        // Restore stock to the original batch(es) via allocations (LIFO-ish: restore to most recent)
        let remainingToRestore = quantity;
        for (const allocation of orderItem.allocations) {
          if (remainingToRestore <= 0) break;
          const restoreQty = Math.min(allocation.quantity, remainingToRestore);

          await tx.inventoryBatch.update({
            where: { id: allocation.batchId },
            data: { availableBaseUnits: { increment: restoreQty } },
          });
          remainingToRestore -= restoreQty;
        }
      }

      // Log the return
      await tx.systemAuditLog.create({
        data: {
          action: 'PRODUCT_RETURN',
          userId: user.userId,
          details: `Return processed for Order ${orderId.substring(0, 8).toUpperCase()} — ${order.retailer.pharmacyName}. Reason: ${reason || 'Not specified'}. Items returned to inventory.`,
        },
      });

      // Update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'RETURNED' as any },
      });
    });

    // Broadcast inventory updated
    broadcastToWholesaler(wholesalerId, 'INVENTORY_UPDATED', { orderId, type: 'RETURN' });

    return NextResponse.json({ success: true, message: 'Products returned to inventory successfully.' });
  } catch (error: any) {
    console.error('Return API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
