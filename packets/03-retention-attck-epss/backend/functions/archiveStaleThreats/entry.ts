import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DAY_MS = 86400000;
const RETENTION_DAYS = { short: 30, standard: 90 };

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'superadmin'].includes((user.role || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = Date.now();
    const threats = await base44.asServiceRole.entities.Threat.list('-created_date', 500);

    const toArchive = [];
    let scanned = 0;
    let skippedCritical = 0;

    for (const t of threats) {
      if (t.archived) continue;
      scanned++;
      const created = t.created_date ? new Date(t.created_date).getTime() : now;
      const ageDays = (now - created) / DAY_MS;
      const retention = RETENTION_DAYS[t.retention_class] || RETENTION_DAYS.standard;
      if (ageDays < retention) continue;
      // Preserve unresolved Critical/High threats past their window
      const unresolvedCritical =
        (t.severity === 'Critical' || t.severity === 'High') && t.status !== 'Mitigated';
      if (unresolvedCritical) { skippedCritical++; continue; }
      toArchive.push({ id: t.id, archived: true });
    }

    let archived = 0;
    if (toArchive.length > 0) {
      const result = await base44.asServiceRole.entities.Threat.bulkUpdate(toArchive);
      archived = Array.isArray(result) ? result.length : toArchive.length;
    }

    return Response.json({
      status: 'success',
      scanned,
      archived,
      skipped_critical_unresolved: skippedCritical,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Archival failed.' }, { status: 500 });
  }
}