import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

type AdminSessionUser = {
  id: string;
  role: string;
  organizationId: string | null;
};

async function getAdminUser(): Promise<AdminSessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as AdminSessionUser | undefined;
  if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role)) return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'SUPERADMIN' && !admin.organizationId) {
      return NextResponse.json({ events: [], page: 1, pageSize: 25, total: 0 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 25)));
    const action = searchParams.get('action')?.trim() || '';
    const entityType = searchParams.get('entityType')?.trim() || '';
    const actorUserId = searchParams.get('actorUserId')?.trim() || '';
    const requestedOrganizationId = searchParams.get('organizationId')?.trim() || '';

    const organizationId = admin.role === 'SUPERADMIN'
      ? (requestedOrganizationId || undefined)
      : admin.organizationId || undefined;

    const where = {
      ...(organizationId ? { organizationId } : {}),
      ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
      ...(entityType ? { entityType: { contains: entityType, mode: 'insensitive' as const } } : {}),
      ...(actorUserId ? { actorUserId } : {}),
    };

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    const actorIds = [...new Set(events.map((event) => event.actorUserId))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));

    return NextResponse.json({
      events: events.map((event) => ({
        ...event,
        actor: actorMap.get(event.actorUserId) ?? null,
      })),
      page,
      pageSize,
      total,
    });
  } catch (error) {
    console.error('[ADMIN_AUDIT_GET_ERROR]', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
