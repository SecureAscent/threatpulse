export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/cybellum/assets — list assets with optional filters
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const isSuper = user?.role === 'SUPERADMIN';

    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const owner = url.searchParams.get('owner');
    const riskLevel = url.searchParams.get('riskLevel'); // high | medium | low
    const filterOrg = url.searchParams.get('organizationId');

    // SUPERADMIN sees assets across ALL organizations, optionally filtered by
    // ?organizationId=. Everyone else is scoped to their own organization.
    const where: any = {};
    if (isSuper) {
      if (filterOrg) where.organizationId = filterOrg;
    } else {
      const orgId = user?.organizationId;
      if (!orgId) return NextResponse.json({ assets: [] });
      where.organizationId = orgId;
    }
    if (owner) where.productOwner = { contains: owner, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { packageName: { contains: search, mode: 'insensitive' } },
        { productOwner: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (riskLevel === 'high') where.riskScore = { gte: 7 };
    else if (riskLevel === 'medium') where.riskScore = { gte: 4, lt: 7 };
    else if (riskLevel === 'low') where.riskScore = { lt: 4 };

    const assets = await prisma.cybellumAsset.findMany({
      where,
      orderBy: [{ riskScore: 'desc' }, { productName: 'asc' }],
      include: {
        _count: { select: { threatLinks: true } },
        organization: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({ assets });
  } catch (error: any) {
    console.error('GET cybellum assets error:', error);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }
}

// POST /api/cybellum/assets — create a manual asset
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const body = await req.json();
    const {
      productName, productVersion, packageName, packageVersion,
      productOwner, ownerEmail, department, riskScore,
    } = body ?? {};

    if (!productName) {
      return NextResponse.json({ error: 'Required field: productName' }, { status: 400 });
    }

    const asset = await prisma.cybellumAsset.create({
      data: {
        organizationId: orgId,
        cybellumId: null, // manual entry
        productName,
        productVersion: productVersion || null,
        packageName: packageName || null,
        packageVersion: packageVersion || null,
        productOwner: productOwner || null,
        ownerEmail: ownerEmail || null,
        department: department || null,
        riskScore: riskScore != null && riskScore !== '' ? parseFloat(String(riskScore)) : null,
        lastSyncedAt: null,
      },
      include: { _count: { select: { threatLinks: true } } },
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error: any) {
    console.error('POST cybellum asset error:', error);
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 });
  }
}
