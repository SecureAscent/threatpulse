export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { JiraService } from '@/lib/integrations/jira-service';

// POST /api/jira-tickets/[id]/push - Push a DRAFT ticket to Jira
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    const orgId = user?.organizationId;
    if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const ticketId = params.id;
    if (!ticketId) return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 });

    // Fetch ticket
    const ticket = await prisma.jiraTicket.findFirst({
      where: { id: ticketId, organizationId: orgId },
      include: { threat: { select: { threatId: true, title: true } } },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

    if (ticket.status !== 'DRAFT') {
      return NextResponse.json(
        { error: `Ticket is already ${ticket.status}. Only DRAFT tickets can be pushed.` },
        { status: 400 },
      );
    }

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

    const { url, email, apiToken, projectKey } = jiraConfig;
    if (!url || !email || !apiToken || !projectKey) {
      return NextResponse.json(
        { error: 'Jira config missing required fields (url, email, apiToken, projectKey)' },
        { status: 400 },
      );
    }

    // Build description
    let description = ticket.description || '';
    if (ticket.cveId) description += `\n\nCVE: ${ticket.cveId}`;
    if (ticket.cvssScore) description += ` | CVSS: ${ticket.cvssScore}`;
    if (ticket.affectedProduct) description += `\n\nAffected Product: ${ticket.affectedProduct}`;
    if (ticket.affectedPackage) description += ` (${ticket.affectedPackage})`;
    if (ticket.productOwner) description += `\nProduct Owner: ${ticket.productOwner}`;
    if (ticket.remediationSteps) description += `\n\nRemediation:\n${ticket.remediationSteps}`;
    if (ticket.notes) description += `\n\nInternal Notes:\n${ticket.notes}`;
    description += `\n\n---\nCreated by ThreatPulse | Threat: ${ticket.threat.threatId || ticket.threat.title}`;

    // Push to Jira
    const jira = new JiraService({ url, email, apiToken });
    const issue = await jira.createIssue({
      summary: ticket.title,
      description,
      priority: ticket.priority,
      projectKey,
      labels: ['threatpulse', 'security', ticket.cveId || 'vulnerability'].filter(Boolean),
    });

    // Update ticket with Jira key and status
    const updated = await prisma.jiraTicket.update({
      where: { id: ticketId },
      data: {
        jiraKey: issue.key,
        status: 'CREATED',
      },
    });

    return NextResponse.json({
      ok: true,
      jiraKey: issue.key,
      jiraUrl: `${url}/browse/${issue.key}`,
      ticket: updated,
    });
  } catch (error: any) {
    console.error('Jira push error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to push to Jira' },
      { status: 500 },
    );
  }
}
