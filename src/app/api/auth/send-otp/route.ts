import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required.' }, { status: 400 });
    }

    // Check if email already registered and active
    const existingActive = await db.user.findFirst({
      where: { 
        email: email.toLowerCase(),
        isActive: true
      }
    });

    if (existingActive) {
      return NextResponse.json({ error: 'A partner with this email is already registered and active.' }, { status: 400 });
    }

    // Generate 6-digit numeric OTP code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert a temporary inactive user row to hold the OTP code
    // Use transaction or simple upsert
    const tempPasswordHash = '$2b$10$temporarydummyhashforotpverificationpurposesonly';
    
    await db.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        otpCode,
        otpExpiry,
        role,
        isActive: false,
      },
      create: {
        email: email.toLowerCase(),
        passwordHash: tempPasswordHash,
        role,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year lease default
        isActive: false,
        otpCode,
        otpExpiry,
      }
    });

    // Record audit log
    await db.systemAuditLog.create({
      data: {
        action: 'SEND_OTP_ONBOARDING',
        details: `Generated onboarding verification OTP code: "${otpCode}" for ${email.toLowerCase()}`,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Verification code sent (simulated).',
      otpCode // Return code in response for sandbox testing/verification
    });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
