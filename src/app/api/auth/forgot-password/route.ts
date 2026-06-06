import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // For security obfuscation, we return success even if user not found,
      // but in this sandbox simulation we'll indicate if it succeeded or not.
      return NextResponse.json({ 
        success: true, 
        message: 'If a matching account exists, a recovery code has been initialized.' 
      });
    }

    // Generate simulated temporary passcode
    const tempPassword = `RESET-${Math.floor(100000 + Math.random() * 900000)}`;
    const passwordHash = await hashPassword(tempPassword);

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        plainPassword: tempPassword,
        forceResetPassword: true,
      },
    });

    // Record system log
    await db.systemAuditLog.create({
      data: {
        action: 'FORGOT_PASSWORD_REQUEST',
        userId: user.id,
        details: `Forgot password request for ${user.email}. Temporary passcode: "${tempPassword}" (forces reset on login).`,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Password reset link sent (simulated).',
      tempPassword // Return for easy Sprint 1 demo/testing
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const passwordHash = await hashPassword(password);

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        plainPassword: password,
        forceResetPassword: false,
      },
    });

    // Record system log
    await db.systemAuditLog.create({
      data: {
        action: 'RESET_PASSWORD_COMPLETE',
        userId: user.id,
        details: `Forced password reset complete for ${user.email}.`,
      },
    });

    return NextResponse.json({ success: true, message: 'Password updated successfully.' });
  } catch (error: any) {
    console.error('Forced password reset complete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
