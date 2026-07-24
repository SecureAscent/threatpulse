export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { JiraService } from '@/lib/integrations/jira-service';

// POST /api/integrations/jira/test - Test Jira connection with provided config
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = session.user as any;
    if (!['ADMIN', 'SUPERADMIN', 'PARENT_ADMIN'].includes(user?.role)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const { url, email, apiToken } = body;
    if (!url || !email || !apiToken) {
      return NextResponse.json({ error: 'url, email, and apiToken required' }, { status: 400 });
    }

    const jira = new JiraService({ url, email, apiToken });
    const result = await jira.testConnection();

    if (result.ok) {
      return NextResponse.json({ ok: true, message: `Connected as ${result.user}` });
    } else {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Jira test error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Connection test failed' },
      { status: 500 },
    );
  }
}
