import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { sendInvoiceEmail } from '@/lib/mailer';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { emailOverride } = await request.json().catch(() => ({ emailOverride: null }));

    const order = await db.order.findUnique({
      where: { id },
      include: {
        wholesaler: true,
        retailer: {
          include: {
            user: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isWholesaler = user.role === 'WHOLESALER' || user.role === 'WHOLESALER_STAFF';
    if (!isWholesaler) {
      return NextResponse.json({ error: 'Unauthorized role' }, { status: 401 });
    }

    // Determine destination email
    let destinationEmail = emailOverride || order.retailer?.user?.email;

    if (!destinationEmail) {
      return NextResponse.json({ 
        error: 'No email address found for this retailer. Please specify an email address.' 
      }, { status: 400 });
    }

    // Send invoice email
    await sendInvoiceEmail(destinationEmail, order);

    return NextResponse.json({ 
      success: true, 
      message: `Digital tax invoice sent to ${destinationEmail} successfully.` 
    });
  } catch (error: any) {
    console.error('Error sending digital invoice email:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
