export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// POST /api/cybellum/assets/[id]/link — link an asset to a threat
// body: { threatId: string, notes?: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const body = await req.json();
    const { threatId, notes } = body ?? {};
    if (!threatId) return NextResponse.json({ error: 'Required field: threatId' }, { status: 400 });

    // verify both asset and threat belong to this org
    const asset = await prisma.cybellumAsset.findFirst({
      where: { id: params?.id, organizationId: orgId },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // Threat is global; only the asset must belong to the caller's org (checked above).
    const threat = await prisma.threat.findUnique({
      where: { id: threatId },
    });
    if (!threat) return NextResponse.json({ error: 'Threat not found' }, { status: 404 });

    try {
      const link = await prisma.threatAssetLink.create({
        data: {
          threatId,
          assetId: params?.id,
          linkedBy: user?.email || 'unknown',
          notes: notes || null,
        },
        include: { asset: true },
      });
      return NextResponse.json({ link }, { status: 201 });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return NextResponse.json({ error: 'Asset is already linked to this threat' }, { status: 409 });
      }
      throw e;
    }
  } catch (error: any) {
    console.error('POST link asset error:', error);
    return NextResponse.json({ error: 'Failed to link asset' }, { status: 500 });
  }
}

// DELETE /api/cybellum/assets/[id]/link — unlink an asset from a threat
// threatId via body or ?threatId= query param
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const url = new URL(req.url);
    let threatId = url.searchParams.get('threatId');
    if (!threatId) {
      try {
        const body = await req.json();
        threatId = body?.threatId;
      } catch {
        // no body
      }
    }
    if (!threatId) return NextResponse.json({ error: 'Required field: threatId' }, { status: 400 });

    // verify asset belongs to org
    const asset = await prisma.cybellumAsset.findFirst({
      where: { id: params?.id, organizationId: orgId },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    await prisma.threatAssetLink.deleteMany({
      where: { assetId: params?.id, threatId },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE unlink asset error:', error);
    return NextResponse.json({ error: 'Failed to unlink asset' }, { status: 500 });
  }
}
