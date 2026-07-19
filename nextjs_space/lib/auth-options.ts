import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

const AUTH_REFRESH_INTERVAL_MS = 60_000;

async function loadAuthorizationState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: { include: { parentOrganization: true } },
      department: true,
    },
  });
}

function applyAuthorizationState(token: any, user: any) {
  token.role = user.role;
  token.organizationId = user.organizationId;
  token.organizationName = user.organization?.name ?? user.organizationName ?? null;
  token.departmentId = user.departmentId;
  token.departmentName = user.department?.name ?? user.departmentName ?? null;
  token.parentOrganizationId = user.organization?.parentOrganizationId ?? user.parentOrganizationId ?? null;
  token.parentOrganizationName = user.organization?.parentOrganization?.name ?? user.parentOrganizationName ?? null;
  token.authorizationRefreshedAt = Date.now();
  token.accessRevoked = false;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const email = String(credentials.email).trim().toLowerCase();
          const user = await prisma.user.findUnique({
            where: { email },
            include: {
              organization: { include: { parentOrganization: true } },
              department: true,
            },
          });
          if (!user) return null;
          const isValid = await bcrypt.compare(String(credentials.password), user.password);
          if (!isValid) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            organizationName: user.organization?.name ?? null,
            departmentId: user.departmentId,
            departmentName: user.department?.name ?? null,
            parentOrganizationId: user.organization?.parentOrganizationId ?? null,
            parentOrganizationName: user.organization?.parentOrganization?.name ?? null,
          } as any;
        } catch (error) {
          console.error('[AUTH_CREDENTIALS_ERROR]', error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        applyAuthorizationState(token, user);
        return token;
      }

      const refreshedAt = Number(token.authorizationRefreshedAt || 0);
      if (token.sub && Date.now() - refreshedAt >= AUTH_REFRESH_INTERVAL_MS) {
        try {
          const currentUser = await loadAuthorizationState(String(token.sub));
          const role = String(currentUser?.role || token.role || '').toUpperCase();
          const requiresOrganization = role !== 'SUPERADMIN';
          if (!currentUser || (requiresOrganization && !currentUser.organizationId)) {
            token.accessRevoked = true;
            token.organizationId = null;
            token.departmentId = null;
            token.authorizationRefreshedAt = Date.now();
          } else {
            applyAuthorizationState(token, currentUser);
          }
        } catch (error) {
          console.error('Failed to refresh authorization state:', error);
        }
      }

      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).organizationName = token.organizationName;
        (session.user as any).departmentId = token.departmentId;
        (session.user as any).departmentName = token.departmentName;
        (session.user as any).parentOrganizationId = token.parentOrganizationId;
        (session.user as any).parentOrganizationName = token.parentOrganizationName;
        (session.user as any).accessRevoked = Boolean(token.accessRevoked);
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
};