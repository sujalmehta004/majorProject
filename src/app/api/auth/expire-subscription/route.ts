import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Update user state to inactive in an atomic operation
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      await tx.systemAuditLog.create({
        data: {
          action: 'SUBSCRIPTION_EXPIRED',
          userId: userId,
          details: `User subscription expired. System automatically flipped isActive to false.`,
        },
      });
    });

    return NextResponse.json({ success: true, message: 'Subscription expired. User deactivated.' });
  } catch (error: any) {
    console.error('Error in expire-subscription endpoint:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
