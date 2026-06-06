import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, hashPassword } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionUser();
    
    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized admin access.' }, { status: 403 });
    }

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
        userId: session.userId,
        details: `Superadmin updated plan for user ID: ${id}. Package: ${packageName}, Price: ${packagePrice}, Active: ${isActive}`,
      },
    });

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
    const session = await getSessionUser();
    
    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Unauthorized admin access.' }, { status: 403 });
    }

    const { action } = await request.json();

    if (action === 'reset-password') {
      const tempPass = `MEDHUB-TEMP-${Math.floor(1000 + Math.random() * 9000)}`;
      const passwordHash = await hashPassword(tempPass);

      const updatedUser = await db.user.update({
        where: { id },
        data: {
          passwordHash,
          plainPassword: tempPass, // Store plain temporary password for supervisor display
          forceResetPassword: true,
        },
      });

      await db.systemAuditLog.create({
        data: {
          action: 'SUPERADMIN_RESET_PASSWORD',
          userId: session.userId,
          details: `Superadmin reset password for user ID: ${id}. Forced password reset enabled.`,
        },
      });

      return NextResponse.json({ success: true, tempPassword: tempPass, user: updatedUser });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Superadmin reset password error:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset password' }, { status: 500 });
  }
}
