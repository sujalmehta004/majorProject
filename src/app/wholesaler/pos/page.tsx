import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WholesalerLayout from '@/components/WholesalerLayout';
import POSClient from './POSClient';

export const dynamic = 'force-dynamic';

export default async function WholesalerPOSPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
    redirect('/');
  }

  // Load profile
  let profile = null;
  let dbUser = await db.user.findUnique({
    where: { id: user.userId },
  });

  if (user.role === 'WHOLESALER') {
    profile = await db.wholesalerProfile.findUnique({
      where: { userId: user.userId },
    });
  } else if (user.role === 'WHOLESALER_STAFF' && dbUser?.wholesalerId) {
    profile = await db.wholesalerProfile.findUnique({
      where: { id: dbUser.wholesalerId },
    });
  }

  if (!profile) {
    redirect('/subscription-expired');
  }

  // Fetch available products with active batches for checkout selection
  const products = await db.product.findMany({
    where: { wholesalerId: profile.id },
    include: {
      batches: {
        where: {
          availableBaseUnits: { gt: 0 },
          expiryDate: { gt: new Date() },
        },
        orderBy: { expiryDate: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const serializedProducts = JSON.parse(JSON.stringify(products));
  const serializedProfile = JSON.parse(JSON.stringify(profile));

  return (
    <WholesalerLayout
      user={{
        userId: user.userId,
        email: user.email,
        role: user.role,
        fullName: dbUser?.fullName,
        allowedFeatures: dbUser?.allowedFeatures,
      }}
      profile={{
        id: profile.id,
        companyName: profile.companyName,
        taxId: profile.taxId,
      }}
    >
      <POSClient 
        profile={serializedProfile} 
        products={serializedProducts} 
      />
    </WholesalerLayout>
  );
}
