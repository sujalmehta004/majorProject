import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, setSessionCookie } from '@/lib/auth';
import { Role } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      role,
      otpCode,
      // Wholesaler fields
      companyName,
      taxId,
      address,
      phone,
      // Retailer fields
      pharmacyName,
      registrationNumber,
      latitude,
      longitude,
      // Clinic fields
      clinicName,
      licenseNumber,
    } = body;

    // Validate request
    if (!email || !password || !role || !otpCode) {
      return NextResponse.json({ error: 'Email, password, role, and verification code are required.' }, { status: 400 });
    }

    if (!Object.values(Role).includes(role)) {
      return NextResponse.json({ error: 'Invalid user role' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'Verification code not found. Please request an OTP code first.' }, { status: 400 });
    }

    if (existingUser.isActive) {
      return NextResponse.json({ error: 'A partner with this email already exists and is active.' }, { status: 400 });
    }

    // Validate OTP Code
    if (existingUser.otpCode !== otpCode.trim()) {
      return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 });
    }

    if (existingUser.otpExpiry && new Date() > new Date(existingUser.otpExpiry)) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    // Compute dates: 365 days evaluation plan
    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionStart.getDate() + 365);

    // Hash password (12 rounds)
    const passwordHash = await hashPassword(password);

    // Isolated database transaction
    const user = await db.$transaction(async (tx) => {
      // Update temporary user to active status
      const updatedUser = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          role,
          subscriptionStart,
          subscriptionEnd,
          isActive: true,
          otpCode: null,
          otpExpiry: null,
          plainPassword: password, // For owner visibility during evaluation
        },
      });

      // Create profile based on selected role
      if (role === Role.WHOLESALER) {
        if (!companyName || !taxId || !address || !phone) {
          throw new Error('Wholesaler profiles require company name, Tax/VAT ID, address, and phone number.');
        }
        await tx.wholesalerProfile.create({
          data: {
            userId: updatedUser.id,
            companyName,
            taxId,
            address,
            phone,
          },
        });
      } else if (role === Role.RETAILER) {
        if (!pharmacyName || !registrationNumber || !address || !phone) {
          throw new Error('Retailer profiles require pharmacy name, registration number, address, and phone.');
        }
        await tx.retailerProfile.create({
          data: {
            userId: updatedUser.id,
            pharmacyName,
            registrationNumber,
            address,
            phone,
            latitude: latitude ? parseFloat(latitude) : 27.7172,
            longitude: longitude ? parseFloat(longitude) : 85.3240,
          },
        });
      } else if (role === Role.CLINIC) {
        if (!clinicName || !licenseNumber || !address || !phone) {
          throw new Error('Clinic profiles require clinic name, license number, address, and phone.');
        }
        await tx.clinicProfile.create({
          data: {
            userId: updatedUser.id,
            clinicName,
            licenseNumber,
            address,
            phone,
          },
        });
      }

      // Record audit log
      await tx.systemAuditLog.create({
        data: {
          action: 'REGISTER_USER',
          userId: updatedUser.id,
          details: `User registered successfully with role ${role} after verification.`,
        },
      });

      return updatedUser;
    });

    // Generate session payload and cookie
    const sessionPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      subscriptionEnd: subscriptionEnd.toISOString(),
      isActive: true,
    };

    await setSessionCookie(sessionPayload);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        subscriptionStart: user.subscriptionStart,
        subscriptionEnd: user.subscriptionEnd,
      },
    });
  } catch (error: any) {
    console.error('Registration failed:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
