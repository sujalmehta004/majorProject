import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'RETAILER' && user.role !== 'RETAILER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let retailerId = '';
    if (user.role === 'RETAILER') {
      const retailer = await db.retailerProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!retailer) {
        return NextResponse.json({ error: 'Retailer profile not found' }, { status: 404 });
      }
      retailerId = retailer.id;
    } else {
      const dbUser = await db.user.findUnique({ where: { id: user.userId } });
      if (!dbUser || !dbUser.retailerId) {
        return NextResponse.json({ error: 'Retailer association not found' }, { status: 404 });
      }
      retailerId = dbUser.retailerId;
    }

    // Get distinct products that are in this retailer's inventory
    // (products may belong to wholesaler, not retailer, so we query via RetailerInventory)
    const inventoryItems = await db.retailerInventory.findMany({
      where: { retailerId },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });

    // Deduplicate by product id
    const productMap = new Map<string, any>();
    for (const item of inventoryItems) {
      if (item.product && !productMap.has(item.product.id)) {
        productMap.set(item.product.id, item.product);
      }
    }

    // Also include any retailer-owned products (manually created, not yet in inventory)
    const ownProducts = await db.product.findMany({
      where: { retailerId },
      orderBy: { name: 'asc' },
    });
    for (const p of ownProducts) {
      if (!productMap.has(p.id)) productMap.set(p.id, p);
    }

    const products = Array.from(productMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error('Error fetching retailer products:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
