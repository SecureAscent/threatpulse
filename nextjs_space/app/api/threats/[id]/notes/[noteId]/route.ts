export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getTenantContext, hasPermission, isAdmin } from '@/lib/tenant-context';
import { writeAuditEvent } from '@/lib/audit';

// DELETE /api/threats/[id]/notes/[noteId] — delete a note.
// Authors may delete their own notes; ADMIN+ may delete any note.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; noteId: string } },
) {
  try {
    const ctx = await getTenantContext(req);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(ctx, 'threats.manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const note = await prisma.threatNote.findUnique({
      where: { id: params?.noteId },
      select: { id: true, authorId: true, threatId: true },
    });
    if (!note || note.threatId !== params?.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isOwner = note.authorId === ctx.userId;
    if (!isOwner && !isAdmin(ctx)) {
      return NextResponse.json(
        { error: 'You can only delete your own notes' },
        { status: 403 },
      );
    }

    await prisma.threatNote.delete({ where: { id: note.id } });

    await writeAuditEvent({
      action: 'threat.note.deleted',
      ctx,
      targetType: 'threat',
      targetId: params.id,
      metadata: { noteId: note.id, deletedByOwner: isOwner },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE threat note error:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
