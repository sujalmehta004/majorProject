import React from 'react';
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
  const sales = await db.order.findMany({
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

  // Load B2B purchases
  const purchases = await db.order.findMany({
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
      }}
      profile={{
        id: profile.id,
        pharmacyName: profile.pharmacyName,
        registrationNumber: profile.registrationNumber,
      }}
    >
      <BillingClient
        initialSales={JSON.parse(JSON.stringify(sales))}
        initialPurchases={JSON.parse(JSON.stringify(purchases))}
        initialRelations={JSON.parse(JSON.stringify(relations))}
        initialLedgers={JSON.parse(JSON.stringify(ledgers))}
        initialReturnRequests={JSON.parse(JSON.stringify(returnRequests))}
        profileId={profile.id}
      />
    </RetailerLayout>
  );
}
