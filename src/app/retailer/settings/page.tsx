import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';
import RetailerLayout from '@/components/RetailerLayout';

export const dynamic = 'force-dynamic';

export default async function RetailerSettingsPage() {
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
    if (!features.includes('Settings')) {
      redirect('/');
    }
  }

  if (!profile) {
    redirect('/subscription-expired');
  }

  const ownerUser = await db.user.findUnique({
    where: { id: profile.userId },
  });

  // Fetch staff list
  const staff = await db.user.findMany({
    where: {
      retailerId: profile.id,
      role: 'RETAILER_STAFF',
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      allowedFeatures: true,
      isActive: true,
      createdAt: true,
      plainPassword: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const staffIds = staff.map(s => s.id);
  const relatedUserIds = [profile.userId, ...staffIds];

  // Fetch audit logs for this retailer & staff
  const auditLogs = await db.systemAuditLog.findMany({
    take: 150,
    orderBy: { timestamp: 'desc' },
    where: { userId: { in: relatedUserIds } },
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
          role: true,
        },
      },
    },
  });

  const serializedProfile = JSON.parse(JSON.stringify(profile));
  const serializedLogs = JSON.parse(JSON.stringify(auditLogs));
  const serializedStaff = JSON.parse(JSON.stringify(staff));

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
      <SettingsClient
        initialProfile={serializedProfile}
        subscriptionEnd={ownerUser?.subscriptionEnd ? ownerUser.subscriptionEnd.toISOString() : ''}
        initialLogs={serializedLogs}
        initialStaff={serializedStaff}
      />
    </RetailerLayout>
  );
}
