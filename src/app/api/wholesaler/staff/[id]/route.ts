import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, hashPassword } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    
    // Only the primary wholesaler owner can update staff settings
    if (!user || user.role !== 'WHOLESALER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await db.wholesalerProfile.findUnique({
      where: { userId: user.userId },
    });
    if (!profile) {
      return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { email, password, fullName, allowedFeatures, isActive } = body;

    // Check if target user belongs to this wholesaler
    const targetUser = await db.user.findUnique({
      where: { id },
    });

    if (!targetUser || targetUser.wholesalerId !== profile.id) {
      return NextResponse.json({ error: 'Staff account not found or unauthorized' }, { status: 404 });
    }

    const dataToUpdate: Record<string, any> = {};
    if (fullName) dataToUpdate.fullName = fullName;
    if (email) dataToUpdate.email = email.toLowerCase();
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    
    if (password) {
      dataToUpdate.passwordHash = await hashPassword(password);
      dataToUpdate.plainPassword = password;
    }

    if (allowedFeatures) {
      dataToUpdate.allowedFeatures = Array.isArray(allowedFeatures)
        ? allowedFeatures.join(',')
        : allowedFeatures;
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: dataToUpdate,
    });

    // Log action
    await db.systemAuditLog.create({
      data: {
        action: 'UPDATE_STAFF',
        userId: user.userId,
        details: `Updated settings for staff member: ${updatedUser.fullName} (${updatedUser.email})`,
      },
    });

    return NextResponse.json({ success: true, staff: updatedUser });
  } catch (error: any) {
    console.error('Error updating staff details:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();

    // Only the owner can delete staff
    if (!user || user.role !== 'WHOLESALER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await db.wholesalerProfile.findUnique({
      where: { userId: user.userId },
    });
    if (!profile) {
      return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
    }

    // Verify staff belongs to this wholesaler
    const targetUser = await db.user.findUnique({
      where: { id },
    });

    if (!targetUser || targetUser.wholesalerId !== profile.id) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    await db.user.delete({
      where: { id },
    });

    // Log deletion
    await db.systemAuditLog.create({
      data: {
        action: 'DELETE_STAFF',
        userId: user.userId,
        details: `Deleted staff member account: ${targetUser.fullName} (${targetUser.email})`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
