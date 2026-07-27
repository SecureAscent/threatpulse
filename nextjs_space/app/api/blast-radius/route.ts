export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

type GraphNode = {
  id: string;
  label: string;
  type: 'threat' | 'asset' | 'department';
  severity?: string;
  riskScore?: number | null;
  department?: string | null;
};
type GraphEdge = { source: string; target: string };

// GET /api/blast-radius?threatId=xxx
// Returns a graph of threats -> assets -> departments for the user's org.
// SUPERADMIN sees all orgs.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const isSuper = user?.role === 'SUPERADMIN';
    const orgId = user?.organizationId;

    const threatId = req.nextUrl.searchParams.get('threatId');

    // Scope: SUPERADMIN sees everything; others only their org.
    const orgWhere: any = isSuper ? {} : { organizationId: orgId };
    if (!isSuper && !orgId) {
      return NextResponse.json({ nodes: [], edges: [], stats: emptyStats() });
    }

    // Pull only threats that have at least one asset link (the blast radius).
    const threatWhere: any = {
      ...orgWhere,
      assetLinks: { some: {} },
    };
    if (threatId) threatWhere.id = threatId;

    const threats = await prisma.threat.findMany({
      where: threatWhere,
      select: {
        id: true,
        title: true,
        threatId: true,
        severity: true,
        riskScore: true,
        isKev: true,
        assetLinks: {
          select: {
            asset: {
              select: {
                id: true,
                productName: true,
                department: true,
                riskScore: true,
              },
            },
          },
        },
      },
      orderBy: [{ riskScore: 'desc' }, { severity: 'asc' }],
    });

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seenNodes = new Set<string>();
    const departmentCounts = new Map<string, number>();
    const affectedAssetIds = new Set<string>();

    const addNode = (n: GraphNode) => {
      if (seenNodes.has(n.id)) return;
      seenNodes.add(n.id);
      nodes.push(n);
    };

    for (const t of threats) {
      const threatNodeId = `threat:${t.id}`;
      addNode({
        id: threatNodeId,
        label: t.title || t.threatId,
        type: 'threat',
        severity: t.severity,
        riskScore: t.riskScore,
      });

      for (const link of t.assetLinks) {
        const asset = link.asset;
        if (!asset) continue;
        const assetNodeId = `asset:${asset.id}`;
        addNode({
          id: assetNodeId,
          label: asset.productName,
          type: 'asset',
          riskScore: asset.riskScore,
          department: asset.department,
        });
        edges.push({ source: threatNodeId, target: assetNodeId });
        affectedAssetIds.add(asset.id);

        const dept = (asset.department || '').trim();
        if (dept) {
          const deptNodeId = `dept:${dept}`;
          addNode({ id: deptNodeId, label: dept, type: 'department', department: dept });
          // asset -> department (only add each asset-dept edge once)
          edges.push({ source: assetNodeId, target: deptNodeId });
          departmentCounts.set(dept, (departmentCounts.get(dept) || 0) + 1);
        }
      }
    }

    // Most exposed department (by number of affected assets).
    let mostExposedDepartment: string | null = null;
    let maxDeptCount = 0;
    for (const [dept, count] of departmentCounts.entries()) {
      if (count > maxDeptCount) {
        maxDeptCount = count;
        mostExposedDepartment = dept;
      }
    }

    const stats = {
      totalThreats: threats.length,
      totalAffectedAssets: affectedAssetIds.size,
      totalDepartments: departmentCounts.size,
      mostExposedDepartment,
      mostExposedDepartmentCount: maxDeptCount,
    };

    // Lightweight threat list for the left panel (independent of graph dedup).
    const threatList = threats.map((t) => ({
      id: t.id,
      title: t.title || t.threatId,
      severity: t.severity,
      riskScore: t.riskScore,
      isKev: t.isKev,
      assetCount: t.assetLinks.length,
    }));

    return NextResponse.json({ nodes, edges, stats, threats: threatList });
  } catch (error: any) {
    console.error('Blast radius error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

function emptyStats() {
  return {
    totalThreats: 0,
    totalAffectedAssets: 0,
    totalDepartments: 0,
    mostExposedDepartment: null,
    mostExposedDepartmentCount: 0,
  };
}
