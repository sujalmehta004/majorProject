import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { broadcastToSuperadmin } from '@/app/api/events/route';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isActive, packageName, packagePrice, subscriptionEnd, allowedFeatures } = await request.json();

    const updatedUser = await db.user.update({
      where: { id },
      data: {
        isActive,
        packageName,
        packagePrice: parseFloat(packagePrice) || 0,
        subscriptionEnd: new Date(subscriptionEnd),
        allowedFeatures: Array.isArray(allowedFeatures) ? allowedFeatures.join(',') : allowedFeatures,
      },
    });

    await db.systemAuditLog.create({
      data: {
        action: 'SUPERADMIN_UPDATE_PLAN',
        userId: id,
        details: `Superadmin updated plan for user ID: ${id}. Package: ${packageName}, Price: ${packagePrice}, Active: ${isActive}`,
      },
    });

    broadcastToSuperadmin('USER_PLAN_UPDATE', { userId: id, packageName, isActive });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Superadmin update plan error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action, rejectReason } = await request.json();

    if (action === 'reset-password') {
      const tempPass = `MEDHUB-TEMP-${Math.floor(1000 + Math.random() * 9000)}`;
      const passwordHash = await hashPassword(tempPass);

      const updatedUser = await db.user.update({
        where: { id },
        data: {
          passwordHash,
          plainPassword: tempPass,
          forceResetPassword: true,
        },
      });

      await db.systemAuditLog.create({
        data: {
          action: 'SUPERADMIN_RESET_PASSWORD',
          userId: id,
          details: `Superadmin reset password for user ID: ${id}. Forced password reset enabled.`,
        },
      });

      return NextResponse.json({ success: true, tempPassword: tempPass, user: updatedUser });
    }

    if (action === 'verify') {
      const updatedUser = await db.user.update({
        where: { id },
        data: {
          isVerified: true,
          verificationStatus: 'VERIFIED',
          verificationRejectReason: null,
        },
      });

      await db.systemAuditLog.create({
        data: {
          action: 'SUPERADMIN_VERIFY_USER',
          userId: id,
          details: `Superadmin approved & verified partner account for user ID: ${id} (${updatedUser.email}).`,
        },
      });

      broadcastToSuperadmin('VERIFICATION_UPDATE', { userId: id, action: 'verify', email: updatedUser.email });

      return NextResponse.json({ success: true, user: updatedUser });
    }

    if (action === 'reject') {
      const updatedUser = await db.user.update({
        where: { id },
        data: {
          isVerified: false,
          verificationStatus: 'REJECTED',
          verificationRejectReason: rejectReason || 'Registration details or document images incomplete.',
        },
      });

      await db.systemAuditLog.create({
        data: {
          action: 'SUPERADMIN_REJECT_USER',
          userId: id,
          details: `Superadmin rejected partner verification for user ID: ${id}. Reason: ${rejectReason}`,
        },
      });

      broadcastToSuperadmin('VERIFICATION_UPDATE', { userId: id, action: 'reject', email: updatedUser.email });

      return NextResponse.json({ success: true, user: updatedUser });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Superadmin action error:', error);
    return NextResponse.json({ error: error.message || 'Failed action' }, { status: 500 });
  }
}
