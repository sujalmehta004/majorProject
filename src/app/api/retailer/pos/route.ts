import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';
import { broadcastToRetailer } from '@/app/api/events/route';

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

    const body = await request.json();
    const { items, customerName, customerPhone, paidAmount: paidAmountRaw, paymentMethod } = body;
    const paidAmount = parseFloat(paidAmountRaw) || 0;

    if (!items || !items.length) {
      return NextResponse.json({ error: 'No items in basket' }, { status: 400 });
    }

    // Since B2C POS requires a wholesalerId relation, we find a dummy or the retailer's linked wholesaler
    let wholesalerId = retailer.wholesalerId;
    if (!wholesalerId) {
      const firstWholesaler = await db.wholesalerProfile.findFirst();
      if (!firstWholesaler) {
        return NextResponse.json({ error: 'No wholesalers exist in database to link POS order' }, { status: 400 });
      }
      wholesalerId = firstWholesaler.id;
    }

    let totalAmount = 0;
    const computedItems: any[] = [];

    // Retrieve active retail inventories for FIFO allocation validation
    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 400 });
      }

      const tabletsPerBox = product.tabletsPerStrip * product.stripsPerBox;
      const baseUnitsNeeded = item.qtyBoxes * tabletsPerBox;

      // Check retail inventory stock
      const retailStocks = await db.retailerInventory.findMany({
        where: {
          retailerId: retailer.id,
          productId: product.id,
          quantity: { gt: 0 },
          expiryDate: { gt: new Date() },
        },
        orderBy: { expiryDate: 'asc' },
      });

      const totalAvailable = retailStocks.reduce((sum, s) => sum + s.quantity, 0);
      if (totalAvailable < baseUnitsNeeded) {
        return NextResponse.json({
          error: `Insufficient stock for Product ${product.name}. Available: ${totalAvailable} units, Requested: ${baseUnitsNeeded} units.`,
        }, { status: 400 });
      }

      // pricing per box (fallback to 100)
      let pricePerBox = 100;
      try {
        const tiers = JSON.parse(product.tierPricingJson || '[]');
        if (tiers.length > 0) {
          pricePerBox = tiers[0].pricePerBox;
        }
      } catch (e) {}

      const pricePerBaseUnit = pricePerBox / tabletsPerBox;
      const itemSubtotal = baseUnitsNeeded * pricePerBaseUnit;
      totalAmount += itemSubtotal;

      computedItems.push({
        productId: product.id,
        quantity: baseUnitsNeeded,
        pricePerUnit: pricePerBaseUnit,
        productName: product.name,
        qtyBoxes: item.qtyBoxes,
        retailStocks,
      });
    }

    const netAmount = totalAmount;
    const dueAmount = Math.max(netAmount - paidAmount, 0);

    const customerDetails = `B2C POS: ${customerName || 'Walk-in'}, Phone: ${customerPhone || 'N/A'} | Paid: Rs.${paidAmount.toFixed(2)} | Method: ${paymentMethod || 'CASH'} | Due: Rs.${dueAmount.toFixed(2)}`;

    // Run transaction
    const completedOrder = await db.$transaction(async (tx) => {
      // 1. Create order representation
      const order = await tx.order.create({
        data: {
          wholesalerId,
          retailerId: retailer.id,
          status: OrderStatus.DELIVERED,
          totalAmount,
          discountAmount: 0,
          netAmount,
          overrideJustification: customerDetails,
          settleStatus: paidAmount >= netAmount ? 'VERIFIED' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
          settleAmount: Math.min(paidAmount, netAmount),
          settleMethod: paymentMethod || 'CASH',
        },
      });

      // 2. Decrement RetailerInventory and create items
      for (const item of computedItems) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
          },
        });

        let remaining = item.quantity;
        for (const stock of item.retailStocks) {
          if (remaining <= 0) break;
          const toTake = Math.min(stock.quantity, remaining);

          await tx.retailerInventory.update({
            where: { id: stock.id },
            data: {
              quantity: {
                decrement: toTake,
              },
            },
          });

          remaining -= toTake;
        }
      }

      return order;
    });

    await db.systemAuditLog.create({
      data: {
        action: 'B2C_POS_SALE',
        userId: user.userId,
        details: `Retailer processed POS cash sale. Total: Rs. ${netAmount.toFixed(2)}. Details: ${customerDetails}`,
      },
    });

    broadcastToRetailer(retailer.id, 'INVENTORY_UPDATE');
    broadcastToRetailer(retailer.id, 'BILLING_UPDATE');

    return NextResponse.json({
      success: true,
      order: completedOrder,
      paidAmount,
      dueAmount,
    });
  } catch (error: any) {
    console.error('POS checkout transaction failed:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
