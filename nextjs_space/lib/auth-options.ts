import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

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
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: {
              organization: { include: { parentOrganization: true } },
              department: true,
            },
          });
          if (!user) return null;
          const isValid = await bcrypt.compare(credentials.password, user.password);
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
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.departmentId = user.departmentId;
        token.departmentName = user.departmentName;
        token.parentOrganizationId = user.parentOrganizationId;
        token.parentOrganizationName = user.parentOrganizationName;
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
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
};
