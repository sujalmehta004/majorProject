import React from 'react';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';
import WholesalerLayout from '@/components/WholesalerLayout';

export const dynamic = 'force-dynamic';

export default async function WholesalerSettingsPage() {
  const user = await getSessionUser();
  if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
    redirect('/');
  }

  let dbUser = await db.user.findUnique({
    where: { id: user.userId },
  });

  let profile = null;
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

  // Fetch staff list if owner, or if staff (empty)
  let staff: any[] = [];
  if (user.role === 'WHOLESALER') {
    staff = await db.user.findMany({
      where: {
        wholesalerId: profile.id,
        role: 'WHOLESALER_STAFF',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        plainPassword: true,
        allowedFeatures: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Fetch audit logs if allowed
  let auditLogs: any[] = [];
  const allowedList = dbUser?.allowedFeatures 
    ? dbUser.allowedFeatures.split(',') 
    : ["Dashboard", "Medicines", "Orders", "Billing", "POS", "Profile", "Logs"];

  const hasLogsAccess = user.role === 'WHOLESALER' || allowedList.includes('Logs');

  if (hasLogsAccess) {
    // If owner, fetch owner + staff logs. If staff, fetch all logs for this wholesaler's accounts
    let relatedUserIds: string[] = [profile.userId];
    if (user.role === 'WHOLESALER') {
      const staffIds = staff.map(s => s.id);
      relatedUserIds = [profile.userId, ...staffIds];
    } else {
      // Find all users belonging to this wholesaler to get their logs
      const wholesalerStaff = await db.user.findMany({
        where: { wholesalerId: profile.id },
        select: { id: true }
      });
      relatedUserIds = [profile.userId, ...wholesalerStaff.map(s => s.id)];
    }

    auditLogs = await db.systemAuditLog.findMany({
      take: 150,
      orderBy: { timestamp: 'desc' },
      where: {
        userId: {
          in: relatedUserIds,
        },
      },
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
  }

  const ownerUser = await db.user.findUnique({
    where: { id: profile.userId },
  });

  const serializedProfile = JSON.parse(JSON.stringify(profile));
  const serializedStaff = JSON.parse(JSON.stringify(staff));
  const serializedLogs = JSON.parse(JSON.stringify(auditLogs));

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
      <SettingsClient
        userRole={user.role}
        allowedFeaturesList={allowedList}
        initialProfile={serializedProfile}
        subscriptionEnd={ownerUser?.subscriptionEnd ? ownerUser.subscriptionEnd.toISOString() : ''}
        initialStaff={serializedStaff}
        initialLogs={serializedLogs}
      />
    </WholesalerLayout>
  );
}
