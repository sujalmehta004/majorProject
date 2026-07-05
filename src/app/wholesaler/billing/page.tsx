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

  // Load all B2B orders and wholesaler-own POS orders (exclude retailer B2C POS sales)
  // NOTE: We use OR with null check because Prisma's NOT { contains } silently drops NULL rows in PostgreSQL
  const orders = await db.order.findMany({
    where: {
      wholesalerId: profile.id,
      OR: [
        { overrideJustification: null },
        { NOT: { overrideJustification: { contains: 'B2C POS' } } }
      ]
    },
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
