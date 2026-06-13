import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let wholesalerId = '';
    if (user.role === 'WHOLESALER') {
      const wholesaler = await db.wholesalerProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!wholesaler) {
        return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
      }
      wholesalerId = wholesaler.id;
    } else {
      const dbUser = await db.user.findUnique({
        where: { id: user.userId },
      });
      if (!dbUser || !dbUser.wholesalerId) {
        return NextResponse.json({ error: 'Wholesaler association not found' }, { status: 404 });
      }
      wholesalerId = dbUser.wholesalerId;
    }

    const products = await db.product.findMany({
      where: { wholesalerId },
      include: {
        batches: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let wholesalerId = '';
    if (user.role === 'WHOLESALER') {
      const wholesaler = await db.wholesalerProfile.findUnique({
        where: { userId: user.userId },
      });
      if (!wholesaler) {
        return NextResponse.json({ error: 'Wholesaler profile not found' }, { status: 404 });
      }
      wholesalerId = wholesaler.id;
    } else {
      const dbUser = await db.user.findUnique({
        where: { id: user.userId },
      });
      if (!dbUser || !dbUser.wholesalerId) {
        return NextResponse.json({ error: 'Wholesaler association not found' }, { status: 404 });
      }
      wholesalerId = dbUser.wholesalerId;
    }

    const body = await request.json();
    const { name, sku, tabletsPerStrip, stripsPerBox, tierPricing, category } = body;

    if (!name || !sku) {
      return NextResponse.json({ error: 'Product name and SKU are required' }, { status: 400 });
    }

    // Default packaging constants if missing
    const tPerStrip = tabletsPerStrip ? parseInt(tabletsPerStrip) : 10;
    const sPerBox = stripsPerBox ? parseInt(stripsPerBox) : 10;

    // Check SKU uniqueness
    const existingSku = await db.product.findUnique({
      where: { sku },
    });
    if (existingSku) {
      return NextResponse.json({ error: 'Product SKU already exists' }, { status: 400 });
    }

    // Tier pricing validation and stringify
    // tierPricing structure: [{ minQty: number, maxQty: number, pricePerBox: number }]
    const pricingJson = tierPricing ? JSON.stringify(tierPricing) : '[]';

    const product = await db.product.create({
      data: {
        wholesalerId,
        name,
        sku,
        tabletsPerStrip: tPerStrip,
        stripsPerBox: sPerBox,
        tierPricingJson: pricingJson,
        category: category || 'Uncategorized',
      },
    });

    // Log the product creation
    await db.systemAuditLog.create({
      data: {
        action: 'CREATE_PRODUCT',
        userId: user.userId,
        details: `Created product catalog node: ${name} (SKU: ${sku})`,
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, sku, tabletsPerStrip, stripsPerBox, tierPricing, category } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
    }

    const pricingJson = tierPricing ? JSON.stringify(tierPricing) : undefined;

    const product = await db.product.update({
      where: { id },
      data: {
        name,
        sku,
        tabletsPerStrip: tabletsPerStrip !== undefined ? parseInt(tabletsPerStrip, 10) : undefined,
        stripsPerBox: stripsPerBox !== undefined ? parseInt(stripsPerBox, 10) : undefined,
        tierPricingJson: pricingJson,
        category: category !== undefined ? category : undefined,
      },
    });

    // Log the product update
    await db.systemAuditLog.create({
      data: {
        action: 'UPDATE_PRODUCT',
        userId: user.userId,
        details: `Updated product catalog node: ${name || product.name} (SKU: ${sku || product.sku})`,
      },
    });

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });
    }

    // Check if product exists
    const existingProduct = await db.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    await db.product.delete({
      where: { id },
    });

    // Log the product deletion
    await db.systemAuditLog.create({
      data: {
        action: 'DELETE_PRODUCT',
        userId: user.userId,
        details: `Deleted product: ${existingProduct.name} (SKU: ${existingProduct.sku})`,
      },
    });

    return NextResponse.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    if (error.code === 'P2003') {
      return NextResponse.json({ error: 'Cannot delete medicine because it is associated with existing orders or customer records.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
