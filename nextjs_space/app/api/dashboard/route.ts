export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { isActionedStatus, isTerminalStatus, isOverdue } from '@/lib/threat-status';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUserId = (session.user as any)?.id as string | undefined;
    // Dashboard reflects the GLOBAL threat catalog shared by every org.
    const threats = await prisma.threat.findMany({
      orderBy: { dateAdded: 'desc' },
      include: { assignedTo: { select: { id: true, name: true, email: true, role: true } } },
    });
    const total = threats?.length ?? 0;

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let todayCount = 0;

    // Build 14-day trend buckets
    const trendBuckets: Record<string, Record<string, number>> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      trendBuckets[key] = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    }

    (threats ?? []).forEach((t: any) => {
      bySeverity[t?.severity ?? 'UNKNOWN'] = (bySeverity[t?.severity ?? 'UNKNOWN'] ?? 0) + 1;
      byType[t?.type ?? 'UNKNOWN'] = (byType[t?.type ?? 'UNKNOWN'] ?? 0) + 1;
      byStatus[t?.status ?? 'UNKNOWN'] = (byStatus[t?.status ?? 'UNKNOWN'] ?? 0) + 1;

      const src = t?.source || 'Unknown';
      bySource[src] = (bySource[src] ?? 0) + 1;

      const addedDate = new Date(t?.dateAdded);
      if (addedDate >= todayStart) todayCount++;

      const dateKey = `${addedDate.getMonth() + 1}/${addedDate.getDate()}`;
      if (trendBuckets[dateKey]) {
        const sev = t?.severity ?? 'MEDIUM';
        trendBuckets[dateKey][sev] = (trendBuckets[dateKey][sev] ?? 0) + 1;
      }
    });

    const trendData = Object.entries(trendBuckets).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    const recentThreats = (threats ?? []).slice(0, 15);

    // --- Analyst workflow: "Action Required" metrics ---
    const actionRequiredThreats = (threats ?? []).filter(
      (t: any) => t?.status === 'ACTION_REQUIRED',
    );
    const openActionedThreats = (threats ?? []).filter(
      (t: any) => isActionedStatus(t?.status) && !isTerminalStatus(t?.status),
    );
    const unassignedCount = (threats ?? []).filter((t: any) => !t?.assignedToId).length;
    const overdueThreats = (threats ?? []).filter((t: any) => isOverdue(t?.dueDate, t?.status));
    const myAssignedThreats = currentUserId
      ? (threats ?? []).filter((t: any) => t?.assignedToId === currentUserId)
      : [];
    const myOpenAssignedCount = myAssignedThreats.filter(
      (t: any) => !isTerminalStatus(t?.status),
    ).length;

    const actionRequired = {
      actionRequiredCount: actionRequiredThreats.length,
      openCount: openActionedThreats.length,
      unassignedCount,
      overdueCount: overdueThreats.length,
      myAssignedCount: myAssignedThreats.length,
      myOpenAssignedCount,
      // Top items needing attention: overdue first, then ACTION_REQUIRED, most recent.
      items: openActionedThreats
        .slice()
        .sort((a: any, b: any) => {
          const ao = isOverdue(a?.dueDate, a?.status) ? 1 : 0;
          const bo = isOverdue(b?.dueDate, b?.status) ? 1 : 0;
          if (ao !== bo) return bo - ao;
          const ar = a?.status === 'ACTION_REQUIRED' ? 1 : 0;
          const br = b?.status === 'ACTION_REQUIRED' ? 1 : 0;
          if (ar !== br) return br - ar;
          return new Date(b?.dateAdded).getTime() - new Date(a?.dateAdded).getTime();
        })
        .slice(0, 8)
        .map((t: any) => ({
          id: t.id,
          threatId: t.threatId,
          title: t.title,
          severity: t.severity,
          status: t.status,
          dueDate: t.dueDate,
          tags: t.tags ?? [],
          assignedTo: t.assignedTo ?? null,
          overdue: isOverdue(t?.dueDate, t?.status),
        })),
    };

    return NextResponse.json({
      total,
      bySeverity,
      byType,
      byStatus,
      bySource,
      todayCount,
      trendData,
      recentThreats,
      actionRequired,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
