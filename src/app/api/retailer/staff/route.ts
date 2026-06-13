import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const retailer = await db.retailerProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!retailer) {
      return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
    }

    const staff = await db.user.findMany({
      where: {
        retailerId: retailer.id,
        role: Role.RETAILER_STAFF,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        allowedFeatures: true,
        isActive: true,
        createdAt: true,
        plainPassword: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, staff });
  } catch (error: any) {
    console.error('Error fetching retailer staff:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const retailer = await db.retailerProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!retailer) {
      return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { email, password, fullName, allowedFeatures } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check email availability
    const existing = await db.user.findUnique({
      where: { email },
    });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const passHash = await bcrypt.hash(password, 10);

    const staffUser = await db.user.create({
      data: {
        email,
        passwordHash: passHash,
        role: Role.RETAILER_STAFF,
        fullName,
        allowedFeatures: allowedFeatures || 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs',
        retailerId: retailer.id,
        subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
        plainPassword: password,
      },
    });

    await db.systemAuditLog.create({
      data: {
        action: 'CREATE_RETAIL_STAFF',
        userId: user.userId,
        details: `Created shop employee: ${fullName} (${email})`,
      },
    });

    return NextResponse.json({ success: true, staff: staffUser });
  } catch (error: any) {
    console.error('Error creating retailer staff:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
