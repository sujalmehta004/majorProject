import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import InventoryClient from './InventoryClient';
import RetailerLayout from '@/components/RetailerLayout';

export const dynamic = 'force-dynamic';

export default async function RetailerInventoryPage() {
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
    if (!features.includes('Inventory')) {
      redirect('/');
    }
  }

  if (!profile) {
    redirect('/subscription-expired');
  }

  // Fetch all products in this retailer's inventory (products may belong to wholesalers)
  const inventoryItems = await db.retailerInventory.findMany({
    where: { retailerId: profile.id },
    include: { product: true },
  });
  const productMap = new Map<string, any>();
  for (const item of inventoryItems) {
    if (item.product && !productMap.has(item.product.id)) {
      productMap.set(item.product.id, item.product);
    }
  }
  // Also include retailer-owned products not yet in inventory
  const ownProducts = await db.product.findMany({
    where: { retailerId: profile.id },
    orderBy: { name: 'asc' },
  });
  for (const p of ownProducts) {
    if (!productMap.has(p.id)) productMap.set(p.id, p);
  }
  const allProducts = Array.from(productMap.values()).sort((a: any, b: any) =>
    a.name.localeCompare(b.name)
  );

  const serializedProducts = JSON.parse(JSON.stringify(allProducts));

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
      <InventoryClient profileId={profile.id} allProducts={serializedProducts} />
    </RetailerLayout>
  );
}
