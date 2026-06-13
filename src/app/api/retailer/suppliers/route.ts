import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all wholesalers and their products containing batches with available stock
    const wholesalers = await db.wholesalerProfile.findMany({
      include: {
        products: {
          include: {
            batches: {
              where: {
                availableBaseUnits: { gt: 0 },
                expiryDate: { gt: new Date() },
              },
            },
          },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    return NextResponse.json({ success: true, wholesalers });
  } catch (error: any) {
    console.error('Error fetching wholesalers:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
