import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, approve, settleAmount } = await request.json();

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { retailer: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (approve) {
      const finalAmount = settleAmount !== undefined ? parseFloat(settleAmount) : order.settleAmount;
      const updatedOrder = await db.order.update({
        where: { id: orderId },
        data: {
          settleStatus: 'VERIFIED',
          settleAmount: finalAmount,
        },
      });

      await db.systemAuditLog.create({
        data: {
          action: 'B2B_SETTLE_VERIFY',
          userId: user.userId,
          details: `Wholesaler verified settlement of Rs. ${finalAmount} for order #${orderId.substring(0, 8)}`,
        },
      });

      return NextResponse.json({ success: true, order: updatedOrder });
    } else {
      const updatedOrder = await db.order.update({
        where: { id: orderId },
        data: {
          settleStatus: 'REJECTED',
          // Keep the requested settleAmount in the database so we know how much was rejected, or we can keep it as is.
        },
      });

      await db.systemAuditLog.create({
        data: {
          action: 'B2B_SETTLE_REJECT',
          userId: user.userId,
          details: `Wholesaler rejected settlement for order #${orderId.substring(0, 8)}`,
        },
      });

      return NextResponse.json({ success: true, order: updatedOrder });
    }
  } catch (error: any) {
    console.error('Error verifying B2B settlement:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
