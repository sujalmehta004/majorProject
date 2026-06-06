import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, details } = body;

    if (!action || !details) {
      return NextResponse.json({ error: 'Action and details are required' }, { status: 400 });
    }

    const auditLog = await db.systemAuditLog.create({
      data: {
        action,
        userId: user.userId,
        details: `${user.email} (${user.role}): ${details}`,
      },
    });

    return NextResponse.json({ success: true, auditLog });
  } catch (error: any) {
    console.error('Error logging audit activity:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
