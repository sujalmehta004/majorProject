import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';

enum ClientTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      retailerId,
      wholesalerId,
      items, // [{ productId: string, qtyBoxes: number }]
      overrideJustification,
    } = body;

    if (!retailerId || !wholesalerId || !items || !items.length) {
      return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
    }

    // Retrieve retailer and wholesaler profiles
    const retailer = await db.retailerProfile.findUnique({
      where: { id: retailerId },
    });

    const wholesaler = await db.wholesalerProfile.findUnique({
      where: { id: wholesalerId },
    });

    if (!retailer || !wholesaler) {
      return NextResponse.json({ error: 'Profiles not found' }, { status: 404 });
    }

    // 1. Calculate pricing & packaging details
    let totalAmount = 0;
    const computedItems: any[] = [];

    for (const item of items) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || product.wholesalerId !== wholesaler.id) {
        return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 400 });
      }

      // Convert box qty to base units (tablets)
      const tabletsPerBox = product.tabletsPerStrip * product.stripsPerBox;
      const baseUnitsOrdered = item.qtyBoxes * tabletsPerBox;

      // Evaluate tiered pricing per Box
      // tierPricingJson example: [{"minQty": 1, "maxQty": 49, "pricePerBox": 10}, {"minQty": 50, "maxQty": 999, "pricePerBox": 9}]
      let pricePerBox = 100; // default backup price if no tiers defined
      try {
        const activeBatch = await db.inventoryBatch.findFirst({
          where: {
            productId: product.id,
            expiryDate: { gt: new Date() },
            availableBaseUnits: { gt: 0 },
          },
          orderBy: { expiryDate: 'asc' },
        });
        if (activeBatch) {
          pricePerBox = activeBatch.sellingPricePerBox;
        }
      } catch (e) {
        console.error('Failed to retrieve active batch price:', e);
      }
      try {
        const tiers = JSON.parse(product.tierPricingJson || '[]');
        const matchingTier = tiers.find(
          (t: any) => item.qtyBoxes >= t.minQty && item.qtyBoxes <= (t.maxQty || 999999)
        );
        if (matchingTier) {
          pricePerBox = matchingTier.pricePerBox;
        } else if (tiers.length > 0) {
          // Fallback to first tier price
          pricePerBox = tiers[0].pricePerBox;
        }
      } catch (e) {
        console.error('Failed to parse pricing tiers:', e);
      }

      const pricePerBaseUnit = pricePerBox / tabletsPerBox;
      const itemSubtotal = baseUnitsOrdered * pricePerBaseUnit;
      totalAmount += itemSubtotal;

      computedItems.push({
        productId: product.id,
        quantity: baseUnitsOrdered,
        pricePerUnit: pricePerBaseUnit,
        productName: product.name,
      });
    }

    // 2. Loyalty tracker: client tier discount
    // Bronze: < 100,000 (0%), Silver: 100,000 - 500,000 (5%), Gold: > 500,000 (10%)
    let discountPercent = 0;
    let tierName = ClientTier.BRONZE;
    if (retailer.lifetimeSpend >= 500000) {
      discountPercent = 0.10;
      tierName = ClientTier.GOLD;
    } else if (retailer.lifetimeSpend >= 100000) {
      discountPercent = 0.05;
      tierName = ClientTier.SILVER;
    }

    const discountAmount = totalAmount * discountPercent;
    const netAmount = totalAmount - discountAmount;

    // Fetch wholesaler relation details (credit limit & advance balance)
    const relation = await db.wholesalerRetailerRelation.findUnique({
      where: {
        wholesalerId_retailerId: {
          wholesalerId: wholesaler.id,
          retailerId: retailer.id,
        }
      }
    });

    const activeCreditLimit = relation ? relation.creditLimit : retailer.creditLimit;
    const advanceBalance = relation ? relation.advanceBalance : 0;

    // 3. Credit Guard Safeguards
    // Check overdue invoices older than 30 days (unpaid / non-delivered status)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const overdueOrdersCount = await db.order.count({
      where: {
        retailerId: retailer.id,
        status: { in: [OrderStatus.PENDING, OrderStatus.PICKING, OrderStatus.DISPATCHED] },
        createdAt: { lt: thirtyDaysAgo },
      },
    });

    const isCreditLimitExceeded = netAmount > activeCreditLimit;
    const hasOverdueInvoices = overdueOrdersCount > 0;

    if ((isCreditLimitExceeded || hasOverdueInvoices) && !overrideJustification) {
      return NextResponse.json(
        {
          error: 'CREDIT_BLOCKED',
          reason: isCreditLimitExceeded
            ? `Order amount (Rs. ${netAmount.toFixed(2)}) exceeds retailer credit limit (Rs. ${activeCreditLimit.toFixed(2)}).`
            : `Retailer has unpaid invoices older than 30 days.`,
          isCreditLimitExceeded,
          hasOverdueInvoices,
        },
        { status: 400 }
      );
    }

    // 4. Isolated Transaction Block for Order Creation and FIFO Allocation
    const result = await db.$transaction(async (tx) => {
      // If override justification is provided, check and log it
      if (overrideJustification && (isCreditLimitExceeded || hasOverdueInvoices)) {
        await tx.systemAuditLog.create({
          data: {
            action: 'CREDIT_LIMIT_OVERRIDE',
            userId: user.userId,
            details: `Wholesaler overrode credit block for Retailer ${retailer.pharmacyName}. Justification: "${overrideJustification}". Order Net Amount: Rs. ${netAmount.toFixed(2)}`,
          },
        });
      }

      let appliedAdvance = 0;
      if (advanceBalance > 0) {
        appliedAdvance = Math.min(advanceBalance, netAmount);
        
        // Deduct advance balance in the relation
        await tx.wholesalerRetailerRelation.update({
          where: {
            wholesalerId_retailerId: {
              wholesalerId: wholesaler.id,
              retailerId: retailer.id,
            }
          },
          data: {
            advanceBalance: {
              decrement: appliedAdvance,
            }
          }
        });
      }

      const finalNetAmount = netAmount - appliedAdvance;
      const settleStatus = finalNetAmount === 0 ? 'VERIFIED' : 'UNPAID';
      const settleAmount = finalNetAmount === 0 ? appliedAdvance : 0;

      // Create main Order
      const newOrder = await tx.order.create({
        data: {
          wholesalerId: wholesaler.id,
          retailerId: retailer.id,
          status: OrderStatus.PENDING,
          totalAmount,
          discountAmount,
          netAmount: finalNetAmount,
          overrideJustification: overrideJustification || null,
          advanceApplied: appliedAdvance,
          settleStatus,
          settleAmount,
        },
      });

      // Log to ledgers
      const { createLedgerEntry } = await import('@/lib/ledger');
      await createLedgerEntry(tx, {
        partyType: 'WHOLESALER',
        partyId: wholesaler.id,
        oppositePartyName: retailer.pharmacyName,
        type: 'SALE',
        debit: netAmount,
        description: `B2B Sale - Order #${newOrder.id.substring(0, 8).toUpperCase()}`,
        orderId: newOrder.id,
      });

      await createLedgerEntry(tx, {
        partyType: 'RETAILER',
        partyId: retailer.id,
        oppositePartyName: wholesaler.companyName,
        type: 'PURCHASE',
        debit: netAmount,
        description: `B2B Procurement - Order #${newOrder.id.substring(0, 8).toUpperCase()}`,
        orderId: newOrder.id,
      });

      if (appliedAdvance > 0) {
        await createLedgerEntry(tx, {
          partyType: 'WHOLESALER',
          partyId: wholesaler.id,
          oppositePartyName: retailer.pharmacyName,
          type: 'ADVANCE_APPLIED',
          credit: appliedAdvance,
          description: `Advance balance applied to Order #${newOrder.id.substring(0, 8).toUpperCase()}`,
          orderId: newOrder.id,
        });

        await createLedgerEntry(tx, {
          partyType: 'RETAILER',
          partyId: retailer.id,
          oppositePartyName: wholesaler.companyName,
          type: 'ADVANCE_APPLIED',
          credit: appliedAdvance,
          description: `Advance balance applied to Order #${newOrder.id.substring(0, 8).toUpperCase()}`,
          orderId: newOrder.id,
        });
      }

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
        // Select active batches expiring in future, ordered by expiry date ascending
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

        // If inventory is insufficient, rollback transaction
        if (remainingToAllocate > 0) {
          throw new Error(
            `Insufficient stock for Product ${item.productName}. Missing ${remainingToAllocate} base units in available batches.`
          );
        }
      }

      // Update retailer lifetime spend
      await tx.retailerProfile.update({
        where: { id: retailer.id },
        data: {
          lifetimeSpend: {
            increment: netAmount,
          },
        },
      });

      return { newOrder, appliedAdvance };
    });

    return NextResponse.json({ success: true, order: result.newOrder, appliedAdvance: result.appliedAdvance });
  } catch (error: any) {
    console.error('Order checkout transaction rolled back:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const retailerId = url.searchParams.get('retailerId');
    const wholesalerId = url.searchParams.get('wholesalerId');

    const orders = await db.order.findMany({
      where: {
        retailerId: retailerId || undefined,
        wholesalerId: wholesalerId || undefined,
      },
      include: {
        retailer: {
          include: {
            user: true,
          },
        },
        wholesaler: true,
        b2bSettlements: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
