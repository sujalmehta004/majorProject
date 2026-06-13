import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine wholesaler profile ID
    let wholesalerProfileId = '';
    if (user.role === 'WHOLESALER') {
      const profile = await db.wholesalerProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!profile) return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
      wholesalerProfileId = profile.id;
    } else {
      const dbUser = await db.user.findUnique({
        where: { id: user.userId },
      });
      if (!dbUser || !dbUser.wholesalerId) {
        return NextResponse.json({ error: 'Wholesaler association not found' }, { status: 404 });
      }
      wholesalerProfileId = dbUser.wholesalerId;
    }

    const body = await request.json();
    const { items, customerName, customerPhone, retailerId, paidAmount: paidAmountRaw, paymentMethod: paymentMethodRaw } = body; // items: [{ productId, qtyBoxes }]
    const paidAmount = parseFloat(paidAmountRaw) || 0;
    const paymentMethod = paymentMethodRaw || 'CASH';

    if (!items || !items.length) {
      return NextResponse.json({ error: 'No items in checkout basket' }, { status: 400 });
    }

    // Find or seed Walk-in Customer Retailer
    const walkinEmail = `walkin-${wholesalerProfileId}@medhub.com`;
    let walkinUser = await db.user.findUnique({
      where: { email: walkinEmail },
      include: { retailerProfile: true }
    });

    if (!walkinUser) {
      walkinUser = await db.user.create({
        data: {
          email: walkinEmail,
          passwordHash: '$2b$10$dummyhashplaceholderforwalkincustomersecurity',
          role: 'RETAILER',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000), // 50 years lease
          isActive: true,
          retailerProfile: {
            create: {
              pharmacyName: 'Walk-in Customer (POS)',
              registrationNumber: 'WALKIN-POS-SECURE',
              address: 'MedHub Walk-in Sales Desk',
              phone: '0000000000',
              latitude: 27.7172,
              longitude: 85.3240,
              creditLimit: 9999999,
              lifetimeSpend: 0,
              wholesalerId: wholesalerProfileId,
            }
          }
        },
        include: { retailerProfile: true }
      });
    }

    let retailerProfile = walkinUser.retailerProfile;
    if (retailerId) {
      const selectedProfile = await db.retailerProfile.findUnique({
        where: { id: retailerId },
        include: { user: true }
      });
      if (selectedProfile) {
        retailerProfile = selectedProfile;
      }
    }

    if (!retailerProfile) {
      return NextResponse.json({ error: 'Walk-in customer profile could not be initialized' }, { status: 500 });
    }

    // 1. Calculate pricing
    let totalAmount = 0;
    const computedItems: any[] = [];

    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || product.wholesalerId !== wholesalerProfileId) {
        return NextResponse.json({ error: `Product ${item.productId} not registered in your catalog.` }, { status: 400 });
      }

      // Convert box qty to base units (tablets)
      const tabletsPerBox = product.tabletsPerStrip * product.stripsPerBox;
      const baseUnitsOrdered = item.qtyBoxes * tabletsPerBox;

      // Evaluate tiered pricing per Box (from product tier JSON first, then fall back to batch sellingPricePerBox)
      let pricePerBox: number | null = null;
      try {
        const tiers = JSON.parse(product.tierPricingJson || '[]');
        const matchingTier = tiers.find(
          (t: any) => item.qtyBoxes >= t.minQty && item.qtyBoxes <= (t.maxQty || 999999)
        );
        if (matchingTier) {
          pricePerBox = matchingTier.pricePerBox;
        } else if (tiers.length > 0) {
          pricePerBox = tiers[0].pricePerBox;
        }
      } catch (e) {
        console.error('Failed to parse pricing tiers:', e);
      }

      // Fallback: use sellingPricePerBox from earliest non-expired batch (FIFO order)
      if (pricePerBox === null) {
        const fallbackBatch = await db.inventoryBatch.findFirst({
          where: {
            productId: product.id,
            availableBaseUnits: { gt: 0 },
            expiryDate: { gt: new Date() },
          },
          orderBy: { expiryDate: 'asc' },
          select: { sellingPricePerBox: true },
        });
        pricePerBox = fallbackBatch?.sellingPricePerBox ?? 0;
      }

      const pricePerBaseUnit = tabletsPerBox > 0 ? pricePerBox / tabletsPerBox : 0;
      const itemSubtotal = baseUnitsOrdered * pricePerBaseUnit;
      totalAmount += itemSubtotal;

      computedItems.push({
        productId: product.id,
        quantity: baseUnitsOrdered,
        pricePerUnit: pricePerBaseUnit,
        productName: product.name,
        pricePerBox,
        tabletsPerBox,
      });
    }

    // POS sales are cash-based physical customer sales, so no loyalty discounts are pre-loaded
    const netAmount = totalAmount;
    const effectivePaidAmount = Math.min(paidAmount, netAmount); // clamp to bill total
    const dueAmount = Math.max(netAmount - effectivePaidAmount, 0);
    const customerInfoStr = `Walk-in Customer: ${customerName || 'N/A'}, Phone: ${customerPhone || 'N/A'} | Paid: Rs.${effectivePaidAmount.toFixed(2)} | Method: ${paymentMethod} | Due: Rs.${dueAmount.toFixed(2)}`;

    // 2. Isolated Transaction Block for Order Creation and FIFO Allocation
    const resultOrder = await db.$transaction(async (tx) => {
      // Create main Order (Status is immediately DELIVERED since POS cash checkout is a finalized walk-in sale)
      const newOrder = await tx.order.create({
        data: {
          wholesalerId: wholesalerProfileId,
          retailerId: retailerProfile.id,
          status: OrderStatus.DELIVERED,
          totalAmount,
          discountAmount: 0,
          netAmount,
          overrideJustification: customerInfoStr,
        },
      });

      // Create Order Items and apply FIFO Allocation
      for (const item of computedItems) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            pricePerUnit: item.pricePerUnit,
          },
        });

        // FIFO Ingestion query with Row Locking (FOR UPDATE)
        const batches = await tx.$queryRaw<any[]>`
          SELECT * FROM "InventoryBatch" 
          WHERE "productId" = ${item.productId}
            AND "expiryDate" > NOW() 
            AND "availableBaseUnits" > 0 
          ORDER BY "expiryDate" ASC 
          FOR UPDATE
        `;

        let remainingToAllocate = item.quantity;

        for (const batch of batches) {
          if (remainingToAllocate <= 0) break;

          const allocatedFromBatch = Math.min(batch.availableBaseUnits, remainingToAllocate);

          // Update batch available count
          await tx.inventoryBatch.update({
            where: { id: batch.id },
            data: {
              availableBaseUnits: {
                decrement: allocatedFromBatch,
              },
            },
          });

          // Record Allocation log
          await tx.orderBatchAllocation.create({
            data: {
              orderItemId: orderItem.id,
              batchId: batch.id,
              quantity: allocatedFromBatch,
            },
          });

          remainingToAllocate -= allocatedFromBatch;
        }

        if (remainingToAllocate > 0) {
          throw new Error(
            `Insufficient stock for Product "${item.productName}". Need ${remainingToAllocate} more tablets in active batches.`
          );
        }
      }

      // Update retailer lifetime spend
      await tx.retailerProfile.update({
        where: { id: retailerProfile.id },
        data: {
          lifetimeSpend: {
            increment: netAmount,
          },
        },
      });

      return newOrder;
    });

    // Record audit log
    await db.systemAuditLog.create({
      data: {
        action: 'POS_CHECKOUT',
        userId: user.userId,
        details: `Created walk-in POS physical sale. Total: Rs. ${netAmount.toFixed(2)}. ${customerInfoStr}`,
      },
    });

    // Fetch the full order including nested items for frontend invoice output
    const completeOrder = await db.order.findUnique({
      where: { id: resultOrder.id },
      include: {
        retailer: true,
        items: {
          include: {
            product: true,
            allocations: {
              include: {
                batch: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      order: completeOrder,
      paidAmount: effectivePaidAmount,
      dueAmount,
      paymentMethod,
    });
  } catch (error: any) {
    console.error('POS checkout rolled back:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
