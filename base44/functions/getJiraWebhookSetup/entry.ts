import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return 'jwk_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin';

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const regenerate = body.regenerate === true;

    // Find the user's organization
    let org = null;
    const orgId = user.data?.organization_id;
    if (orgId) {
      try { org = await base44.asServiceRole.entities.Organization.get(orgId); } catch (_) { /* not found */ }
    }
    if (!org) {
      const orgPage = await base44.asServiceRole.entities.Organization.filter({}, { limit: 200 });
      org = (orgPage?.items || []).find((o) => (o.members || []).includes(user.id));
    }

    if (!org) {
      return Response.json({
        error: 'No organization found. Ask your admin to add you to an organization before setting up the Jira webhook.',
      }, { status: 404 });
    }

    // Generate or regenerate token — only admins can regenerate
    let token = org.jira_webhook_token;
    if (regenerate && !isAdmin) {
      return Response.json({ error: 'Only organization admins can regenerate the webhook token.' }, { status: 403 });
    }
    if (regenerate || !token) {
      token = randomToken();
      await base44.asServiceRole.entities.Organization.update(org.id, { jira_webhook_token: token });
    }

    const origin = new URL(req.url).origin;
    const webhookUrl = `${origin}/functions/jiraWebhookSync?token=${token}`;

    return Response.json({
      status: 'success',
      webhook_url: webhookUrl,
      token,
      org_name: org.name,
      regenerated: regenerate,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}