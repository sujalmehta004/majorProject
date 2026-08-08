import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const packages = await db.subscriptionPackage.findMany({
      orderBy: { price: 'asc' },
    });

    // Seed default packages if empty
    if (packages.length === 0) {
      const freePkg = await db.subscriptionPackage.create({
        data: {
          name: 'Free Plan',
          price: 0,
          description: 'Basic Operational License - 365 Days Access',
          features: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs',
          isActive: true,
        },
      });

      const proPkg = await db.subscriptionPackage.create({
        data: {
          name: 'Pro Package',
          price: 10000,
          description: 'Priority Support & Custom Invoicing Node',
          features: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs',
          isActive: false,
        },
      });

      const enterprisePkg = await db.subscriptionPackage.create({
        data: {
          name: 'Enterprise Tier',
          price: 25000,
          description: 'Multi-Location Enterprise Chain Management',
          features: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs',
          isActive: false,
        },
      });

      return NextResponse.json({ packages: [freePkg, proPkg, enterprisePkg] });
    }

    return NextResponse.json({ packages });
  } catch (error: any) {
    console.error('Fetch packages error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch packages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, price, description, features, isActive } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Package name is required.' }, { status: 400 });
    }

    const pkg = await db.subscriptionPackage.create({
      data: {
        name,
        price: parseFloat(price) || 0,
        description: description || '',
        features: Array.isArray(features) ? features.join(',') : (features || 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs'),
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });

    return NextResponse.json({ success: true, package: pkg });
  } catch (error: any) {
    console.error('Create package error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create package' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Package ID is required.' }, { status: 400 });

    await db.subscriptionPackage.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete package error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete package' }, { status: 500 });
  }
}
