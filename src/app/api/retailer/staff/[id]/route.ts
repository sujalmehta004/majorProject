import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { fullName, allowedFeatures, password, isActive } = body;

    const updatePayload: any = {
      fullName,
      allowedFeatures,
      isActive,
    };

    if (password) {
      updatePayload.passwordHash = await bcrypt.hash(password, 10);
      updatePayload.plainPassword = password;
    }

    const staffUser = await db.user.update({
      where: { id },
      data: updatePayload,
    });

    await db.systemAuditLog.create({
      data: {
        action: 'UPDATE_RETAIL_STAFF',
        userId: user.userId,
        details: `Updated shop employee: ${staffUser.fullName} (${staffUser.email})`,
      },
    });

    return NextResponse.json({ success: true, staff: staffUser });
  } catch (error: any) {
    console.error('Error updating retailer staff:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const staffUser = await db.user.delete({
      where: { id },
    });

    await db.systemAuditLog.create({
      data: {
        action: 'DELETE_RETAIL_STAFF',
        userId: user.userId,
        details: `Deleted shop employee account: ${staffUser.fullName} (${staffUser.email})`,
      },
    });

    return NextResponse.json({ success: true, message: 'Retail staff deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting retailer staff:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
