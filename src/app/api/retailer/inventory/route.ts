import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

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

    const inventory = await db.retailerInventory.findMany({
      where: { retailerId: retailer.id },
      include: {
        product: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, inventory });
  } catch (error: any) {
    console.error('Error fetching retailer inventory:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const { productId, batchNumber, quantity, expiryDate } = body;

    if (!productId || !batchNumber || quantity === undefined || !expiryDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const qty = parseInt(quantity);
    const expDate = new Date(expiryDate);

    const inventoryItem = await db.retailerInventory.upsert({
      where: {
        retailerId_productId_batchNumber: {
          retailerId: retailer.id,
          productId,
          batchNumber,
        },
      },
      update: {
        quantity: {
          increment: qty,
        },
        expiryDate: expDate,
      },
      create: {
        retailerId: retailer.id,
        productId,
        batchNumber,
        quantity: qty,
        expiryDate: expDate,
      },
      include: {
        product: true,
      },
    });

    await db.systemAuditLog.create({
      data: {
        action: 'RETAIL_INVENTORY_ADD',
        userId: user.userId,
        details: `Added/updated inventory: Product ${inventoryItem.product.name}, Batch ${batchNumber}, Qty ${qty}`,
      },
    });

    return NextResponse.json({ success: true, inventoryItem });
  } catch (error: any) {
    console.error('Error adding retailer inventory:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, quantity, expiryDate } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing inventory record ID' }, { status: 400 });
    }

    const item = await db.retailerInventory.update({
      where: { id },
      data: {
        quantity: quantity !== undefined ? parseInt(quantity) : undefined,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      },
      include: {
        product: true,
      },
    });

    await db.systemAuditLog.create({
      data: {
        action: 'RETAIL_INVENTORY_UPDATE',
        userId: user.userId,
        details: `Updated retailer inventory: Product ${item.product.name}, Batch ${item.batchNumber}, Qty ${item.quantity}`,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error('Error updating retailer inventory:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'RETAILER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing inventory ID' }, { status: 400 });
    }

    const item = await db.retailerInventory.delete({
      where: { id },
      include: { product: true },
    });

    await db.systemAuditLog.create({
      data: {
        action: 'RETAIL_INVENTORY_DELETE',
        userId: user.userId,
        details: `Deleted inventory item: Product ${item.product.name}, Batch ${item.batchNumber}`,
      },
    });

    return NextResponse.json({ success: true, message: 'Retailer inventory item deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting retailer inventory:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
