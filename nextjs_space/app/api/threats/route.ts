export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { extractDedupKey, findDuplicate, appendSourceUrl } from '@/lib/deduplication';
import { extractCveId, fetchEpssScores } from '@/lib/enrichment/epss';
import { inferMitreAttackIds } from '@/lib/enrichment/mitre';
import { calculateRiskScore, ageInDaysFrom, inferKev } from '@/lib/risk-score';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const severity = url.searchParams.get('severity');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const assignedTo = url.searchParams.get('assignedTo'); // user id, or "me", or "unassigned"
    const tag = url.searchParams.get('tag');
    const currentUserId = (session.user as any)?.id as string | undefined;

    // Threats are a GLOBAL shared catalog: every org sees the same CVE / KEV / NVD /
    // RSS feed. Org isolation applies only to products, Jira tickets and asset links.
    const where: any = {};
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (assignedTo === 'unassigned') {
      where.assignedToId = null;
    } else if (assignedTo === 'me') {
      where.assignedToId = currentUserId ?? '__none__';
    } else if (assignedTo) {
      where.assignedToId = assignedTo;
    }
    if (tag) where.tags = { has: tag };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { threatId: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const threats = await prisma.threat.findMany({
      where,
      orderBy: { dateAdded: 'desc' },
      include: { assignedTo: { select: { id: true, name: true, email: true, role: true } } },
    });
    return NextResponse.json({ threats });
  } catch (error: any) {
    console.error('GET threats error:', error);
    return NextResponse.json({ error: 'Failed to fetch threats' }, { status: 500 });
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
    const { threatId, title, type, severity, status, description, affectedAssets, source, indicators, mitreTactic, mitreTechnique, cvssScore } = body ?? {};
    const sourceUrl: string | null = body?.sourceUrl || null;
    if (!threatId || !title || !type || !severity) {
      return NextResponse.json({ error: 'Required fields: threatId, title, type, severity' }, { status: 400 });
    }

    // ── Deduplication ──────────────────────────────────────────────────────
    // Collapse the same underlying CVE reported by multiple feeds into one
    // canonical threat, appending each new source URL instead of duplicating.
    const dedupKey = extractDedupKey({ threatId, title, type });
    if (dedupKey) {
      const existingId = await findDuplicate(dedupKey, orgId);
      if (existingId) {
        await appendSourceUrl(existingId, sourceUrl);
        return NextResponse.json({ duplicate: true, existingId }, { status: 200 });
      }
    }

    // ── Auto-enrichment ────────────────────────────────────────────────────
    const cvss = cvssScore ? parseFloat(cvssScore) : null;
    const isKev = inferKev(source);
    const mitreAttackIds = inferMitreAttackIds({
      type, title, description, mitreTactic, mitreTechnique,
    });

    // Best-effort EPSS lookup (fails soft — never blocks creation).
    let epssScore: number | null = null;
    let epssPercentile: number | null = null;
    let epssUpdatedAt: Date | null = null;
    const cve = extractCveId(threatId, title);
    if (cve) {
      try {
        const scores = await fetchEpssScores([cve]);
        const s = scores.get(cve);
        if (s) {
          epssScore = s.probability;
          epssPercentile = s.percentile;
          epssUpdatedAt = new Date();
        }
      } catch {
        /* fail soft */
      }
    }

    const riskScore = calculateRiskScore({
      cvssScore: cvss,
      epssScore,
      epssPercentile,
      isKev,
      exploitAvailable: false,
      severity,
      ageInDays: 0,
      hasAffectedAssets: Boolean(affectedAssets && String(affectedAssets).trim()),
    });

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
        cvssScore: cvss,
        organizationId: orgId,
        dedupKey,
        sourceUrls: sourceUrl ? [sourceUrl] : [],
        isKev,
        mitreAttackIds,
        epssScore,
        epssPercentile,
        epssUpdatedAt,
        riskScore,
        enrichedAt: new Date(),
      },
    });
    return NextResponse.json({ threat }, { status: 201 });
  } catch (error: any) {
    console.error('POST threat error:', error);
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Threat ID already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create threat' }, { status: 500 });
  }
}
