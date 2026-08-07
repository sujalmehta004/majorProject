import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { broadcastToWholesaler } from '@/app/api/events/route';

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

    // Load B2C POS sales (overrideJustification contains 'B2C POS')
    const posOrders = await db.order.findMany({
      where: {
        retailerId: retailer.id,
        overrideJustification: { contains: 'B2C POS' },
      },
      include: {
        items: { include: { product: true } },
        b2bSettlements: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Load online ConsumerOrders (all statuses so nothing is hidden)
    const consumerOrders = await db.consumerOrder.findMany({
      where: { retailerId: retailer.id },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Map ConsumerOrder → same shape as Order so the client can handle both uniformly
    // COD: payment is only confirmed on delivery; until then show as due
    const mappedConsumerSales = consumerOrders.map((c: any) => {
      const isDelivered = c.status === 'DELIVERED';
      const netAmt = (c.totalAmount || 0) + (c.deliveryFee || 0);
      const paidAmt = isDelivered ? netAmt : 0;
      const dueAmt  = isDelivered ? 0 : netAmt;
      return {
        id: c.id,
        wholesaler: null,
        status: c.status,
        totalAmount: c.totalAmount,
        discountAmount: 0,
        netAmount: netAmt,
        advanceApplied: 0,
        overrideJustification: `B2C POS: ${c.buyerName} (Online) | Phone: ${c.buyerPhone} | Method: ${c.paymentMethod || 'COD'} | Paid: Rs. ${paidAmt.toFixed(2)} | Due: Rs. ${dueAmt.toFixed(2)}`,
        createdAt: c.createdAt,
        items: c.items.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          product: { name: item.product.name, sku: item.product.sku },
        })),
        b2bSettlements: [],
        settleStatus: isDelivered ? 'VERIFIED' : 'UNPAID',
        settleAmount: paidAmt,
        settleMethod: c.paymentMethod || 'COD',
      };
    });

    // Merge POS + consumer orders as unified sales list
    const sales = [...posOrders, ...mappedConsumerSales].sort(
      (a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
    );

    // Load B2B purchases only — orders where overrideJustification is NULL (pure B2B)
    const purchases = await db.order.findMany({
      where: {
        retailerId: retailer.id,
        overrideJustification: null,
      },
      include: {
        wholesaler: true,
        items: { include: { product: true } },
        b2bSettlements: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Load wholesaler relations (advance balances)
    const relations = await db.wholesalerRetailerRelation.findMany({
      where: { retailerId: retailer.id },
      include: {
        wholesaler: true,
      },
    });

    // Load ledger entries (asc for running balance)
    const ledgers = await db.ledgerEntry.findMany({
      where: {
        partyType: 'RETAILER',
        partyId: retailer.id,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Load return requests
    const returnRequests = await db.returnRequest.findMany({
      where: { retailerId: retailer.id },
      include: {
        order: {
          include: {
            wholesaler: true,
            items: { include: { product: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      sales,
      purchases,
      relations,
      ledgers,
      returnRequests,
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
      select: { id: true, wholesalerId: true, retailerId: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const newSettlement = await db.$transaction(async (tx) => {
      // Create a pending settlement request
      const settle = await tx.b2BSettlement.create({
        data: {
          orderId,
          amount: parseFloat(amount),
          method: method || 'CASH',
          status: 'PENDING',
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          settleStatus: 'PENDING_VERIFICATION',
        },
      });

      return settle;
    });

    // Notify wholesaler so their dashboard alert appears instantly
    if (order.wholesalerId) {
      broadcastToWholesaler(order.wholesalerId, 'BILLING_UPDATE', {
        type: 'SETTLEMENT_REQUEST',
        orderId,
        amount: parseFloat(amount),
        method: method || 'CASH',
        settlementId: newSettlement.id,
      });
    }

    await db.systemAuditLog.create({
      data: {
        action: 'B2B_SETTLE_REQUEST',
        userId: user.userId,
        details: `Retailer requested settlement of Rs. ${amount} via ${method} for B2B Order ${orderId}`,
      },
    });

    return NextResponse.json({ success: true, settlementId: newSettlement.id });
  } catch (error: any) {
    console.error('Error recording B2B settlement request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
