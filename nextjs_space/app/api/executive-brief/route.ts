import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { buildBriefData } from '@/lib/executive-brief';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as any;
  const isSuper = user?.role === 'SUPERADMIN';
  const orgId = user?.organizationId as string | undefined;

  if (!isSuper && !orgId) {
    return NextResponse.json({ error: 'No organization associated with user' }, { status: 400 });
  }

  try {
    const data = await buildBriefData({ isSuper, orgId });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[executive-brief] failed to build brief', err);
    return NextResponse.json({ error: 'Failed to build executive brief' }, { status: 500 });
  }
}
