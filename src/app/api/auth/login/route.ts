import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { comparePassword, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const now = new Date();
    const isExpired = now > new Date(user.subscriptionEnd);

    if (isExpired) {
      // Deactivate user dynamically
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { isActive: false },
        });

        await tx.systemAuditLog.create({
          data: {
            action: 'LOGIN_SUBSCRIPTION_EXPIRY',
            userId: user.id,
            details: `User attempted login but subscription was expired. System flipped isActive to false.`,
          },
        });
      });

      return NextResponse.json(
        { error: 'Subscription Expired. Access Revoked.' },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // Set cookie
    const sessionPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscriptionEnd: user.subscriptionEnd.toISOString(),
      isActive: user.isActive,
    };

    await setSessionCookie(sessionPayload);

    if (user.forceResetPassword) {
      return NextResponse.json({
        success: true,
        forceResetPassword: true,
      });
    }

    // Determine dashboard redirect
    let redirectUrl = '/';
    if (user.role === 'WHOLESALER' || user.role === 'WHOLESALER_STAFF') redirectUrl = '/wholesaler/dashboard';
    else if (user.role === 'RETAILER' || user.role === 'RETAILER_STAFF') redirectUrl = '/retailer/dashboard';
    else if (user.role === 'SUPERADMIN') redirectUrl = '/superadmin/matrix-dashboard';
    else if (user.role === 'CLINIC') redirectUrl = '/'; // CLINIC has no functional dashboard in Sprint 1

    return NextResponse.json({
      success: true,
      role: user.role,
      redirectUrl,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
