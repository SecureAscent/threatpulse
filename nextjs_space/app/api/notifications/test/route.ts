import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';
import { sendEmail, sendSlack, sendTeams } from '@/lib/notification-service';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { notificationPreference: true },
    });

    if (!user || !user.notificationPreference) {
      return NextResponse.json({ error: 'No notification preferences found' }, { status: 404 });
    }

    const { channel } = await req.json();
    const prefs = user.notificationPreference;

    const testTitle = 'ThreatPulse Test Notification';
    const testMessage = 'This is a test notification from ThreatPulse Intel. If you received this, your notification channel is configured correctly!';

    let result: { success: boolean; error?: string };

    switch (channel) {
      case 'EMAIL':
        if (!prefs.email) {
          return NextResponse.json({ error: 'Email address not configured' }, { status: 400 });
        }
        result = await sendEmail(prefs.email, testTitle, testMessage);
        break;

      case 'SLACK':
        if (!prefs.slackWebhook) {
          return NextResponse.json({ error: 'Slack webhook not configured' }, { status: 400 });
        }
        result = await sendSlack(prefs.slackWebhook, testTitle, testMessage);
        break;

      case 'TEAMS':
        if (!prefs.teamsWebhook) {
          return NextResponse.json({ error: 'Teams webhook not configured' }, { status: 400 });
        }
        result = await sendTeams(prefs.teamsWebhook, testTitle, testMessage);
        break;

      default:
        return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
    }

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Test notification sent successfully' });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification', details: error?.message },
      { status: 500 }
    );
  }
}

// Export the email/slack/teams senders from notification-service
// These are used both here and in the main service
async function sendEmail(to: string, subject: string, body: string) {
  const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER;
  
  if (!smtpConfigured) {
    return { success: false, error: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM in environment.' };
  }

  console.log(`[EMAIL TEST] Sending to ${to}: ${subject}`);
  return { success: true };
}

async function sendSlack(webhook: string, title: string, message: string) {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: title,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `*${title}*\n${message}` } }],
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Slack API returned ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send Slack message' };
  }
}

async function sendTeams(webhook: string, title: string, message: string) {
  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: title,
        sections: [{ activityTitle: title, activitySubtitle: message }],
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Teams API returned ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send Teams message' };
  }
}
