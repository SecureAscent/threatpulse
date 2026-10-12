import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const evidenceId = body.evidence_id;
    if (!evidenceId) return Response.json({ error: 'evidence_id required' }, { status: 400 });

    const evidence = await base44.asServiceRole.entities.Evidence.get(evidenceId);
    if (!evidence) return Response.json({ error: 'Evidence not found' }, { status: 404 });

    const actor = user.email || user.full_name || 'Unknown';
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const auditEntries = (evidence.reveal_audit || '').split('\n').filter(Boolean);
    auditEntries.push(`${actor} @ ${now}`);

    await base44.asServiceRole.entities.Evidence.update(evidenceId, {
      revealed: true,
      reveal_expires: expires,
      reveal_audit: auditEntries.join('\n'),
    });

    return Response.json({
      status: 'success',
      evidence_id: evidenceId,
      revealed: true,
      reveal_expires: expires,
      reveal_count: auditEntries.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}