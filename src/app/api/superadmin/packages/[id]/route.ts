import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, price, description, features, isActive } = await request.json();

    const pkg = await db.subscriptionPackage.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: parseFloat(price) || 0 }),
        ...(description !== undefined && { description }),
        ...(features !== undefined && { features: Array.isArray(features) ? features.join(',') : features }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, package: pkg });
  } catch (error: any) {
    console.error('Update package error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update package' }, { status: 500 });
  }
}
