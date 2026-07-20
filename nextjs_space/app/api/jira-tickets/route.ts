export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

// GET /api/jira-tickets — list tickets with optional filters
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    if (!orgId) return NextResponse.json({ tickets: [] });

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const cveId = url.searchParams.get('cveId');
    const threatId = url.searchParams.get('threatId');
    const productOwner = url.searchParams.get('productOwner');
    const search = url.searchParams.get('search');

    const where: any = { organizationId: orgId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (cveId) where.cveId = { contains: cveId, mode: 'insensitive' };
    if (threatId) where.threatId = threatId;
    if (productOwner) where.productOwner = { contains: productOwner, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { cveId: { contains: search, mode: 'insensitive' } },
        { jiraKey: { contains: search, mode: 'insensitive' } },
        { affectedProduct: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tickets = await prisma.jiraTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        threat: {
          select: { id: true, threatId: true, title: true, severity: true, cvssScore: true, source: true },
        },
      },
    });
    return NextResponse.json({ tickets });
  } catch (error: any) {
    console.error('GET jira-tickets error:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

// POST /api/jira-tickets — create a draft ticket
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const body = await req.json();
    const {
      threatId, title, description, priority, affectedPackage, affectedProduct,
      productOwner, cvssScore, cveId, remediationSteps, notes, jiraKey, status,
    } = body ?? {};

    if (!threatId || !title || !priority) {
      return NextResponse.json({ error: 'Required fields: threatId, title, priority' }, { status: 400 });
    }

    // Ensure the threat belongs to the caller's organization.
    const threat = await prisma.threat.findFirst({
      where: { id: threatId, organizationId: orgId },
      select: { id: true },
    });
    if (!threat) return NextResponse.json({ error: 'Threat not found in your organization' }, { status: 404 });

    const ticket = await prisma.jiraTicket.create({
      data: {
        threatId,
        organizationId: orgId,
        title,
        description: description || '',
        priority,
        status: status || 'DRAFT',
        affectedPackage: affectedPackage || null,
        affectedProduct: affectedProduct || null,
        productOwner: productOwner || null,
        cvssScore: cvssScore != null && cvssScore !== '' ? parseFloat(String(cvssScore)) : null,
        cveId: cveId || null,
        remediationSteps: remediationSteps || null,
        notes: notes || null,
        jiraKey: jiraKey || null,
        createdBy: user?.email || 'unknown',
      },
      include: {
        threat: {
          select: { id: true, threatId: true, title: true, severity: true, cvssScore: true, source: true },
        },
      },
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error: any) {
    console.error('POST jira-ticket error:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
