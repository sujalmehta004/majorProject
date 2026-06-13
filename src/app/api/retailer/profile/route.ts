import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pharmacyName, address, phone, latitude, longitude } = body;

    const profile = await db.retailerProfile.update({
      where: { userId: user.userId },
      data: {
        pharmacyName,
        address,
        phone,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
    });

    await db.systemAuditLog.create({
      data: {
        action: 'UPDATE_RETAILER_PROFILE',
        userId: user.userId,
        details: `Updated retailer profile details: ${pharmacyName}, ${address}, Phone: ${phone}`,
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error updating retailer profile:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
