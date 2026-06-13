import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
      wholesalerId = wholesaler?.id || '';
    } else {
      const dbUser = await db.user.findUnique({
        where: { id: user.userId },
      });
      wholesalerId = dbUser?.wholesalerId || '';
    }

    const suppliers = await db.supplier.findMany({
      where: { wholesalerId },
      include: {
        batches: {
          include: {
            product: true
          }
        },
        bills: {
          include: {
            settlements: true
          }
        }
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, suppliers });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
      wholesalerId = wholesaler?.id || '';
    } else {
      const dbUser = await db.user.findUnique({
        where: { id: user.userId },
      });
      wholesalerId = dbUser?.wholesalerId || '';
    }

    const body = await request.json();
    const { name, contactPerson, phone, email, address } = body;

    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const supplier = await db.supplier.create({
      data: {
        wholesalerId,
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
      },
    });

    // Record audit log
    await db.systemAuditLog.create({
      data: {
        action: 'CREATE_SUPPLIER',
        userId: user.userId,
        details: `Registered Supplier: ${name}`,
      },
    });

    return NextResponse.json({ success: true, supplier });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, contactPerson, phone, email, address } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing supplier ID' }, { status: 400 });
    }

    const updatedSupplier = await db.supplier.update({
      where: { id },
      data: {
        name,
        contactPerson,
        phone,
        email,
        address,
      },
    });

    return NextResponse.json({ success: true, supplier: updatedSupplier });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing supplier ID' }, { status: 400 });
    }

    const existingSupplier = await db.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    await db.supplier.delete({
      where: { id },
    });

    // Record audit log
    await db.systemAuditLog.create({
      data: {
        action: 'DELETE_SUPPLIER',
        userId: user.userId,
        details: `Deleted supplier: ${existingSupplier.name}`,
      },
    });

    return NextResponse.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    if (error.code === 'P2003') {
      return NextResponse.json({ error: 'Cannot delete supplier because it is associated with existing batches or bills.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
