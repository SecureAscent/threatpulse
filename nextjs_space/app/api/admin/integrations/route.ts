export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

const SECRET_KEY_PATTERN = /(secret|token|password|api[_-]?key|private[_-]?key)/i;

type AdminSessionUser = {
  role: string;
  organizationId: string | null;
};

async function getOrganizationAdmin(): Promise<AdminSessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as AdminSessionUser | undefined;

  if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role) || !user.organizationId) {
    return null;
  }

  return user;
}

function parseConfig(configData: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(configData || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function redactSecrets(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !SECRET_KEY_PATTERN.test(key)),
  );
}

function mergeConfig(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
) {
  const merged = { ...existing };

  for (const [key, value] of Object.entries(incoming)) {
    // Empty secret fields mean “leave the stored credential unchanged”.
    if (SECRET_KEY_PATTERN.test(key) && (value === '' || value === null || value === undefined)) {
      continue;
    }
    merged[key] = value;
  }

  return merged;
}

export async function GET() {
  try {
    const user = await getOrganizationAdmin();
    if (!user) return NextResponse.json({ error: 'Admin access with an organization is required' }, { status: 403 });

    const configs = await prisma.integrationConfig.findMany({
      where: { organizationId: user.organizationId! },
      select: { integrationId: true, enabled: true, configData: true, updatedAt: true },
    });

    return NextResponse.json({
      configs: configs.map((config) => {
        const parsed = parseConfig(config.configData);
        const configuredSecretKeys = Object.keys(parsed).filter((key) => SECRET_KEY_PATTERN.test(key));

        return {
          integrationId: config.integrationId,
          enabled: config.enabled,
          configData: JSON.stringify(redactSecrets(parsed)),
          configuredSecretKeys,
          updatedAt: config.updatedAt,
        };
      }),
    });
  } catch (error: unknown) {
    console.error('[INTEGRATIONS_GET_ERROR]', error);
    return NextResponse.json({ error: 'Failed to load integrations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrganizationAdmin();
    if (!user) return NextResponse.json({ error: 'Admin access with an organization is required' }, { status: 403 });

    const body = await req.json();
    const { integrationId, config, enabled } = body ?? {};
    if (!integrationId) {
      return NextResponse.json({ error: 'Missing integrationId' }, { status: 400 });
    }

    if (config !== undefined && (!config || typeof config !== 'object' || Array.isArray(config))) {
      return NextResponse.json({ error: 'Config must be an object' }, { status: 400 });
    }

    const existing = await prisma.integrationConfig.findUnique({
      where: {
        organizationId_integrationId: {
          organizationId: user.organizationId!,
          integrationId,
        },
      },
      select: { configData: true },
    });

    const mergedConfig = config !== undefined
      ? mergeConfig(parseConfig(existing?.configData ?? '{}'), config)
      : parseConfig(existing?.configData ?? '{}');
    const isEnabled = typeof enabled === 'boolean' ? enabled : true;

    const saved = await prisma.integrationConfig.upsert({
      where: {
        organizationId_integrationId: {
          organizationId: user.organizationId!,
          integrationId,
        },
      },
      update: {
        ...(config !== undefined ? { configData: JSON.stringify(mergedConfig) } : {}),
        enabled: isEnabled,
      },
      create: {
        organizationId: user.organizationId!,
        integrationId,
        configData: JSON.stringify(mergedConfig),
        enabled: isEnabled,
      },
    });

    return NextResponse.json({ success: true, id: saved.id, enabled: saved.enabled });
  } catch (error: unknown) {
    console.error('[INTEGRATIONS_POST_ERROR]', error);
    return NextResponse.json({ error: 'Failed to save integration' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getOrganizationAdmin();
    if (!user) return NextResponse.json({ error: 'Admin access with an organization is required' }, { status: 403 });

    const body = await req.json();
    const { integrationId, enabled } = body ?? {};
    if (!integrationId || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Missing integrationId or enabled flag' }, { status: 400 });
    }

    const saved = await prisma.integrationConfig.upsert({
      where: {
        organizationId_integrationId: {
          organizationId: user.organizationId!,
          integrationId,
        },
      },
      update: { enabled },
      create: {
        organizationId: user.organizationId!,
        integrationId,
        configData: '{}',
        enabled,
      },
    });

    return NextResponse.json({ success: true, enabled: saved.enabled });
  } catch (error: unknown) {
    console.error('[INTEGRATIONS_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Failed to toggle integration' }, { status: 500 });
  }
}
