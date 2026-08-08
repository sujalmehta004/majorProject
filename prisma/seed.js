const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding MedHub database...\n');

  // ── 1. Superadmin account ──────────────────────────────────────────────────
  const superadminEmail = 'admin@medhub.com';
  const superadminPassword = 'Admin@1234';

  const existingAdmin = await db.user.findUnique({ where: { email: superadminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(superadminPassword, 12);
    await db.user.create({
      data: {
        email: superadminEmail,
        passwordHash,
        fullName: 'MedHub Superadmin',
        role: 'SUPERADMIN',
        isActive: true,
        isVerified: true,
        verificationStatus: 'VERIFIED',
        packageName: 'Enterprise Tier',
        packagePrice: 0,
        subscriptionStart: new Date(),
        subscriptionEnd: new Date('2099-12-31'),
        allowedFeatures: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs',
      },
    });
    console.log('✅ Superadmin created');
    console.log('   Email:    ' + superadminEmail);
    console.log('   Password: ' + superadminPassword + '\n');
  } else {
    console.log('⏭️  Superadmin already exists (' + superadminEmail + '), skipping.\n');
  }

  // ── 2. Default subscription packages ──────────────────────────────────────
  const plans = [
    {
      name: 'Free Plan',
      price: 0,
      description: 'Basic Operational License - 365 Days Access',
      features: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs',
      isActive: true,
    },
    {
      name: 'Pro Package',
      price: 10000,
      description: 'Priority Support & Custom Invoicing Node',
      features: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs',
      isActive: false,
    },
    {
      name: 'Enterprise Tier',
      price: 25000,
      description: 'Multi-Location Enterprise Chain Management',
      features: 'Dashboard,Medicines,Orders,Billing,POS,Profile,Logs',
      isActive: false,
    },
  ];

  for (const plan of plans) {
    const existing = await db.subscriptionPackage.findUnique({ where: { name: plan.name } });
    if (!existing) {
      await db.subscriptionPackage.create({ data: plan });
      console.log('✅ Package created: ' + plan.name + ' (Rs. ' + plan.price + ')');
    } else {
      console.log('⏭️  Package already exists: ' + plan.name + ', skipping.');
    }
  }

  console.log('\n🎉 Seeding complete!');
  console.log('─────────────────────────────────────────');
  console.log('Login to Superadmin dashboard:');
  console.log('  URL:      http://localhost:3000/login');
  console.log('  Email:    ' + superadminEmail);
  console.log('  Password: ' + superadminPassword);
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
