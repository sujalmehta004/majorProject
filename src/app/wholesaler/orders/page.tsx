import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OrdersClient from './OrdersClient';
import WholesalerLayout from '@/components/WholesalerLayout';

export const dynamic = 'force-dynamic';

export default async function WholesalerOrdersPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
    redirect('/');
  }

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

  // Load registered retailers belonging to this wholesaler
  const retailers = await db.retailerProfile.findMany({
    where: {
      wholesalerId: profile.id,
    },
    orderBy: { pharmacyName: 'asc' },
    select: {
      id: true,
      pharmacyName: true,
      creditLimit: true,
      lifetimeSpend: true,
      registrationNumber: true,
    },
  });

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
      <OrdersClient profileId={profile.id} retailers={retailers} />
    </WholesalerLayout>
  );
}
