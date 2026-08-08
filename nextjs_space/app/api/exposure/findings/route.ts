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

    const findings = await prisma.exposureFinding.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ findings });
  } catch (error: any) {
    console.error('GET exposure findings error:', error);
    return NextResponse.json({ error: 'Failed to fetch findings' }, { status: 500 });
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
    const { title, kind, severity, summary, affectedIdentity, credentialSample, credentialHash, sourceUrl, sourceId, confidence, reliability } = body ?? {};
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const finding = await prisma.exposureFinding.create({
      data: {
        organizationId: orgId,
        title,
        kind: kind || 'credential_leak',
        severity: (severity || 'MEDIUM').toUpperCase(),
        summary: summary || null,
        affectedIdentity: affectedIdentity || null,
        credentialSample: credentialSample || null,
        credentialHash: credentialHash || null,
        sourceUrl: sourceUrl || null,
        sourceId: sourceId || null,
        confidence: confidence || 'medium',
        reliability: reliability || 'C',
        status: 'new',
      },
    });
    return NextResponse.json({ finding });
  } catch (error: any) {
    console.error('POST exposure finding error:', error);
    return NextResponse.json({ error: 'Failed to create finding' }, { status: 500 });
  }
}
