export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext, hasPermission, hasRole } from '@/lib/tenant-context';
import { writeAuditEvent } from '@/lib/audit';

const analystSelect = { id: true, name: true, email: true, role: true };

// GET /api/threats/[id]/notes — list notes for a threat (threats.read)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const threat = await prisma.threat.findUnique({ where: { id: params?.id }, select: { id: true } });
    if (!threat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const notes = await prisma.threatNote.findMany({
      where: { threatId: params.id },
      include: { author: { select: analystSelect } },
      orderBy: { createdAt: 'desc' },
    });

    // VIEWERs never see internal analyst notes.
    const visible = ctx.role === 'VIEWER' ? notes.filter((n) => !n.isInternal) : notes;
    return NextResponse.json({ notes: visible });
  } catch (error: any) {
    console.error('GET threat notes error:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

// POST /api/threats/[id]/notes — add a note (threats.manage or ANALYST+)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!ctx.userId) {
      return NextResponse.json({ error: 'A user session is required to author notes' }, { status: 403 });
    }

    const threat = await prisma.threat.findUnique({ where: { id: params?.id }, select: { id: true } });
    if (!threat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const content = (body?.content ?? '').toString().trim();
    const isInternal = Boolean(body?.isInternal);
    if (!content) return NextResponse.json({ error: 'Note content is required' }, { status: 400 });

    const note = await prisma.threatNote.create({
      data: { threatId: params.id, authorId: ctx.userId, content, isInternal },
      include: { author: { select: analystSelect } },
    });

    await writeAuditEvent({
      action: 'threat.note.created',
      ctx,
      targetType: 'Threat',
      targetId: params.id,
      metadata: { noteId: note.id, isInternal },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error: any) {
    console.error('POST threat note error:', error);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}
