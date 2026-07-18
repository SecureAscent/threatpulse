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

async function uniqueParentSlug(name: string) {
  const base = slugify(name, 'parent');
  let slug = base;
  let suffix = 2;
  while (await prisma.parentOrganization.findUnique({ where: { slug }, select: { id: true } })) {
    const tail = `-${suffix++}`;
    slug = `${base.slice(0, 64 - tail.length).replace(/-+$/g, '')}${tail}`;
  }
  return slug;
}

async function main() {
  const organizations = await prisma.organization.findMany({
    include: { departments: { select: { id: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });

  for (const organization of organizations) {
    let parentOrganizationId = organization.parentOrganizationId;

    if (!parentOrganizationId) {
      const parentName = `${organization.name} Parent`;
      const parent = await prisma.parentOrganization.create({
        data: { name: parentName, slug: await uniqueParentSlug(parentName) },
        select: { id: true },
      });
      parentOrganizationId = parent.id;
      await prisma.organization.update({
        where: { id: organization.id },
        data: { parentOrganizationId },
      });
      console.log(`Attached ${organization.name} to new parent ${parentName}`);
    }

    let general = organization.departments.find((department) => department.slug === 'general');
    if (!general) {
      general = await prisma.department.create({
        data: { organizationId: organization.id, name: 'General', slug: 'general' },
        select: { id: true, slug: true },
      });
      console.log(`Created General department for ${organization.name}`);
    }

    const users = await prisma.user.updateMany({
      where: { organizationId: organization.id, departmentId: null },
      data: { departmentId: general.id },
    });
    if (users.count) console.log(`Assigned ${users.count} user(s) to ${organization.name} / General`);
  }
}

main()
  .catch((error) => {
    console.error('Hierarchy migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
