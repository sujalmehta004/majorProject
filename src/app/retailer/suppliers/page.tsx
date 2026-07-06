import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SuppliersClient from './SuppliersClient';
import RetailerLayout from '@/components/RetailerLayout';

export const dynamic = 'force-dynamic';

export default async function RetailerSuppliersPage() {
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
    const features = dbUser.allowedFeatures.split(',').map(f => f.trim());
    if (!features.includes('Suppliers')) {
      redirect('/');
    }
  }

  if (!profile) {
    redirect('/subscription-expired');
  }

  const wholesalers = await db.wholesalerProfile.findMany({
    include: {
      products: {
        include: {
          batches: {
            where: {
              availableBaseUnits: { gt: 0 },
              expiryDate: { gt: new Date() },
            },
            orderBy: { expiryDate: 'asc' },
          },
        },
      },
    },
    orderBy: { companyName: 'asc' },
  });

  const customSuppliers = await db.supplier.findMany({
    where: { retailerId: profile.id },
    orderBy: { name: 'asc' },
  });

  // Fetch B2B purchases to extract bought items + settlements per supplier
  const purchases = await db.order.findMany({
    where: { retailerId: profile.id },
    include: {
      items: {
        include: {
          product: true
        }
      },
      b2bSettlements: true,
    }
  });

  const serializedWholesalers = JSON.parse(JSON.stringify(wholesalers));
  const serializedCustomSuppliers = JSON.parse(JSON.stringify(customSuppliers));
  const serializedPurchases = JSON.parse(JSON.stringify(purchases));

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
      <SuppliersClient
        profile={profile}
        initialWholesalers={serializedWholesalers}
        initialCustomSuppliers={serializedCustomSuppliers}
        purchases={serializedPurchases}
      />
    </RetailerLayout>
  );
}
