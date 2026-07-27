export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

async function getOrgTicket(id: string, orgId: string) {
  return prisma.jiraTicket.findFirst({ where: { id, organizationId: orgId } });
}

// GET /api/jira-tickets/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const ticket = await prisma.jiraTicket.findFirst({
      where: { id: params?.id, organizationId: user?.organizationId },
      include: {
        threat: { select: { id: true, threatId: true, title: true, severity: true, cvssScore: true, source: true, description: true } },
      },
    });
    if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (error: any) {
    console.error('GET jira-ticket error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// PATCH /api/jira-tickets/[id] — update status / fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const existing = await getOrgTicket(params?.id, user?.organizationId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const {
      title, description, priority, status, affectedPackage, affectedProduct,
      productOwner, remediationSteps, notes, jiraKey, cvssScore, cveId,
    } = body ?? {};

    const ticket = await prisma.jiraTicket.update({
      where: { id: params?.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(affectedPackage !== undefined ? { affectedPackage } : {}),
        ...(affectedProduct !== undefined ? { affectedProduct } : {}),
        ...(productOwner !== undefined ? { productOwner } : {}),
        ...(remediationSteps !== undefined ? { remediationSteps } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(jiraKey !== undefined ? { jiraKey } : {}),
        ...(cveId !== undefined ? { cveId } : {}),
        ...(cvssScore !== undefined ? { cvssScore: cvssScore != null && cvssScore !== '' ? parseFloat(String(cvssScore)) : null } : {}),
      },
      include: {
        threat: { select: { id: true, threatId: true, title: true, severity: true, cvssScore: true, source: true } },
      },
    });
    return NextResponse.json({ ticket });
  } catch (error: any) {
    console.error('PATCH jira-ticket error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/jira-tickets/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const existing = await getOrgTicket(params?.id, user?.organizationId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.jiraTicket.delete({ where: { id: params?.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE jira-ticket error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
