import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import POSClient from './POSClient';
import RetailerLayout from '@/components/RetailerLayout';

export const dynamic = 'force-dynamic';

export default async function RetailerPOSPage() {
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
    if (!features.includes('POS')) {
      redirect('/');
    }
  }

  if (!profile) {
    redirect('/subscription-expired');
  }

  // Fetch products currently in retailer's inventory (qty > 0)
  const inventoryItems = await db.retailerInventory.findMany({
    where: {
      retailerId: profile.id,
      quantity: { gt: 0 },
      expiryDate: { gt: new Date() },
    },
    include: {
      product: true,
    },
    orderBy: { product: { name: 'asc' } },
  });

  // Group by product so the POS shows product options
  // For simplicity, serialize and map to matches Wholesaler products schema
  const productsMap: Record<string, any> = {};
  inventoryItems.forEach((item) => {
    if (!productsMap[item.productId]) {
      productsMap[item.productId] = {
        id: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        category: item.product.category,
        tabletsPerStrip: item.product.tabletsPerStrip,
        stripsPerBox: item.product.stripsPerBox,
        batches: [],
      };
    }
    // Compute pricePerBox from custom sellingPrice first, else tier pricing JSON
    if (item.sellingPrice && item.sellingPrice > 0) {
      productsMap[item.productId].pricePerBox = item.sellingPrice;
    } else if (!productsMap[item.productId].pricePerBox) {
      try {
        const tiers = JSON.parse(item.product.tierPricingJson || '[]');
        if (tiers.length > 0) {
          productsMap[item.productId].pricePerBox = tiers[0].pricePerBox;
        }
      } catch (e) {}
    }

    productsMap[item.productId].batches.push({
      id: item.id,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      availableBaseUnits: item.quantity,
      sellingPrice: item.sellingPrice || 0,
      buyingPrice: item.buyingPrice || 0,
      rack: item.rack || null,
    });
  });

  const productsList = Object.values(productsMap);

  const serializedProducts = JSON.parse(JSON.stringify(productsList));

  return (
    <RetailerLayout
      user={{
        userId: user.userId,
        email: user.email,
        role: user.role,
        fullName: dbUser.fullName || user.email.split('@')[0],
        allowedFeatures: dbUser.allowedFeatures,
      }}
      profile={{
        id: profile.id,
        pharmacyName: profile.pharmacyName,
        registrationNumber: profile.registrationNumber,
      }}
    >
      <POSClient products={serializedProducts} />
    </RetailerLayout>
  );
}
