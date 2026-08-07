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
    const { pharmacyName, address, phone, latitude, longitude, registrationImages, phoneOnly } = body;

    // Phone-only update: just update phone, no verification status change
    if (phoneOnly) {
      await db.retailerProfile.update({
        where: { userId: user.userId },
        data: { phone },
      });
      await db.systemAuditLog.create({
        data: {
          action: 'UPDATE_RETAILER_PHONE',
          userId: user.userId,
          details: `Updated store phone number to: ${phone}`,
        },
      });
      return NextResponse.json({ success: true });
    }

    const currentDbUser = await db.user.findUnique({
      where: { id: user.userId },
    });

    const isVerified = currentDbUser?.isVerified && currentDbUser?.verificationStatus === 'VERIFIED';

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

    // If images or core registration details are updated, update images and reset verification to PENDING for superadmin re-evaluation
    const userUpdateData: any = {};
    if (Array.isArray(registrationImages) && registrationImages.length > 0) {
      userUpdateData.registrationImagesJson = JSON.stringify(registrationImages);
    }

    if (!isVerified || (Array.isArray(registrationImages) && registrationImages.length > 0)) {
      userUpdateData.isVerified = false;
      userUpdateData.verificationStatus = 'PENDING';
      userUpdateData.verificationRejectReason = null;
    }

    if (Object.keys(userUpdateData).length > 0) {
      await db.user.update({
        where: { id: user.userId },
        data: userUpdateData,
      });
    }

    await db.systemAuditLog.create({
      data: {
        action: 'UPDATE_RETAILER_PROFILE',
        userId: user.userId,
        details: `Updated retailer profile. Reset status to PENDING for verification. ${pharmacyName}, ${address}, Phone: ${phone}`,
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error updating retailer profile:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
