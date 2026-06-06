import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const wholesalerId = searchParams.get('wholesalerId');

    if (!wholesalerId) {
      return NextResponse.json({ error: 'Missing wholesalerId' }, { status: 400 });
    }

    if (!q.trim()) {
      return NextResponse.json({ medicines: [], transactions: [], customers: [] });
    }

    // 1. Search Medicines / Products (including batch search)
    const medicines = await db.product.findMany({
      where: {
        wholesalerId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          {
            batches: {
              some: {
                batchNumber: { contains: q, mode: 'insensitive' },
              },
            },
          },
        ],
      },
      include: {
        batches: true,
      },
      take: 5,
    });

    // 2. Search Transactions / Orders (by ID, customer name, sku, batch, or products)
    const transactions = await db.order.findMany({
      where: {
        wholesalerId,
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { retailer: { pharmacyName: { contains: q, mode: 'insensitive' } } },
          {
            items: {
              some: {
                product: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { sku: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            },
          },
        ],
      },
      include: {
        retailer: {
          include: {
            user: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // 3. Search Retailers / Customers (without requiring transactions)
    const customers = await db.retailerProfile.findMany({
      where: {
        OR: [
          { pharmacyName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { user: { fullName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: {
        user: true,
        orders: true,
      },
      take: 5,
    });

    return NextResponse.json({
      medicines,
      transactions,
      customers,
    });
  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
