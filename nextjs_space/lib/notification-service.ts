import { db } from './db';
import type { Threat, NotificationPreference } from '@prisma/client';

export type NotificationType =
  | 'THREAT_ADDED'
  | 'THREAT_STATUS_CHANGED'
  | 'JIRA_TICKET_CREATED'
  | 'ASSET_THREAT_MATCH'
  | 'ASSET_RISK_HIGH';

export type NotificationChannel = 'EMAIL' | 'SLACK' | 'TEAMS' | 'IN_APP';

export interface CreateNotificationParams {
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  threatId?: string;
  metadata?: Record<string, any>;
}

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Check if a user should receive a notification for a threat based on their preferences
 */
export async function checkShouldNotify(
  userId: string,
  threat: Threat,
  prefs?: NotificationPreference
): Promise<boolean> {
  // Fetch preferences if not provided
  if (!prefs) {
    prefs = (await db.notificationPreference.findUnique({
      where: { userId },
    })) ?? undefined;
  }

  // No preferences = no notifications
  if (!prefs) return false;

  // Check minimum severity
  const threatSeverityRank = SEVERITY_RANK[threat.severity] || 0;
  const minSeverityRank = SEVERITY_RANK[prefs.minSeverity] || 0;
  if (threatSeverityRank < minSeverityRank) return false;

  // Check KEV-only filter
  if (prefs.kevOnly) {
    const isKev = threat.source?.toLowerCase().includes('kev') ||
                  threat.source?.toLowerCase().includes('known exploited');
    if (!isKev) return false;
  }

  // Check asset match filter (requires additional context)
  // This would be checked at the caller level where asset context is available

  return true;
}

/**
 * Check if current time is within user's quiet hours
 */
export function isQuietHours(prefs: NotificationPreference): boolean {
  if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Simple time range check (doesn't handle overnight ranges yet)
  return currentTime >= prefs.quietHoursStart && currentTime <= prefs.quietHoursEnd;
}

/**
 * Create a notification log entry
 */
export async function createNotification(params: CreateNotificationParams) {
  const { userId, organizationId, type, title, message, threatId, metadata } = params;

  // Get user preferences
  const prefs = await db.notificationPreference.findUnique({
    where: { userId },
  });

  if (!prefs) {
    console.warn(`No notification preferences found for user ${userId}`);
    return null;
  }

  // Determine active channels
  const channels: NotificationChannel[] = [];
  if (prefs.emailEnabled && prefs.email) channels.push('EMAIL');
  if (prefs.slackEnabled && prefs.slackWebhook) channels.push('SLACK');
  if (prefs.teamsEnabled && prefs.teamsWebhook) channels.push('TEAMS');

  if (channels.length === 0) {
    console.log(`No active notification channels for user ${userId}`);
    return null;
  }

  // Check quiet hours
  const inQuietHours = isQuietHours(prefs);

  // Create notification logs for each channel
  const notifications = await Promise.all(
    channels.map(channel =>
      db.notificationLog.create({
        data: {
          userId,
          organizationId,
          type,
          channel,
          status: inQuietHours ? 'PENDING' : (prefs.digestMode !== 'IMMEDIATE' ? 'PENDING' : 'PENDING'),
          title,
          message,
          metadata: metadata ? JSON.stringify(metadata) : null,
          threatId,
        },
      })
    )
  );

  // Handle immediate sending or queueing
  if (prefs.digestMode === 'IMMEDIATE' && !inQuietHours) {
    for (const notification of notifications) {
      await sendNotification(notification.id);
    }
  } else {
    // Queue for digest
    for (const notification of notifications) {
      await queueDigestNotification(userId, notification.id, prefs);
    }
  }

  return notifications;
}

/**
 * Send a notification via its configured channel
 */
export async function sendNotification(notificationId: string) {
  const notification = await db.notificationLog.findUnique({
    where: { id: notificationId },
    include: { user: { include: { notificationPreference: true } } },
  });

  if (!notification || !notification.user.notificationPreference) {
    return { success: false, error: 'Notification or preferences not found' };
  }

  const prefs = notification.user.notificationPreference;
  let result: { success: boolean; error?: string } = { success: false };

  try {
    switch (notification.channel) {
      case 'EMAIL':
        result = await sendEmail(prefs.email!, notification.title, notification.message);
        break;
      case 'SLACK':
        result = await sendSlack(prefs.slackWebhook!, notification.title, notification.message);
        break;
      case 'TEAMS':
        result = await sendTeams(prefs.teamsWebhook!, notification.title, notification.message);
        break;
      default:
        result = { success: false, error: 'Unknown channel' };
    }

    // Update notification status
    await db.notificationLog.update({
      where: { id: notificationId },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        failureReason: result.error || null,
      },
    });

    return result;
  } catch (error: any) {
    await db.notificationLog.update({
      where: { id: notificationId },
      data: {
        status: 'FAILED',
        failureReason: error?.message || 'Unknown error',
      },
    });
    return { success: false, error: error?.message };
  }
}

