export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { hash } from 'bcryptjs';

async function getAdminUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) return null;
  return user;
}

export async function GET() {
  try {
    const user = await getAdminUser();
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const users = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { name, email, password, role = 'ANALYST' } = body ?? {};

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (role === 'SUPERADMIN' && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Cannot create SUPERADMIN' }, { status: 403 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: 'User exists' }, { status: 400 });

    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: await hash(password, 10),
        role,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({
      user: { id: created.id, name: created.name, email: created.email, role: created.role },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Admin create user error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json();
    const { userId, role } = body ?? {};
    if (!userId || !role) return NextResponse.json({ error: 'userId and role required' }, { status: 400 });

    if (role === 'SUPERADMIN' && user.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Cannot assign SUPERADMIN' }, { status: 403 });
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, organizationId: user.organizationId },
    });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    return NextResponse.json({ user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
  } catch (error: any) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
