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
    const organizationId = user.organizationId as string | null;
    const departmentId = user.departmentId as string | null;
    if (!organizationId) return NextResponse.json({ threats: [] });

    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const severity = url.searchParams.get('severity');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    const where: any = {
      organizationId,
      ...(departmentId ? { OR: [{ departmentId }, { departmentId: null }] } : {}),
    };
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (search) {
      const searchFields = [
        { title: { contains: search, mode: 'insensitive' } },
        { threatId: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
      where.AND = [{ OR: searchFields }];
    }

    const threats = await prisma.threat.findMany({ where, orderBy: { dateAdded: 'desc' } });
    return NextResponse.json({ threats });
  } catch (error) {
    console.error('GET threats error:', error);
    return NextResponse.json({ error: 'Failed to fetch threats' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const organizationId = user.organizationId as string | null;
    const sessionDepartmentId = user.departmentId as string | null;
    if (!organizationId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const body = await req.json();
    const { threatId, title, type, severity, status, description, affectedAssets, source, indicators, mitreTactic, mitreTechnique, cvssScore, departmentId } = body ?? {};
    if (!threatId || !title || !type || !severity) {
      return NextResponse.json({ error: 'Required fields: threatId, title, type, severity' }, { status: 400 });
    }

    const targetDepartmentId = user.role === 'ADMIN' ? (departmentId || null) : sessionDepartmentId;
    if (targetDepartmentId) {
      const validDepartment = await prisma.department.findFirst({
        where: { id: targetDepartmentId, organizationId },
        select: { id: true },
      });
      if (!validDepartment) return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
    }

    const threat = await prisma.threat.create({
      data: {
        threatId,
        title,
        type,
        severity,
        status: status || 'NEW',
        description: description || null,
        affectedAssets: affectedAssets || null,
        source: source || null,
        indicators: indicators || null,
        mitreTactic: mitreTactic || null,
        mitreTechnique: mitreTechnique || null,
        cvssScore: cvssScore ? parseFloat(cvssScore) : null,
        organizationId,
        departmentId: targetDepartmentId,
      },
    });
    return NextResponse.json({ threat }, { status: 201 });
  } catch (error: any) {
    console.error('POST threat error:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Threat ID already exists in this organization' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create threat' }, { status: 500 });
  }
}
