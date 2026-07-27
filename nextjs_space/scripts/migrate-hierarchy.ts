import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(name: string, fallback: string) {
  const value = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');

  return value || fallback;
}

async function main() {
  const rootName = process.env.DEFAULT_PARENT_ORG_NAME?.trim() || 'ThreatPulse Root';
  const rootSlug = process.env.DEFAULT_PARENT_ORG_SLUG?.trim() || slugify(rootName, 'threatpulse-root');

  const root = await prisma.parentOrganization.upsert({
    where: { slug: rootSlug },
    update: { name: rootName },
    create: { name: rootName, slug: rootSlug },
    select: { id: true, name: true },
  });

  const organizations = await prisma.organization.findMany({
    include: { departments: { select: { id: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });

  for (const organization of organizations) {
    if (!organization.parentOrganizationId) {
      await prisma.organization.update({
        where: { id: organization.id },
        data: { parentOrganizationId: root.id },
      });
      console.log(`Attached ${organization.name} to parent ${root.name}`);
    }

    let general = organization.departments.find((department) => department.slug === 'general');

    if (!general) {
      general = await prisma.department.create({
        data: {
          organizationId: organization.id,
          name: 'General',
          slug: 'general',
        },
        select: { id: true, slug: true },
      });
      console.log(`Created General department for ${organization.name}`);
    }

    const users = await prisma.user.updateMany({
      where: {
        organizationId: organization.id,
        departmentId: null,
      },
      data: { departmentId: general.id },
    });

    const threats = await prisma.threat.updateMany({
      where: {
        organizationId: organization.id,
        departmentId: null,
      },
      data: { departmentId: general.id },
    });

    if (users.count > 0) {
      console.log(`Assigned ${users.count} user(s) to ${organization.name} / General`);
    }

    if (threats.count > 0) {
      console.log(`Assigned ${threats.count} threat(s) to ${organization.name} / General`);
    }
  }

  const orphanUsers = await prisma.user.count({ where: { organizationId: null } });
  if (orphanUsers > 0) {
    throw new Error(
      `${orphanUsers} user(s) have no organization. Assign them before enabling tenant isolation.`,
    );
  }

  console.log('Hierarchy migration completed successfully');
}

main()
  .catch((error) => {
    console.error('Hierarchy migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
