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

    // Load B2C sales (where overrideJustification contains B2C POS)
    const sales = await db.order.findMany({
      where: {
        retailerId: retailer.id,
        overrideJustification: { contains: 'B2C POS' },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Load B2B purchases (where status is DELIVERED or any, excluding B2C POS)
    const purchases = await db.order.findMany({
      where: {
        retailerId: retailer.id,
        OR: [
          { overrideJustification: null },
          {
            NOT: {
              overrideJustification: { contains: 'B2C POS' },
            },
          },
        ],
      },
      include: {
        wholesaler: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      sales,
      purchases,
    });
  } catch (error: any) {
    console.error('Error fetching billing data:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const { orderId, amount, method } = await request.json();

    const order = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        settleStatus: 'PENDING_VERIFICATION',
        settleAmount: parseFloat(amount),
        settleMethod: method || 'CASH',
      },
    });

    await db.systemAuditLog.create({
      data: {
        action: 'B2B_SETTLE_REQUEST',
        userId: user.userId,
        details: `Retailer requested settlement of Rs. ${amount} via ${method} for B2B Order ${orderId}`,
      },
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Error recording B2B settlement request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
