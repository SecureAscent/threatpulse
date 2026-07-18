export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditEvent } from '@/lib/audit';
import {
  buildThreatScope,
  canAssignDepartment,
  getTenantContext,
  hasPermission,
} from '@/lib/tenant-context';

export async function GET(req: NextRequest) {
  try {
    const context = await getTenantContext();
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(context, 'threats.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const severity = url.searchParams.get('severity');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    const where: any = buildThreatScope(context);
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (search) {
      where.AND = [{
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { threatId: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }];
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
    const context = await getTenantContext();
    if (!context) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(context, 'threats.create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { threatId, title, type, severity, status, description, affectedAssets, source, indicators, mitreTactic, mitreTechnique, cvssScore, departmentId } = body ?? {};
    if (!threatId || !title || !type || !severity) {
      return NextResponse.json({ error: 'Required fields: threatId, title, type, severity' }, { status: 400 });
    }

    const targetDepartmentId = canAssignDepartment(context)
      ? departmentId || null
      : context.departmentId;

    if (targetDepartmentId) {
      const validDepartment = await prisma.department.findFirst({
        where: { id: targetDepartmentId, organizationId: context.organizationId },
        select: { id: true },
      });
      if (!validDepartment) {
        return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
      }
    }

    const parsedCvss = cvssScore === null || cvssScore === undefined || cvssScore === ''
      ? null
      : Number(cvssScore);
    if (parsedCvss !== null && !Number.isFinite(parsedCvss)) {
      return NextResponse.json({ error: 'Invalid CVSS score' }, { status: 400 });
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
        cvssScore: parsedCvss,
        organizationId: context.organizationId,
        departmentId: targetDepartmentId,
      },
    });

    await writeAuditEvent({
      context,
      action: 'threat.created',
      entityType: 'Threat',
      entityId: threat.id,
      departmentId: threat.departmentId,
      metadata: { threatId: threat.threatId, severity: threat.severity, type: threat.type },
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
