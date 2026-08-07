import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'WHOLESALER') {
      return NextResponse.json({ error: 'Unauthorized. Only the owner can update profile settings.' }, { status: 401 });
    }

    const profile = await db.wholesalerProfile.findUnique({
      where: { userId: user.userId },
    });
    if (!profile) {
      return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { 
      companyName, 
      taxId, 
      address, 
      phone, 
      registrationNumber, 
      contactPerson, 
      latitude, 
      longitude,
      customFieldsJson,
      registrationImages,
      phoneOnly,
    } = body;

    // Phone-only update: just update phone, no verification status change
    if (phoneOnly) {
      await db.wholesalerProfile.update({
        where: { id: profile.id },
        data: { phone },
      });
      await db.systemAuditLog.create({
        data: {
          action: 'UPDATE_WHOLESALER_PHONE',
          userId: user.userId,
          details: `Updated company phone number to: ${phone}`,
        },
      });
      return NextResponse.json({ success: true });
    }

    if (!companyName || !taxId || !address || !phone) {
      return NextResponse.json({ error: 'Company Name, Tax ID, address, and phone are required.' }, { status: 400 });
    }

    const currentDbUser = await db.user.findUnique({
      where: { id: user.userId },
    });
    const isVerified = currentDbUser?.isVerified && currentDbUser?.verificationStatus === 'VERIFIED';

    const updatedProfile = await db.wholesalerProfile.update({
      where: { id: profile.id },
      data: {
        companyName,
        taxId,
        address,
        phone,
        registrationNumber,
        contactPerson,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        customFieldsJson: customFieldsJson ? (typeof customFieldsJson === 'string' ? customFieldsJson : JSON.stringify(customFieldsJson)) : '[]',
      },
    });

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

    // Record audit log
    await db.systemAuditLog.create({
      data: {
        action: 'UPDATE_PROFILE',
        userId: user.userId,
        details: `Updated distributor profile. Reset status to PENDING for verification. Company: ${companyName}, Tax ID: ${taxId}`,
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
