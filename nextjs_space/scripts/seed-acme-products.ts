import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const acmeProducts = [
  {
    productName: 'Acme Web Portal',
    productVersion: '3.2.1',
    packageName: 'acme-portal',
    packageVersion: '3.2.1',
    productOwner: 'Sarah Chen',
    ownerEmail: 'sarah.chen@acme.com',
    department: 'Engineering',
    riskScore: 8.5,
  },
  {
    productName: 'Acme Mobile App',
    productVersion: '2.8.0',
    packageName: 'acme-mobile-ios',
    packageVersion: '2.8.0',
    productOwner: 'Michael Torres',
    ownerEmail: 'michael.torres@acme.com',
    department: 'Mobile',
    riskScore: 6.2,
  },
  {
    productName: 'Acme API Gateway',
    productVersion: '5.1.3',
    packageName: 'acme-api-gateway',
    packageVersion: '5.1.3',
    productOwner: 'Jennifer Wu',
    ownerEmail: 'jennifer.wu@acme.com',
    department: 'Platform',
    riskScore: 7.8,
  },
  {
    productName: 'Acme Analytics Engine',
    productVersion: '1.4.2',
    packageName: 'acme-analytics',
    packageVersion: '1.4.2',
    productOwner: 'David Park',
    ownerEmail: 'david.park@acme.com',
    department: 'Data Science',
    riskScore: 3.5,
  },
  {
    productName: 'Acme Payment Processor',
    productVersion: '4.0.1',
    packageName: 'acme-payments',
    packageVersion: '4.0.1',
    productOwner: 'Lisa Anderson',
    ownerEmail: 'lisa.anderson@acme.com',
    department: 'Finance',
    riskScore: 9.2,
  },
  {
    productName: 'Acme CRM System',
    productVersion: '2.3.0',
    packageName: 'acme-crm',
    packageVersion: '2.3.0',
    productOwner: 'Robert Kim',
    ownerEmail: 'robert.kim@acme.com',
    department: 'Sales',
    riskScore: 4.1,
  },
  {
    productName: 'Acme Reporting Dashboard',
    productVersion: '1.9.5',
    packageName: 'acme-dashboard',
    packageVersion: '1.9.5',
    productOwner: 'Emily Rodriguez',
    ownerEmail: 'emily.rodriguez@acme.com',
    department: 'Analytics',
    riskScore: 2.8,
  },
  {
    productName: 'Acme Authentication Service',
    productVersion: '3.5.2',
    packageName: 'acme-auth',
    packageVersion: '3.5.2',
    productOwner: 'James Wilson',
    ownerEmail: 'james.wilson@acme.com',
    department: 'Security',
    riskScore: 5.9,
  },
];

async function main() {
  console.log('🔧 Seeding Acme products...');

  // Find the first organization or create one
  let org = await prisma.organization.findFirst();
  if (!org) {
    console.log('No organization found, creating Acme Corp...');
    org = await prisma.organization.create({
      data: {
        name: 'Acme Corporation',
        slug: 'acme-corp',
      },
    });
  }
  console.log(`Using organization: ${org.name} (${org.id})`);

  // Clear existing Acme products if any
  const deleted = await prisma.cybellumAsset.deleteMany({
    where: {
      organizationId: org.id,
      productName: { startsWith: 'Acme' },
    },
  });
  if (deleted.count > 0) {
    console.log(`Removed ${deleted.count} existing Acme products`);
  }

  // Create the new Acme products
  let created = 0;
  for (const product of acmeProducts) {
    await prisma.cybellumAsset.create({
      data: {
        ...product,
        organizationId: org.id,
      },
    });
    created++;
  }

  console.log(`✅ Created ${created} Acme products for ${org.name}`);
  console.log('\nAcme Products Summary:');
  acmeProducts.forEach((p, i) => {
    const risk = p.riskScore >= 8 ? '🔴' : p.riskScore >= 6 ? '🟠' : p.riskScore >= 4 ? '🟡' : '🟢';
    console.log(`  ${risk} ${p.productName} v${p.productVersion} - Risk: ${p.riskScore} - Owner: ${p.productOwner}`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error seeding Acme products:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
