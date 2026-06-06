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
      customFieldsJson
    } = body;

    if (!companyName || !taxId || !address || !phone) {
      return NextResponse.json({ error: 'Company Name, Tax ID, address, and phone are required.' }, { status: 400 });
    }

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

    // Record audit log
    await db.systemAuditLog.create({
      data: {
        action: 'UPDATE_PROFILE',
        userId: user.userId,
        details: `Updated distributor profile details. Location: [${latitude || 'N/A'}, ${longitude || 'N/A'}]. Custom Fields size: ${customFieldsJson ? (typeof customFieldsJson === 'string' ? JSON.parse(customFieldsJson).length : customFieldsJson.length) : 0}`,
      },
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
