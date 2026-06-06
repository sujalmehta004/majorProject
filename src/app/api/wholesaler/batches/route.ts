import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

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
    const { productId, batchNumber, expiryDate, totalBaseUnits, manufacturingCost, invoiceData, purchasePricePerBox, sellingPricePerBox, supplierName, manufacturerName } = body;

    if (!productId || !batchNumber || !expiryDate || !totalBaseUnits || !manufacturingCost) {
      return NextResponse.json({ error: 'Missing required batch ingestion fields' }, { status: 400 });
    }

    // Verify product ownership
    const product = await db.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.wholesalerId !== wholesalerId) {
      return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
    }

    // Check unique batch key
    const existingBatch = await db.inventoryBatch.findUnique({
      where: {
        productId_batchNumber: {
          productId,
          batchNumber,
        },
      },
    });

    if (existingBatch) {
      return NextResponse.json({ error: 'Batch number already exists for this product' }, { status: 400 });
    }

    // Create batch
    const batch = await db.inventoryBatch.create({
      data: {
        productId,
        batchNumber,
        expiryDate: new Date(expiryDate),
        totalBaseUnits: parseInt(totalBaseUnits),
        availableBaseUnits: parseInt(totalBaseUnits),
        manufacturingCost: parseFloat(manufacturingCost),
        invoiceData: invoiceData || '',
        barcodeUrl: `/api/wholesaler/barcode?productId=${productId}&batchNumber=${batchNumber}`,
        purchasePricePerBox: purchasePricePerBox ? parseFloat(purchasePricePerBox) : 0,
        sellingPricePerBox: sellingPricePerBox ? parseFloat(sellingPricePerBox) : 100,
        supplierName: supplierName || null,
        manufacturerName: manufacturerName || null,
        purchaseDate: new Date(),
      },
    });

    // Record audit log
    await db.systemAuditLog.create({
      data: {
        action: 'BATCH_INGEST',
        userId: user.userId,
        details: `Ingested Batch ${batchNumber} for Product ${product.name} (QTY: ${totalBaseUnits} base units)`,
      },
    });

    return NextResponse.json({ success: true, batch });
  } catch (error: any) {
    console.error('Error ingesting batch:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

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

    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');

    const batches = await db.inventoryBatch.findMany({
      where: {
        productId: productId || undefined,
        product: { wholesalerId },
      },
      include: {
        product: true,
      },
      orderBy: { expiryDate: 'asc' },
    });

    return NextResponse.json({ success: true, batches });
  } catch (error: any) {
    console.error('Error fetching batches:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
