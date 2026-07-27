export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { JiraService } from '@/lib/integrations/jira-service';

// POST /api/jira-tickets/sync - Sync status from Jira for all tickets with jiraKey
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    // Load Jira config
    const config = await prisma.integrationConfig.findUnique({
      where: { organizationId_integrationId: { organizationId: orgId, integrationId: 'jira' } },
    });
    if (!config || !config.enabled) {
      return NextResponse.json({ error: 'Jira integration not configured or disabled' }, { status: 400 });
    }

    let jiraConfig: any = {};
    try {
      jiraConfig = JSON.parse(config.configData);
    } catch {
      return NextResponse.json({ error: 'Invalid Jira configuration' }, { status: 500 });
    }

    const { url, email, apiToken } = jiraConfig;
    if (!url || !email || !apiToken) {
      return NextResponse.json(
        { error: 'Jira config missing required fields (url, email, apiToken)' },
        { status: 400 },
      );
    }

    // Fetch all tickets with jiraKey that aren't CLOSED
    const tickets = await prisma.jiraTicket.findMany({
      where: {
        organizationId: orgId,
        jiraKey: { not: null },
        status: { not: 'CLOSED' },
      },
      select: { id: true, jiraKey: true, status: true },
    });

    if (tickets.length === 0) {
      return NextResponse.json({ ok: true, synced: 0, message: 'No tickets to sync' });
    }

    // Sync each ticket
    const jira = new JiraService({ url, email, apiToken });
    let synced = 0;
    let errors = 0;

    for (const ticket of tickets) {
      try {
        const issue = await jira.getIssue(ticket.jiraKey!);
        const newStatus = JiraService.mapStatus(issue.fields.status.name);
        if (newStatus !== ticket.status) {
          await prisma.jiraTicket.update({
            where: { id: ticket.id },
            data: { status: newStatus },
          });
          synced++;
        }
      } catch (err: any) {
        console.error(`Failed to sync ticket ${ticket.jiraKey}:`, err.message);
        errors++;
      }
    }

    return NextResponse.json({
      ok: true,
      total: tickets.length,
      synced,
      errors,
      message: `Synced ${synced} of ${tickets.length} tickets${errors > 0 ? ` (${errors} errors)` : ''}.`,
    });
  } catch (error: any) {
    console.error('Jira sync error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to sync from Jira' },
      { status: 500 },
    );
  }
}
