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

    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');

    const bills = await db.supplierBill.findMany({
      where: {
        supplierId: supplierId || undefined,
      },
      include: {
        supplier: true,
        settlements: true,
      },
      orderBy: { billDate: 'desc' },
    });

    return NextResponse.json({ success: true, bills });
  } catch (error: any) {
    console.error('Error fetching supplier bills:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== 'WHOLESALER' && user.role !== 'WHOLESALER_STAFF')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { supplierId, billNumber, billDate, totalAmount, paidAmount, status, notes, itemsJson } = body;

    if (!supplierId || !billNumber || !billDate || totalAmount === undefined) {
      return NextResponse.json({ error: 'Missing required bill fields' }, { status: 400 });
    }

    const bill = await db.$transaction(async (tx) => {
      const parsedTotal = parseFloat(totalAmount);
      const parsedPaid = parseFloat(paidAmount || 0);
      const derivedStatus = status || (parsedPaid >= parsedTotal ? 'PAID' : parsedPaid > 0 ? 'PARTIAL' : 'PENDING');

      const createdBill = await tx.supplierBill.create({
        data: {
          supplierId,
          billNumber,
          billDate: new Date(billDate),
          totalAmount: parsedTotal,
          paidAmount: parsedPaid,
          status: derivedStatus,
          notes: notes || null,
          itemsJson: itemsJson ? JSON.stringify(itemsJson) : '[]',
        },
      });

      // If there is an initial paid amount, record a settlement log
      if (parseFloat(paidAmount || 0) > 0) {
        await tx.supplierSettlement.create({
          data: {
            billId: createdBill.id,
            amount: parseFloat(paidAmount),
            date: new Date(billDate),
            paymentMethod: 'CASH',
            notes: 'Initial payment recorded on bill registration',
          },
        });
      }

      return createdBill;
    });

    return NextResponse.json({ success: true, bill });
  } catch (error: any) {
    console.error('Error creating supplier bill:', error);
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
    const { id, billNumber, billDate, totalAmount, paidAmount, status, notes, itemsJson, settlementAmount, paymentMethod, settlementNotes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing bill ID' }, { status: 400 });
    }

    const existingBill = await db.supplierBill.findUnique({
      where: { id },
    });

    if (!existingBill) {
      return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });
    }

    const updatedBill = await db.$transaction(async (tx) => {
      // 1. If recording a settlement payment
      if (settlementAmount && parseFloat(settlementAmount) > 0) {
        const amt = parseFloat(settlementAmount);
        const newPaidAmount = existingBill.paidAmount + amt;
        const newStatus = newPaidAmount >= (totalAmount !== undefined ? parseFloat(totalAmount) : existingBill.totalAmount) ? 'PAID' : 'PARTIAL';

        // Record settlement
        await tx.supplierSettlement.create({
          data: {
            billId: id,
            amount: amt,
            paymentMethod: paymentMethod || 'CASH',
            notes: settlementNotes || 'Partial settlement',
            date: new Date(),
          },
        });

        // Update bill paidAmount and status
        return await tx.supplierBill.update({
          where: { id },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
          },
          include: {
            supplier: true,
            settlements: true,
          },
        });
      }

      // 2. Otherwise update general bill info
      const finalPaid = paidAmount !== undefined ? parseFloat(paidAmount) : existingBill.paidAmount;
      const finalTotal = totalAmount !== undefined ? parseFloat(totalAmount) : existingBill.totalAmount;
      const finalStatus = status ? status : (finalPaid >= finalTotal ? 'PAID' : (finalPaid > 0 ? 'PARTIAL' : 'PENDING'));

      return await tx.supplierBill.update({
        where: { id },
        data: {
          billNumber: billNumber !== undefined ? billNumber : undefined,
          billDate: billDate ? new Date(billDate) : undefined,
          totalAmount: totalAmount !== undefined ? parseFloat(totalAmount) : undefined,
          paidAmount: finalPaid,
          status: finalStatus,
          notes: notes !== undefined ? notes : undefined,
          itemsJson: itemsJson ? JSON.stringify(itemsJson) : undefined,
        },
        include: {
          supplier: true,
          settlements: true,
        },
      });
    });

    return NextResponse.json({ success: true, bill: updatedBill });
  } catch (error: any) {
    console.error('Error updating supplier bill:', error);
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
      return NextResponse.json({ error: 'Missing bill ID' }, { status: 400 });
    }

    const existingBill = await db.supplierBill.findUnique({
      where: { id },
    });

    if (!existingBill) {
      return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });
    }

    await db.supplierBill.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Supplier bill deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting supplier bill:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
