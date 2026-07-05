import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OrdersClient from './OrdersClient';
import RetailerLayout from '@/components/RetailerLayout';

export const dynamic = 'force-dynamic';

export default async function RetailerOrdersPage() {
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
    if (!features.includes('Orders')) {
      redirect('/');
    }
  }

  if (!profile) {
    redirect('/subscription-expired');
  }

  // Fetch B2B wholesaler orders placed by this retailer
  const orders = await db.order.findMany({
    where: {
      retailerId: profile.id,
      OR: [
        { overrideJustification: null },
        {
          NOT: {
            overrideJustification: { contains: 'B2C POS' },
          },
        },
      ],
    },
    include: {
      wholesaler: true,
      items: {
        include: {
          product: true,
        },
      },
      inTransitLogs: {
        include: {
          batch: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch all wholesalers and their active product catalog with available batches
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

  // Fetch B2C online consumer orders placed at this retailer
  const consumerOrders = await db.consumerOrder.findMany({
    where: { retailerId: profile.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const serializedOrders = JSON.parse(JSON.stringify(orders));
  const serializedWholesalers = JSON.parse(JSON.stringify(wholesalers));
  const serializedConsumerOrders = JSON.parse(JSON.stringify(consumerOrders));

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
      <OrdersClient
        initialOrders={serializedOrders}
        wholesalers={serializedWholesalers}
        profileId={profile.id}
        initialConsumerOrders={serializedConsumerOrders}
      />
    </RetailerLayout>
  );
}
