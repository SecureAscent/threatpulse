export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

async function getOrgAsset(id: string, orgId: string) {
  return prisma.cybellumAsset.findFirst({ where: { id, organizationId: orgId } });
}

// GET /api/cybellum/assets/[id] — asset with its linked threats
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const asset = await prisma.cybellumAsset.findFirst({
      where: { id: params?.id, organizationId: user?.organizationId },
      include: {
        threatLinks: {
          include: {
            threat: { select: { id: true, threatId: true, title: true, severity: true, cvssScore: true, source: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ asset });
  } catch (error: any) {
    console.error('GET cybellum asset error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// PATCH /api/cybellum/assets/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const existing = await getOrgAsset(params?.id, user?.organizationId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const {
      productName, productVersion, packageName, packageVersion,
      productOwner, ownerEmail, department, riskScore,
    } = body ?? {};

    const asset = await prisma.cybellumAsset.update({
      where: { id: params?.id },
      data: {
        ...(productName !== undefined ? { productName } : {}),
        ...(productVersion !== undefined ? { productVersion } : {}),
        ...(packageName !== undefined ? { packageName } : {}),
        ...(packageVersion !== undefined ? { packageVersion } : {}),
        ...(productOwner !== undefined ? { productOwner } : {}),
        ...(ownerEmail !== undefined ? { ownerEmail } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(riskScore !== undefined ? { riskScore: riskScore != null && riskScore !== '' ? parseFloat(String(riskScore)) : null } : {}),
      },
      include: { _count: { select: { threatLinks: true } } },
    });
    return NextResponse.json({ asset });
  } catch (error: any) {
    console.error('PATCH cybellum asset error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/cybellum/assets/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const existing = await getOrgAsset(params?.id, user?.organizationId);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.cybellumAsset.delete({ where: { id: params?.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE cybellum asset error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
