import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { broadcastToWholesaler } from '@/app/api/events/route';
import { createLedgerEntry } from '@/lib/ledger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user || (user.role !== 'RETAILER' && user.role !== 'RETAILER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await request.json(); // "APPROVED" or "REJECTED"
    if (!status || (status !== 'APPROVED' && status !== 'REJECTED')) {
      return NextResponse.json({ error: 'Invalid verification status' }, { status: 400 });
    }

    const returnRequest = await db.returnRequest.findUnique({
      where: { id },
      include: {
        order: {
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
            wholesaler: true,
            retailer: true,
          },
        },
      },
    });

    if (!returnRequest || returnRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Pending return request not found' }, { status: 404 });
    }

    if (status === 'REJECTED') {
      await db.returnRequest.update({
        where: { id: returnRequest.id },
        data: { status: 'REJECTED' },
      });

      await db.systemAuditLog.create({
        data: {
          action: 'RETURN_REQUEST_REJECTED',
          userId: user.userId,
          details: `Retailer ${returnRequest.order.retailer.pharmacyName} rejected return request for Order #${returnRequest.orderId.substring(0, 8).toUpperCase()}`,
        },
      });

      return NextResponse.json({ success: true, message: 'Return request rejected.' });
    }

    // Process APPROVED return
    const finalItems = JSON.parse(returnRequest.itemsJson);
    const order = returnRequest.order;

    // Calculate refund value
    let refundValue = 0;
    for (const returnItem of finalItems) {
      const { orderItemId, quantity } = returnItem;
      const orderItem = order.items.find(i => i.id === orderItemId);
      if (!orderItem) continue;

      const product = await db.product.findUnique({ where: { id: orderItem.productId } });
      const tabletsPerBox = product ? product.tabletsPerStrip * product.stripsPerBox : 1;
      const tabletsReturned = quantity * tabletsPerBox;
      const itemRefund = Math.min(tabletsReturned, orderItem.quantity) * orderItem.pricePerUnit;
      refundValue += itemRefund;
    }

    // Atomic transaction for return approval
    await db.$transaction(async (tx) => {
      // 1. Process inventory updates on both sides
      for (const returnItem of finalItems) {
        const { orderItemId, quantity } = returnItem;
        const orderItem = order.items.find((i) => i.id === orderItemId);
        if (!orderItem) continue;

        const product = await tx.product.findUnique({ where: { id: orderItem.productId } });
        const tabletsPerBox = product ? product.tabletsPerStrip * product.stripsPerBox : 1;
        const tabletsToRestore = quantity * tabletsPerBox;

        let remainingToRestore = tabletsToRestore;
        for (const allocation of orderItem.allocations) {
          if (remainingToRestore <= 0) break;
          const restoreQty = Math.min(allocation.quantity, remainingToRestore);

          // Deduct from Retailer Inventory
          const retailerInv = await tx.retailerInventory.findFirst({
            where: {
              retailerId: returnRequest.retailerId,
              productId: orderItem.productId,
              batchNumber: allocation.batch.batchNumber,
            },
          });

          if (retailerInv) {
            await tx.retailerInventory.update({
              where: { id: retailerInv.id },
              data: {
                quantity: {
                  decrement: Math.min(retailerInv.quantity, restoreQty),
                },
              },
            });
          }

          // Restore to Wholesaler Batch
          await tx.inventoryBatch.update({
            where: { id: allocation.batchId },
            data: {
              availableBaseUnits: {
                increment: restoreQty,
              },
            },
          });

          remainingToRestore -= restoreQty;
        }
      }

      // 2. Billing / Credit Adjustment
      const isPaid = order.settleStatus === 'VERIFIED' || order.advanceApplied > 0;
      if (returnRequest.adjustBilling && refundValue > 0 && isPaid) {
        await tx.wholesalerRetailerRelation.upsert({
          where: {
            wholesalerId_retailerId: {
              wholesalerId: returnRequest.wholesalerId,
              retailerId: returnRequest.retailerId,
            },
          },
          create: {
            wholesalerId: returnRequest.wholesalerId,
            retailerId: returnRequest.retailerId,
            creditLimit: 200000,
            advanceBalance: refundValue,
          },
          update: {
            advanceBalance: { increment: refundValue },
          },
        });

        // Log to Wholesaler Ledger (Credit to retailer account)
        await createLedgerEntry(tx, {
          partyType: 'WHOLESALER',
          partyId: returnRequest.wholesalerId,
          oppositePartyName: order.retailer.pharmacyName,
          type: 'RETURN',
          credit: refundValue,
          description: `Items returned from delivered Order #${order.id.substring(0, 8).toUpperCase()}. Credit adjusted to advance balance.`,
          orderId: order.id,
        });

        // Log to Retailer Ledger (Credit / Refund received)
        await createLedgerEntry(tx, {
          partyType: 'RETAILER',
          partyId: returnRequest.retailerId,
          oppositePartyName: order.wholesaler.companyName,
          type: 'RETURN',
          credit: refundValue,
          description: `Items returned from delivered Order #${order.id.substring(0, 8).toUpperCase()}. Credit adjusted to advance refund.`,
          orderId: order.id,
        });
      } else {
        // Log basic Return transaction
        await createLedgerEntry(tx, {
          partyType: 'WHOLESALER',
          partyId: returnRequest.wholesalerId,
          oppositePartyName: order.retailer.pharmacyName,
          type: 'RETURN',
          credit: refundValue,
          description: `Items returned from delivered Order #${order.id.substring(0, 8).toUpperCase()}`,
          orderId: order.id,
        });

        await createLedgerEntry(tx, {
          partyType: 'RETAILER',
          partyId: returnRequest.retailerId,
          oppositePartyName: order.wholesaler.companyName,
          type: 'RETURN',
          credit: refundValue,
          description: `Items returned from delivered Order #${order.id.substring(0, 8).toUpperCase()}`,
          orderId: order.id,
        });
      }

      // 3. Update status fields
      await tx.returnRequest.update({
        where: { id: returnRequest.id },
        data: { status: 'APPROVED' },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'RETURNED' as any },
      });

      // 4. Log Audit
      await tx.systemAuditLog.create({
        data: {
          action: 'RETURN_REQUEST_APPROVED',
          userId: user.userId,
          details: `Retailer approved return for Order #${order.id.substring(0, 8).toUpperCase()}. Refund: Rs. ${refundValue.toFixed(2)} credited as advance.`,
        },
      });
    });

    // Broadcast update to Wholesaler dashboard
    broadcastToWholesaler(returnRequest.wholesalerId, 'INVENTORY_UPDATED', { orderId: order.id, type: 'RETURN' });

    return NextResponse.json({
      success: true,
      message: 'Return verification completed and inventory updated.',
    });
  } catch (error: any) {
    console.error('Verify return request error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
