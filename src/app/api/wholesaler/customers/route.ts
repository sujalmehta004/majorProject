import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getWholesalerId(user: any) {
  if (user.role === 'WHOLESALER') {
    const profile = await db.wholesalerProfile.findUnique({
      where: { userId: user.userId },
    });
    return profile?.id || null;
  } else if (user.role === 'WHOLESALER_STAFF') {
    const dbUser = await db.user.findUnique({
      where: { id: user.userId },
    });
    return dbUser?.wholesalerId || null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const wholesalerProfileId = await getWholesalerId(user);
    if (!wholesalerProfileId) {
      return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
    }

    const customers = await db.retailerProfile.findMany({
      where: {
        OR: [
          { wholesalerId: wholesalerProfileId },
          { orders: { some: { wholesalerId: wholesalerProfileId } } }
        ]
      },
      include: {
        user: true,
        orders: {
          where: {
            wholesalerId: wholesalerProfileId,
            NOT: { overrideJustification: { contains: 'B2C POS' } }
          },
          include: {
            b2bSettlements: true,
            items: {
              include: {
                product: true
              }
            }
          }
        },
        wholesalerRelations: {
          where: { wholesalerId: wholesalerProfileId }
        }
      }
    });

    const formattedCustomers = customers.map(c => {
      const relation = c.wholesalerRelations?.[0];
      return {
        ...c,
        creditLimit: relation ? relation.creditLimit : c.creditLimit,
        advanceBalance: relation ? relation.advanceBalance : 0,
        wholesalerRelations: undefined
      };
    });

    return NextResponse.json({ success: true, customers: formattedCustomers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const wholesalerProfileId = await getWholesalerId(user);
    if (!wholesalerProfileId) {
      return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { pharmacyName, phone, email, fullName, address } = body;

    if (!pharmacyName || !phone || !email || !fullName || !address) {
      return NextResponse.json({ error: 'Missing required customer details' }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email }
    });
    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 });
    }

    const newCustomer = await db.$transaction(async (tx) => {
      // 1. Create retailer user
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash: '$2b$10$dummyhashplaceholderforretailercreationsecurity', // Default password hash
          role: 'RETAILER',
          fullName,
          isActive: true,
          subscriptionEnd: new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000), // 50 years lease
        }
      });

      // 2. Create retailer profile
      const profile = await tx.retailerProfile.create({
        data: {
          userId: createdUser.id,
          wholesalerId: wholesalerProfileId,
          pharmacyName,
          registrationNumber: 'REG-' + Math.floor(Math.random() * 1000000),
          address,
          phone,
          latitude: 27.7172,
          longitude: 85.3240,
          creditLimit: 200000,
        },
        include: {
          user: true
        }
      });

      return profile;
    });

    return NextResponse.json({ success: true, customer: newCustomer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const wholesalerProfileId = await getWholesalerId(user);
    if (!wholesalerProfileId) {
      return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { id, creditLimit, lifetimeSpend, phone, address, registrationNumber } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing customer ID' }, { status: 400 });
    }

    // Verify ownership or relationship (direct customer OR has placed orders)
    const customer = await db.retailerProfile.findFirst({
      where: {
        id,
        OR: [
          { wholesalerId: wholesalerProfileId },
          { orders: { some: { wholesalerId: wholesalerProfileId } } }
        ]
      }
    });
    if (!customer) {
      return NextResponse.json({ error: 'Access denied or customer not found' }, { status: 403 });
    }

    if (creditLimit !== undefined) {
      await db.wholesalerRetailerRelation.upsert({
        where: {
          wholesalerId_retailerId: {
            wholesalerId: wholesalerProfileId,
            retailerId: id,
          }
        },
        update: {
          creditLimit: parseFloat(creditLimit),
        },
        create: {
          wholesalerId: wholesalerProfileId,
          retailerId: id,
          creditLimit: parseFloat(creditLimit),
        }
      });
    }

    const updatedCustomer = await db.retailerProfile.update({
      where: { id },
      data: {
        lifetimeSpend: lifetimeSpend !== undefined ? parseFloat(lifetimeSpend) : undefined,
        phone: phone !== undefined ? phone : undefined,
        address: address !== undefined ? address : undefined,
        registrationNumber: registrationNumber !== undefined ? registrationNumber : undefined,
      },
      include: {
        user: true,
        wholesalerRelations: {
          where: { wholesalerId: wholesalerProfileId }
        }
      }
    });

    const relation = updatedCustomer.wholesalerRelations?.[0];
    const formattedCustomer = {
      ...updatedCustomer,
      creditLimit: relation ? relation.creditLimit : updatedCustomer.creditLimit,
      advanceBalance: relation ? relation.advanceBalance : 0,
      wholesalerRelations: undefined,
    };

    return NextResponse.json({ success: true, customer: formattedCustomer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
