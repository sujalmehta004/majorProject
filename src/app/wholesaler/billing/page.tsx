import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BillingClient from './BillingClient';
import WholesalerLayout from '@/components/WholesalerLayout';

export const dynamic = 'force-dynamic';

export default async function WholesalerBillingPage() {
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

  // Load all order logs for this wholesaler to perform financial analytics
  const orders = await db.order.findMany({
    where: { wholesalerId: profile.id },
    include: {
      retailer: true,
      b2bSettlements: true,
      items: {
        include: {
          product: true,
          allocations: {
            include: {
              batch: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const supplierBills = await db.supplierBill.findMany({
    where: {
      supplier: { wholesalerId: profile.id }
    },
    include: {
      supplier: true,
      settlements: true
    },
    orderBy: { billDate: 'desc' }
  });

  const serializedOrders = JSON.parse(JSON.stringify(orders));
  const serializedSupplierBills = JSON.parse(JSON.stringify(supplierBills));
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
      <BillingClient 
        profileId={profile.id} 
        initialOrders={serializedOrders} 
        initialSupplierBills={serializedSupplierBills}
        profile={serializedProfile} 
      />
    </WholesalerLayout>
  );
}
