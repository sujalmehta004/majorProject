import React, { Suspense } from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BillingClient from './BillingClient';
import RetailerLayout from '@/components/RetailerLayout';

export const dynamic = 'force-dynamic';

export default async function RetailerBillingPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'RETAILER' && user.role !== 'RETAILER_STAFF')) {
    redirect('/');
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.userId },
  });

  if (!dbUser) {
    redirect('/');
  }

  if (!dbUser.isVerified || dbUser.verificationStatus !== 'VERIFIED') {
    redirect('/retailer/dashboard');
  }

  let profile = null;
  if (user.role === 'RETAILER') {
    profile = await db.retailerProfile.findUnique({
      where: { userId: user.userId },
    });
  } else if (user.role === 'RETAILER_STAFF' && dbUser.retailerId) {
    profile = await db.retailerProfile.findUnique({
      where: { id: dbUser.retailerId },
    });
    // Check features
    const features = dbUser.allowedFeatures.split(',').map(f => f.trim());
    if (!features.includes('Billing')) {
      redirect('/');
    }
  }

  if (!profile) {
    redirect('/subscription-expired');
  }

  // Load B2C sales
  const salesRaw = await db.order.findMany({
    where: {
      retailerId: profile.id,
      overrideJustification: { contains: 'B2C POS' },
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      b2bSettlements: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const consumerSales = await db.consumerOrder.findMany({
    where: {
      retailerId: profile.id,
      // Include all statuses so pending/shipped consumer orders also appear
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

  const mappedConsumerSales = consumerSales.map((c) => {
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
      items: c.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        product: {
          name: item.product.name,
          sku: item.product.sku,
        },
      })),
      b2bSettlements: [],
      settleStatus: isDelivered ? 'VERIFIED' : 'UNPAID',
      settleAmount: paidAmt,
      settleMethod: c.paymentMethod || 'COD',
    };
  });


  const sales = [
    ...salesRaw,
    ...mappedConsumerSales,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Compute per-item profit using inventory buyingPrice
  // NOTE: buyingPrice on RetailerInventory is per BOX, but OrderItem.pricePerUnit is per BASE UNIT (tablet).
  // Must divide buyingPrice by (tabletsPerStrip × stripsPerBox) for correct per-unit comparison.
  const inventoryPrices = await db.retailerInventory.findMany({
    where: { retailerId: profile.id },
    select: { productId: true, buyingPrice: true, quantity: true },
  });

  // Collect product dims for unit conversion
  const invProductIds = [...new Set(inventoryPrices.map((i) => i.productId))];
  const invProducts = await db.product.findMany({
    where: { id: { in: invProductIds } },
    select: { id: true, tabletsPerStrip: true, stripsPerBox: true },
  });
  const tabletsPerBoxMap: Record<string, number> = {};
  for (const p of invProducts) {
    tabletsPerBoxMap[p.id] = (p.tabletsPerStrip || 1) * (p.stripsPerBox || 1);
  }

  // Build weighted-average buying price per BASE UNIT per product
  const buyingPricePerUnitMap: Record<string, number> = {};
  const buyingPriceTotalMap: Record<string, { totalCost: number; totalQty: number }> = {};
  for (const inv of inventoryPrices) {
    if (!buyingPriceTotalMap[inv.productId]) {
      buyingPriceTotalMap[inv.productId] = { totalCost: 0, totalQty: 0 };
    }
    buyingPriceTotalMap[inv.productId].totalCost += inv.buyingPrice * inv.quantity;
    buyingPriceTotalMap[inv.productId].totalQty  += inv.quantity;
  }
  for (const [pid, val] of Object.entries(buyingPriceTotalMap)) {
    const tpb = tabletsPerBoxMap[pid] || 1;
    // weighted avg buying price per box ÷ tabletsPerBox = buying price per base unit
    buyingPricePerUnitMap[pid] = val.totalQty > 0 ? (val.totalCost / val.totalQty) / tpb : 0;
  }

  // Sum profit across all B2C sale items
  let totalProfit = 0;
  for (const sale of salesRaw) {
    for (const item of sale.items) {
      const bppu = buyingPricePerUnitMap[item.productId] || 0;
      totalProfit += (item.pricePerUnit - bppu) * item.quantity;
    }
  }
  // Add consumer order profit (selling price - buying price per unit)
  for (const c of consumerSales) {
    for (const item of c.items) {
      const bppu = buyingPricePerUnitMap[item.productId] || 0;
      totalProfit += (item.pricePerUnit - bppu) * item.quantity;
    }
  }

  // Load B2B purchases only — orders where overrideJustification is NULL (pure B2B)
  const purchases = await db.order.findMany({
    where: {
      retailerId: profile.id,
      overrideJustification: null,
    },
    include: {
      wholesaler: true,
      items: {
        include: {
          product: true,
        },
      },
      b2bSettlements: true,
    },
    orderBy: { createdAt: 'desc' },
  });


  // Load wholesaler relations (advance balances)
  const relations = await db.wholesalerRetailerRelation.findMany({
    where: { retailerId: profile.id },
    include: { wholesaler: true },
  });

  // Load retailer ledger entries
  const ledgers = await db.ledgerEntry.findMany({
    where: {
      partyType: 'RETAILER',
      partyId: profile.id,
    },
    orderBy: { createdAt: 'asc' }, // asc for running balance display
  });

  // Load return requests for this retailer
  const returnRequests = await db.returnRequest.findMany({
    where: { retailerId: profile.id },
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

  return (
    <RetailerLayout
      user={{
        userId: user.userId,
        email: user.email,
        role: user.role,
        fullName: dbUser.fullName || user.email.split('@')[0],
        allowedFeatures: dbUser.allowedFeatures,
        isVerified: dbUser.isVerified,
        verificationStatus: dbUser.verificationStatus,
      }}
      profile={{
        id: profile.id,
        pharmacyName: profile.pharmacyName,
        registrationNumber: profile.registrationNumber,
      }}
    >
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading billing…</div>}>
        <BillingClient
          initialSales={JSON.parse(JSON.stringify(sales))}
          initialPurchases={JSON.parse(JSON.stringify(purchases))}
          initialRelations={JSON.parse(JSON.stringify(relations))}
          initialLedgers={JSON.parse(JSON.stringify(ledgers))}
          initialReturnRequests={JSON.parse(JSON.stringify(returnRequests))}
          initialTotalProfit={totalProfit}
          profileId={profile.id}
        />
      </Suspense>
    </RetailerLayout>
  );
}