/**
 * Queue a notification for digest delivery
 */
async function queueDigestNotification(
  userId: string,
  notificationLogId: string,
  prefs: NotificationPreference
) {
  // Calculate scheduled delivery time
  const now = new Date();
  let scheduledFor = new Date();

  if (prefs.digestMode === 'DAILY') {
    // Schedule for tomorrow at digestTime
    const [hours, minutes] = prefs.digestTime.split(':').map(Number);
    scheduledFor.setDate(now.getDate() + 1);
    scheduledFor.setHours(hours, minutes, 0, 0);
  } else if (prefs.digestMode === 'WEEKLY') {
    // Schedule for next Monday at digestTime
    const [hours, minutes] = prefs.digestTime.split(':').map(Number);
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    scheduledFor.setDate(now.getDate() + daysUntilMonday);
    scheduledFor.setHours(hours, minutes, 0, 0);
  }

  await db.digestQueue.create({
    data: {
      userId,
      notificationLogId,
      scheduledFor,
    },
  });
}

/**
 * Send accumulated digest notifications for a user
 */
export async function sendDigest(userId: string) {
  const pendingDigests = await db.digestQueue.findMany({
    where: {
      userId,
      processed: false,
      scheduledFor: { lte: new Date() },
    },
    include: { notificationLog: true },
  });

  if (pendingDigests.length === 0) return { success: true, count: 0 };

  // Group by channel
  const byChannel: Record<string, typeof pendingDigests> = {};
  for (const digest of pendingDigests) {
    const channel = digest.notificationLog.channel;
    if (!byChannel[channel]) byChannel[channel] = [];
    byChannel[channel].push(digest);
  }

  // Send digest for each channel
  for (const [channel, digests] of Object.entries(byChannel)) {
    const title = `ThreatPulse Digest: ${digests.length} notifications`;
    const message = digests.map((d: any) => `• ${d.notificationLog.title}`).join('\n');

    // Send via appropriate channel (using first notification's user prefs)
    await sendNotification(digests[0].notificationLog.id);
  }

  // Mark as processed
  await db.digestQueue.updateMany({
    where: { id: { in: pendingDigests.map((d: any) => d.id) } },
    data: { processed: true },
  });

  return { success: true, count: pendingDigests.length };
}

/**
 * Email sender (stubbed - requires SMTP configuration)
 */
async function sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; error?: string }> {
  // Check if SMTP is configured
  const smtpConfigured = process.env.SMTP_HOST && process.env.SMTP_USER;

  if (!smtpConfigured) {
    console.log(`[EMAIL STUB] Would send to ${to}: ${subject}`);
    return { success: false, error: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in environment.' };
  }

  // TODO: Implement actual SMTP sending using nodemailer
  // For now, log and return success
  console.log(`[EMAIL] Sending to ${to}: ${subject}`);
  return { success: true };
}

/**
 * Slack webhook sender (stubbed - requires webhook URL)
 */
async function sendSlack(webhook: string, title: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!webhook) {
    return { success: false, error: 'Slack webhook not configured' };
  }

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: title,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*${title}*\n${message}` },
          },
        ],
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Slack API error: ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send Slack message' };
  }
}

/**
 * Teams webhook sender (stubbed - requires webhook URL)
 */
async function sendTeams(webhook: string, title: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!webhook) {
    return { success: false, error: 'Teams webhook not configured' };
  }

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        summary: title,
        sections: [
          {
            activityTitle: title,
            activitySubtitle: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Teams API error: ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send Teams message' };
  }
}

/**
 * Format threat data for notification
 */
export function formatThreatNotification(threat: Threat) {
  return {
    title: `New ${threat.severity} Threat: ${threat.title}`,
    message: `CVE: ${threat.threatId}\nSeverity: ${threat.severity}\nCVSS: ${threat.cvssScore || 'N/A'}\nSource: ${threat.source}\n\n${threat.description?.substring(0, 200)}...`,
  };
}
