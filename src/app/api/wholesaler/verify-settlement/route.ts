import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

function triggerRevalidation() {
  try {
    revalidatePath('/wholesaler/billing');
    revalidatePath('/wholesaler/customers');
    revalidatePath('/retailer/billing');
    revalidatePath('/retailer/dashboard');
  } catch (e) {
    console.error('Revalidation failed:', e);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, settlementId, approve, amount, method } = await request.json();

    // 1. Locate the settlement record
    let settlement;
    if (settlementId) {
      settlement = await db.b2BSettlement.findUnique({
        where: { id: settlementId },
        include: {
          order: {
            include: {
              retailer: true,
              wholesaler: true,
            },
          },
        },
      });
    } else {
      settlement = await db.b2BSettlement.findFirst({
        where: { orderId, status: 'PENDING' },
        include: {
          order: {
            include: {
              retailer: true,
              wholesaler: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!settlement) {
      // Direct manual payment recording by wholesaler
      if (orderId && amount) {
        const order = await db.order.findUnique({
          where: { id: orderId },
          include: { retailer: true, wholesaler: true },
        });
        if (!order) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const updatedOrder = await db.$transaction(async (tx) => {
          // Create verified settlement
          const directSettle = await tx.b2BSettlement.create({
            data: {
              orderId,
              amount: parseFloat(amount),
              method: method || 'CASH',
              status: 'VERIFIED',
            },
          });

          const allVerified = await tx.b2BSettlement.findMany({
            where: { orderId, status: 'VERIFIED' },
          });

          const totalVerifiedPaid = allVerified.reduce((sum, s) => sum + s.amount, 0);
          const outstanding = order.netAmount - totalVerifiedPaid;
          const newSettleStatus = outstanding <= 0 ? 'VERIFIED' : 'PARTIALLY_PAID';

          const orderResult = await tx.order.update({
            where: { id: orderId },
            data: {
              settleStatus: newSettleStatus,
              settleAmount: totalVerifiedPaid,
            },
          });

          // Create Ledger Entries
          const { createLedgerEntry } = await import('@/lib/ledger');
          
          await createLedgerEntry(tx, {
            partyType: 'WHOLESALER',
            partyId: order.wholesalerId,
            oppositePartyName: order.retailer.pharmacyName,
            type: 'PAYMENT',
            credit: directSettle.amount,
            description: `Manual payment recorded - Rs. ${directSettle.amount.toLocaleString()} via ${directSettle.method} for Order #${order.id.substring(0, 8).toUpperCase()}`,
            orderId: order.id,
          });

          await createLedgerEntry(tx, {
            partyType: 'RETAILER',
            partyId: order.retailerId,
            oppositePartyName: order.wholesaler.companyName,
            type: 'PAYMENT',
            credit: directSettle.amount,
            description: `Manual payment recorded - Rs. ${directSettle.amount.toLocaleString()} via ${directSettle.method} to ${order.wholesaler.companyName} for Order #${order.id.substring(0, 8).toUpperCase()}`,
            orderId: order.id,
          });

          return orderResult;
        });

        await db.systemAuditLog.create({
          data: {
            action: 'B2B_SETTLE_VERIFY',
            userId: user.userId,
            details: `Wholesaler recorded manual payment of Rs. ${amount} for order #${orderId.substring(0, 8)}`,
          },
        });

        triggerRevalidation();
        return NextResponse.json({ success: true, order: updatedOrder });
      }

      // Fallback/Legacy support for orderId directly if no B2BSettlement exists
      if (orderId) {
        const order = await db.order.findUnique({
          where: { id: orderId },
          include: { retailer: true, wholesaler: true },
        });
        if (!order) {
          return NextResponse.json({ error: 'Order/Settlement not found' }, { status: 404 });
        }
        
        if (approve) {
          const updated = await db.$transaction(async (tx) => {
            // Create verified B2BSettlement record
            await tx.b2BSettlement.create({
              data: {
                orderId: orderId,
                amount: order.netAmount,
                method: 'CASH',
                status: 'VERIFIED',
              },
            });

            // Create ledger entries
            const { createLedgerEntry } = await import('@/lib/ledger');
            await createLedgerEntry(tx, {
              partyType: 'WHOLESALER',
              partyId: order.wholesalerId,
              oppositePartyName: order.retailer.pharmacyName,
              type: 'PAYMENT',
              credit: order.netAmount,
              description: `Payment verification (legacy) - Rs. ${order.netAmount.toLocaleString()} received for Order #${order.id.substring(0, 8).toUpperCase()}`,
              orderId: order.id,
            });
            await createLedgerEntry(tx, {
              partyType: 'RETAILER',
              partyId: order.retailerId,
              oppositePartyName: order.wholesaler.companyName,
              type: 'PAYMENT',
              credit: order.netAmount,
              description: `Payment verification (legacy) - Rs. ${order.netAmount.toLocaleString()} paid to ${order.wholesaler.companyName} for Order #${order.id.substring(0, 8).toUpperCase()}`,
              orderId: order.id,
            });

            return tx.order.update({
              where: { id: orderId },
              data: { settleStatus: 'VERIFIED', settleAmount: order.netAmount },
            });
          });

          triggerRevalidation();
          return NextResponse.json({ success: true, order: updated });
        } else {
          const updated = await db.order.update({
            where: { id: orderId },
            data: { settleStatus: 'REJECTED' },
          });
          triggerRevalidation();
          return NextResponse.json({ success: true, order: updated });
        }
      }
      return NextResponse.json({ error: 'Settlement request not found' }, { status: 404 });
    }

    const currentOrderId = settlement.orderId;

    if (approve) {
      const updatedOrder = await db.$transaction(async (tx) => {
        // Mark the current settlement as VERIFIED
        await tx.b2BSettlement.update({
          where: { id: settlement.id },
          data: { status: 'VERIFIED' },
        });

        // Find all verified settlements for this order
        const allVerified = await tx.b2BSettlement.findMany({
          where: { orderId: currentOrderId, status: 'VERIFIED' },
        });

        const totalVerifiedPaid = allVerified.reduce((sum, s) => sum + s.amount, 0);
        const outstanding = settlement.order.netAmount - totalVerifiedPaid;
        const newSettleStatus = outstanding <= 0 ? 'VERIFIED' : 'PARTIALLY_PAID';

        const orderResult = await tx.order.update({
          where: { id: currentOrderId },
          data: {
            settleStatus: newSettleStatus,
            settleAmount: totalVerifiedPaid,
          },
        });

        // Create Ledger Entries
        const { createLedgerEntry } = await import('@/lib/ledger');
        
        // Wholesaler side (receives money, credits retailer account)
        await createLedgerEntry(tx, {
          partyType: 'WHOLESALER',
          partyId: settlement.order.wholesalerId,
          oppositePartyName: settlement.order.retailer.pharmacyName,
          type: 'PAYMENT',
          credit: settlement.amount,
          description: `Payment verification - Rs. ${settlement.amount.toLocaleString()} received via ${settlement.method} for Order #${settlement.order.id.substring(0, 8).toUpperCase()}`,
          orderId: settlement.order.id,
        });

        // Retailer side (pays money, credits wholesaler account)
        await createLedgerEntry(tx, {
          partyType: 'RETAILER',
          partyId: settlement.order.retailerId,
          oppositePartyName: settlement.order.wholesaler.companyName,
          type: 'PAYMENT',
          credit: settlement.amount,
          description: `Payment verification - Rs. ${settlement.amount.toLocaleString()} paid via ${settlement.method} to ${settlement.order.wholesaler.companyName} for Order #${settlement.order.id.substring(0, 8).toUpperCase()}`,
          orderId: settlement.order.id,
        });

        return orderResult;
      });

      await db.systemAuditLog.create({
        data: {
          action: 'B2B_SETTLE_VERIFY',
          userId: user.userId,
          details: `Wholesaler verified payment of Rs. ${settlement.amount} for order #${currentOrderId.substring(0, 8)}`,
        },
      });

      triggerRevalidation();
      return NextResponse.json({ success: true, order: updatedOrder });
    } else {
      // Reject
      const updatedOrder = await db.$transaction(async (tx) => {
        await tx.b2BSettlement.update({
          where: { id: settlement.id },
          data: { status: 'REJECTED' },
        });

        const verifiedCount = await tx.b2BSettlement.count({
          where: { orderId: currentOrderId, status: 'VERIFIED' },
        });
        const pendingCount = await tx.b2BSettlement.count({
          where: { orderId: currentOrderId, status: 'PENDING' },
        });

        let newStatus = 'UNPAID';
        if (pendingCount > 0) {
          newStatus = 'PENDING_VERIFICATION';
        } else if (verifiedCount > 0) {
          newStatus = 'PARTIALLY_PAID';
        }

        return tx.order.update({
          where: { id: currentOrderId },
          data: {
            settleStatus: newStatus,
          },
        });
      });

      await db.systemAuditLog.create({
        data: {
          action: 'B2B_SETTLE_REJECT',
          userId: user.userId,
          details: `Wholesaler rejected settlement request for order #${currentOrderId.substring(0, 8)}`,
        },
      });

      triggerRevalidation();
      return NextResponse.json({ success: true, order: updatedOrder });
    }
  } catch (error: any) {
    console.error('Error verifying B2B settlement:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
