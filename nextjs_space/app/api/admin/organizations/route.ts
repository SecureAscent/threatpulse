export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// Lists all organizations. SUPERADMIN only — feeds the org picker used when a
// superadmin adds a user to, or filters users by, a specific organization.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (user?.role !== 'SUPERADMIN') return NextResponse.json({ error: 'Superadmin only' }, { status: 403 });

    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ organizations });
  } catch (error: any) {
    console.error('Admin organizations error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
