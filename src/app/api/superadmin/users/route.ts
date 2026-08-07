import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/users
 * Lightweight endpoint for real-time user list refresh from the superadmin dashboard.
 * Called by the SSE event handler when VERIFICATION_UPDATE or USER_PLAN_UPDATE fires.
 */
export async function GET() {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        wholesalerProfile: {
          include: {
            products: { take: 50, include: { batches: true } },
            orders: { take: 50, include: { retailer: true }, orderBy: { createdAt: 'desc' } },
            staff: true,
          }
        },
        retailerProfile: {
          include: {
            inventories: { take: 50, include: { product: true } },
            orders: { take: 50, include: { wholesaler: true }, orderBy: { createdAt: 'desc' } },
            staff: true,
          }
        },
        clinicProfile: true,
        auditLogs: { take: 30, orderBy: { timestamp: 'desc' } },
      },
    });

    const serializedUsers = JSON.parse(JSON.stringify(users));
    return NextResponse.json({ users: serializedUsers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
