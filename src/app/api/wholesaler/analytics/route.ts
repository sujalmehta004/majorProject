import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly'; // daily | weekly | monthly | yearly
    const wholesalerId = searchParams.get('wholesalerId');

    if (!wholesalerId) return NextResponse.json({ error: 'Missing wholesalerId' }, { status: 400 });

    // Date range based on period
    const now = new Date();
    let startDate: Date;
    let buckets: number;

    switch (period) {
      case 'daily':
        startDate = new Date(now); startDate.setDate(now.getDate() - 13); // last 14 days
        buckets = 14;
        break;
      case 'weekly':
        startDate = new Date(now); startDate.setDate(now.getDate() - 11 * 7); // last 12 weeks
        buckets = 12;
        break;
      case 'yearly':
        startDate = new Date(now); startDate.setFullYear(now.getFullYear() - 4); // last 5 years
        buckets = 5;
        break;
      default: // monthly
        startDate = new Date(now); startDate.setMonth(now.getMonth() - 11); // last 12 months
        buckets = 12;
    }

    startDate.setHours(0, 0, 0, 0);

    const orders = await db.order.findMany({
      where: {
        wholesalerId,
        createdAt: { gte: startDate },
        status: { in: ['DELIVERED', 'DISPATCHED', 'PENDING'] },
      },
      include: {
        items: { include: { allocations: { include: { batch: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build bucket labels and aggregate revenue + profit
    const bucketMap = new Map<string, { revenue: number; profit: number; orders: number }>();

    const getLabelForDate = (date: Date) => {
      switch (period) {
        case 'daily':
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        case 'weekly': {
          const weekNum = Math.floor(
            (date.getTime() - startDate.getTime()) / (7 * 24 * 3600 * 1000)
          );
          return `W${weekNum + 1}`;
        }
        case 'yearly':
          return String(date.getFullYear());
        default:
          return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
    };

    // Initialize all buckets with zeros
    for (let i = 0; i < buckets; i++) {
      const d = new Date(startDate);
      switch (period) {
        case 'daily': d.setDate(startDate.getDate() + i); break;
        case 'weekly': d.setDate(startDate.getDate() + i * 7); break;
        case 'yearly': d.setFullYear(startDate.getFullYear() + i); break;
        default: d.setMonth(startDate.getMonth() + i); break;
      }
      bucketMap.set(getLabelForDate(d), { revenue: 0, profit: 0, orders: 0 });
    }

    // Fill buckets with order data
    orders.forEach(order => {
      const label = getLabelForDate(new Date(order.createdAt));
      if (!bucketMap.has(label)) return;

      const bucket = bucketMap.get(label)!;
      bucket.orders += 1;

      if (order.status === 'DELIVERED') {
        bucket.revenue += order.netAmount;
        let cost = 0;
        order.items.forEach(item => {
          item.allocations.forEach(alloc => {
            cost += alloc.quantity * alloc.batch.manufacturingCost;
          });
        });
        const orderProfit = order.netAmount - cost;
        const roundedProfit = Math.round(orderProfit * 100) / 100;
        bucket.profit += (roundedProfit < 0 && order.netAmount >= cost - 0.1) ? 0 : roundedProfit;
      }
    });

    const chartData = Array.from(bucketMap.entries()).map(([label, data]) => ({
      label,
      revenue: Math.round(data.revenue),
      profit: Math.round(data.profit),
      orders: data.orders,
    }));

    // Also compute low stock summary based on threshold (default 10 boxes = 200 base units)
    const allBatches = await db.inventoryBatch.findMany({
      where: {
        product: { wholesalerId },
        availableBaseUnits: { gt: 0 },
        expiryDate: { gt: new Date() },
      },
      include: { product: true },
      orderBy: { availableBaseUnits: 'asc' },
    });

    // Group by product, sum available units
    const productStockMap = new Map<string, { name: string; units: number; sku: string }>();
    allBatches.forEach(batch => {
      const existing = productStockMap.get(batch.productId);
      if (existing) {
        existing.units += batch.availableBaseUnits;
      } else {
        productStockMap.set(batch.productId, {
          name: batch.product.name,
          sku: batch.product.sku,
          units: batch.availableBaseUnits,
        });
      }
    });

    return NextResponse.json({
      chartData,
      period,
      totalOrders: orders.length,
      allProductStocks: Array.from(productStockMap.values()),
    });

  } catch (err: any) {
    console.error('Analytics API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
