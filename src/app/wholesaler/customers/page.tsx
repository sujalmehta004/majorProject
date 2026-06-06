import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WholesalerLayout from '@/components/WholesalerLayout';
import CustomerClient from './CustomerClient';

export const dynamic = 'force-dynamic';

export default async function WholesalerCustomers() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
    redirect('/');
  }

  let profile = null;
  const dbUser = await db.user.findUnique({
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

  // Load all registered customer pharmacies
  const retailers = await db.retailerProfile.findMany({
    include: {
      user: true,
      orders: {
        where: { wholesalerId: profile.id },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const serializedRetailers = JSON.parse(JSON.stringify(retailers));

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
      <CustomerClient customers={serializedRetailers} wholesalerId={profile.id} />
    </WholesalerLayout>
  );
}
