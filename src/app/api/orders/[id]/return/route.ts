import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { broadcastToWholesaler } from '@/app/api/events/route';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = id;
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

    const body = await request.json();
    // items: [{ orderItemId: string, quantity: number, reason: string }]
    // adjustBilling: boolean — if true, credit refund value as advance balance
    const { items, reason, adjustBilling = false } = body;

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

    const finalItems = (items && Array.isArray(items) && items.length > 0)
      ? items
      : order.items.map(i => ({ orderItemId: i.id, quantity: i.quantity }));

    // ── Calculate refund value ──────────────────────────────────────────────
    // For each returned item, refund value = returned_qty * (pricePerUnit * tabletsPerBox)
    let refundValue = 0;

    if (adjustBilling) {
      for (const returnItem of finalItems) {
        const { orderItemId, quantity } = returnItem;
        const orderItem = order.items.find(i => i.id === orderItemId);
        if (!orderItem) continue;

        // quantity in order is in base units (tablets); returnItem.quantity is boxes
        // pricePerUnit is per tablet, so refund = quantity_boxes * tabletsPerBox * pricePerUnit
        // But actually the returnItem.quantity from UI is in boxes; convert to tablets via allocations
        const product = await db.product.findUnique({ where: { id: orderItem.productId } });
        const tabletsPerBox = product ? product.tabletsPerStrip * product.stripsPerBox : 1;
        const tabletsReturned = quantity * tabletsPerBox;
        const itemRefund = Math.min(tabletsReturned, orderItem.quantity) * orderItem.pricePerUnit;
        refundValue += itemRefund;
      }
    }

    // Process each return item
    await db.$transaction(async (tx) => {
      for (const returnItem of finalItems) {
        const { orderItemId, quantity } = returnItem;

        // Find the order item with its allocations
        const orderItem = order.items.find((i) => i.id === orderItemId);
        if (!orderItem) continue;

        // Fetch product for tabletsPerBox conversion
        const product = await tx.product.findUnique({ where: { id: orderItem.productId } });
        const tabletsPerBox = product ? product.tabletsPerStrip * product.stripsPerBox : 1;
        // Convert boxes returned to tablets (base units)
        const tabletsToRestore = quantity * tabletsPerBox;

        // Restore stock to the original batch(es) via allocations
        let remainingToRestore = tabletsToRestore;
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

      // Credit advance balance if adjustBilling is requested
      if (adjustBilling && refundValue > 0) {
        // Upsert relation so advance balance is updated for this wholesaler-retailer pair
        await tx.wholesalerRetailerRelation.upsert({
          where: {
            wholesalerId_retailerId: {
              wholesalerId,
              retailerId: order.retailerId,
            },
          },
          create: {
            wholesalerId,
            retailerId: order.retailerId,
            creditLimit: 0,
            advanceBalance: refundValue,
          },
          update: {
            advanceBalance: { increment: refundValue },
          },
        });
      }

      // Log the return
      await tx.systemAuditLog.create({
        data: {
          action: 'PRODUCT_RETURN',
          userId: user.userId,
          details: `Return processed for Order ${orderId.substring(0, 8).toUpperCase()} — ${order.retailer.pharmacyName}. Reason: ${reason || 'Not specified'}.${adjustBilling && refundValue > 0 ? ` Advance balance credited: Rs.${refundValue.toFixed(2)}.` : ''} Items returned to inventory.`,
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

    return NextResponse.json({
      success: true,
      message: 'Products returned to inventory successfully.',
      refundValue: adjustBilling ? refundValue : 0,
      advanceBalanceCredited: adjustBilling && refundValue > 0,
    });
  } catch (error: any) {
    console.error('Return API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
