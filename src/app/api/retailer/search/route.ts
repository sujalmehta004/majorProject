import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'RETAILER' && user.role !== 'RETAILER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const retailerId = searchParams.get('retailerId') || '';

    if (!q) {
      return NextResponse.json({ medicines: [], transactions: [], suppliers: [] });
    }

    // 1. Search in Retailer Inventory (medicines)
    const medicines = await db.retailerInventory.findMany({
      where: {
        retailerId,
        OR: [
          { product: { name: { contains: q, mode: 'insensitive' } } },
          { product: { sku: { contains: q, mode: 'insensitive' } } },
          { batchNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        product: true,
      },
      take: 5,
    });

    // 2. Search in orders / transactions
    const transactions = await db.order.findMany({
      where: {
        retailerId,
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { overrideJustification: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        wholesaler: true,
      },
      take: 5,
    });

    // 3. Search Wholesalers (suppliers)
    const wholesalers = await db.wholesalerProfile.findMany({
      where: {
        OR: [
          { companyName: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });

    return NextResponse.json({
      medicines: medicines.map((m) => m.product),
      transactions,
      suppliers: wholesalers,
    });
  } catch (error: any) {
    console.error('Error during search:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
