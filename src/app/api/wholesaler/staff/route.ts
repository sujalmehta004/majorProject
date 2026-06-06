import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, hashPassword } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let wholesalerProfileId = '';
    if (user.role === 'WHOLESALER') {
      const profile = await db.wholesalerProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!profile) return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
      wholesalerProfileId = profile.id;
    } else {
      const dbUser = await db.user.findUnique({
        where: { id: user.userId },
      });
      if (!dbUser || !dbUser.wholesalerId) {
        return NextResponse.json({ error: 'Wholesaler association not found' }, { status: 404 });
      }
      wholesalerProfileId = dbUser.wholesalerId;
    }

    const staffList = await db.user.findMany({
      where: {
        wholesalerId: wholesalerProfileId,
        role: 'WHOLESALER_STAFF',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        plainPassword: true,
        allowedFeatures: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, staff: staffList });
  } catch (error: any) {
    console.error('Error fetching staff list:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    // Only the primary wholesaler owner can create staff accounts
    if (!user || user.role !== 'WHOLESALER') {
      return NextResponse.json({ error: 'Unauthorized. Only the owner can manage staff.' }, { status: 401 });
    }

    const profile = await db.wholesalerProfile.findUnique({
      where: { userId: user.userId },
    });
    if (!profile) {
      return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { email, password, fullName, allowedFeatures } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Email, password, and full name are required' }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const featuresStr = Array.isArray(allowedFeatures)
      ? allowedFeatures.join(',')
      : (allowedFeatures || 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs');

    // Create staff member associated with the wholesaler profile
    // Set subscriptionEnd to owner's subscriptionEnd to match lease
    const ownerUser = await db.user.findUnique({
      where: { id: user.userId },
    });

    const newStaff = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        plainPassword: password,
        allowedFeatures: featuresStr,
        role: 'WHOLESALER_STAFF',
        fullName,
        wholesalerId: profile.id,
        subscriptionStart: new Date(),
        subscriptionEnd: ownerUser?.subscriptionEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    // Log the creation
    await db.systemAuditLog.create({
      data: {
        action: 'CREATE_STAFF',
        userId: user.userId,
        details: `Created staff member account: ${fullName} (${email.toLowerCase()}) with features: [${featuresStr}]`,
      },
    });

    return NextResponse.json({
      success: true,
      staff: {
        id: newStaff.id,
        email: newStaff.email,
        fullName: newStaff.fullName,
        isActive: newStaff.isActive,
      },
    });
  } catch (error: any) {
    console.error('Error creating staff account:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
