import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { notificationPreference: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create default preferences if none exist
    if (!user.notificationPreference) {
      const defaultPrefs = await db.notificationPreference.create({
        data: {
          userId: user.id,
          email: user.email,
          emailEnabled: true,
          slackEnabled: false,
          teamsEnabled: false,
          minSeverity: 'HIGH',
          kevOnly: false,
          assetMatchOnly: false,
          digestMode: 'IMMEDIATE',
          digestTime: '08:00',
          quietHoursEnabled: false,
        },
      });
      return NextResponse.json(defaultPrefs);
    }

    return NextResponse.json(user.notificationPreference);
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences', details: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();

    // Validate inputs
    if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (body.minSeverity && !['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(body.minSeverity)) {
      return NextResponse.json({ error: 'Invalid severity level' }, { status: 400 });
    }

    if (body.digestMode && !['IMMEDIATE', 'DAILY', 'WEEKLY'].includes(body.digestMode)) {
      return NextResponse.json({ error: 'Invalid digest mode' }, { status: 400 });
    }

    // Upsert preferences
    const prefs = await db.notificationPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...body,
      },
      update: body,
    });

    return NextResponse.json(prefs);
  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences', details: error?.message },
      { status: 500 }
    );
  }
}
