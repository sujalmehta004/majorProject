import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'RETAILER' && user.role !== 'RETAILER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let retailerId = '';
    if (user.role === 'RETAILER') {
      const retailer = await db.retailerProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!retailer) {
        return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
      }
      retailerId = retailer.id;
    } else {
      const dbUser = await db.user.findUnique({
        where: { id: user.userId },
      });
      if (!dbUser?.retailerId) {
        return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
      }
      retailerId = dbUser.retailerId;
    }

    const orders = await db.order.findMany({
      where: {
        retailerId: retailerId,
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
        inTransitLogs: {
          include: {
            batch: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const consumerOrders = await db.consumerOrder.findMany({
      where: { retailerId: retailerId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, orders, consumerOrders });
  } catch (error: any) {
    console.error('Error fetching retailer orders:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// POST to confirm delivery via scanned barcode label (accepts Order ID or order barcode)
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'RETAILER' && user.role !== 'RETAILER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let retailerId = '';
    if (user.role === 'RETAILER') {
      const retailer = await db.retailerProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!retailer) {
        return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
      }
      retailerId = retailer.id;
    } else {
      const dbUser = await db.user.findUnique({
        where: { id: user.userId },
      });
      if (!dbUser?.retailerId) {
        return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
      }
      retailerId = dbUser.retailerId;
    }

    const body = await request.json();
    const { barcode } = body; // Can be Order ID or order barcode

    if (!barcode) {
      return NextResponse.json({ error: 'Barcode or Order ID is required' }, { status: 400 });
    }

    // Strip prefix "ORD-" if present
    let orderIdToSearch = barcode.trim();
    if (orderIdToSearch.toUpperCase().startsWith('ORD-')) {
      orderIdToSearch = orderIdToSearch.substring(4);
    }

    // Try finding the order by exact ID first, or matching substring
    let order = await db.order.findFirst({
      where: {
        retailerId: retailerId,
        OR: [
          { id: { equals: orderIdToSearch, mode: 'insensitive' } },
          { id: { startsWith: orderIdToSearch, mode: 'insensitive' } },
          { id: { contains: orderIdToSearch, mode: 'insensitive' } },
        ],
      },
      include: {
        inTransitLogs: {
          include: {
            batch: true,
          },
        },
        wholesaler: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: `No matching pending/dispatched order found for barcode: ${barcode}` }, { status: 404 });
    }

    if (order.status !== OrderStatus.DISPATCHED) {
      return NextResponse.json({ error: `Order is in ${order.status} status. It must be DISPATCHED to confirm delivery.` }, { status: 400 });
    }

    // Atomic confirmation transaction
    const confirmedOrder = await db.$transaction(async (tx) => {
      // 1. Update order status to DELIVERED
      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.DELIVERED },
      });

      // 2. Map transit logs to RetailerInventory
      for (const transit of order.inTransitLogs) {
        await tx.retailerInventory.upsert({
          where: {
            retailerId_productId_batchNumber: {
              retailerId: retailerId,
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
            retailerId: retailerId,
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
          action: 'RETAIL_DELIVERY_CONFIRM_BARCODE',
          userId: user.userId,
          details: `Confirmed delivery via barcode scan for Order ${order.id}. Wholesaler: ${order.wholesaler.companyName}`,
        },
      });

      return updated;
    });

    return NextResponse.json({ success: true, order: confirmedOrder });
  } catch (error: any) {
    console.error('Error confirming retail order delivery:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
