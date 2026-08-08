export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const watchlists = await prisma.tenantWatchlist.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ watchlists });
  } catch (error: any) {
    console.error('GET watchlists error:', error);
    return NextResponse.json({ error: 'Failed to fetch watchlists' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const body = await req.json();
    const { name, kind, terms, notes } = body ?? {};
    if (!name?.trim() || !terms?.trim()) return NextResponse.json({ error: 'Name and terms are required' }, { status: 400 });

    const wl = await prisma.tenantWatchlist.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        kind: kind || 'domain',
        terms: terms.trim(),
        notes: notes?.trim() || null,
        enabled: true,
        ownerName: user?.name || user?.email || null,
      },
    });
    return NextResponse.json({ watchlist: wl });
  } catch (error: any) {
    console.error('POST watchlist error:', error);
    return NextResponse.json({ error: 'Failed to create watchlist' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await prisma.tenantWatchlist.deleteMany({ where: { id, organizationId: orgId } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE watchlist error:', error);
    return NextResponse.json({ error: 'Failed to delete watchlist' }, { status: 500 });
  }
}
