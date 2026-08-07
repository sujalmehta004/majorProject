import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'RETAILER' && user.role !== 'RETAILER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await db.user.findUnique({ where: { id: user.userId } });
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let profile = null;
    if (user.role === 'RETAILER') {
      profile = await db.retailerProfile.findUnique({ where: { userId: user.userId } });
    } else if (user.role === 'RETAILER_STAFF' && dbUser.retailerId) {
      profile = await db.retailerProfile.findUnique({ where: { id: dbUser.retailerId } });
    }

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Calculate monthly analytics for past 6 months dynamically based on real B2C sales and B2B orders
    const now = new Date();
    const monthlyAnalytics: { name: string; Sales: number; Spend: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthLabel = d.toLocaleString('en-US', { month: 'Short' });

      // B2C POS sales in this month
      const posSales = await db.order.aggregate({
        where: {
          retailerId: profile.id,
          overrideJustification: { contains: 'B2C POS' },
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { netAmount: true },
      });

      // B2C Online sales in this month
      const consumerSales = await db.consumerOrder.aggregate({
        where: {
          retailerId: profile.id,
          status: 'DELIVERED',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { totalAmount: true, deliveryFee: true },
      });

      const totalSales = (posSales._sum.netAmount || 0) + (consumerSales._sum.totalAmount || 0) + (consumerSales._sum.deliveryFee || 0);

      // B2B Procurement spend in this month
      const b2bSpend = await db.order.aggregate({
        where: {
          retailerId: profile.id,
          overrideJustification: null,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { netAmount: true },
      });

      monthlyAnalytics.push({
        name: monthLabel,
        Sales: Math.round(totalSales),
        Spend: Math.round(b2bSpend._sum.netAmount || 0),
      });
    }

    return NextResponse.json({
      success: true,
      chartData: monthlyAnalytics,
    });
  } catch (error: any) {
    console.error('Error fetching retailer analytics:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
