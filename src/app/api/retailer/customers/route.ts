import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { Role } from '@prisma/client';

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

    // Load all B2C customers registered under this retailer (role: CONSUMER)
    // Or users whose password hashes are placeholder and role is CONSUMER
    const consumers = await db.user.findMany({
      where: {
        role: Role.CONSUMER,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, customers: consumers });
  } catch (error: any) {
    console.error('Error fetching retailer customers:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, fullName, phone, address } = body;

    if (!email || !fullName) {
      return NextResponse.json({ error: 'Email and Full Name are required' }, { status: 400 });
    }

    const existing = await db.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    const newConsumer = await db.user.create({
      data: {
        email,
        fullName,
        passwordHash: '$2b$10$dummyconsumerhashplaceholder',
        role: Role.CONSUMER,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, customer: newConsumer });
  } catch (error: any) {
    console.error('Error creating consumer:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
