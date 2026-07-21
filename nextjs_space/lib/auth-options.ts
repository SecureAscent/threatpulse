import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { verifyTotp } from '@/lib/mfa';
import { sha256 } from '@/lib/crypto';

/**
 * Special error strings thrown from `authorize` so the login UI can react.
 * With `signIn(..., { redirect: false })` these surface as `res.error`.
 */
export const MFA_REQUIRED = 'MFA_REQUIRED';
export const MFA_INVALID = 'MFA_INVALID';

/**
 * Validate a TOTP token OR a one-time backup code for a user.
 * Backup codes are stored hashed; a matching code is consumed on use.
 */
async function validateSecondFactor(userId: string, token: string): Promise<boolean> {
  const mfa = await prisma.mfaSecret.findUnique({ where: { userId } });
  if (!mfa || !mfa.verified) return true; // MFA not enabled → nothing to check

  const cleaned = token.trim();
  if (!cleaned) return false;

  // 1) Try TOTP
  if (verifyTotp(cleaned, mfa.secret)) return true;

  // 2) Try backup code (case-insensitive, hyphen-insensitive)
  const normalized = cleaned.toUpperCase().replace(/\s/g, '');
  const candidateHash = sha256(normalized);
  const idx = mfa.backupCodes.indexOf(candidateHash);
  if (idx !== -1) {
    const remaining = [...mfa.backupCodes];
    remaining.splice(idx, 1);
    await prisma.mfaSecret.update({
      where: { userId },
      data: { backupCodes: remaining },
    });
    return true;
  }
  return false;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totp: { label: 'Authentication code', type: 'text' },
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { organization: true, mfaSecret: true },
        });
        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        // Second factor, if the user has verified MFA.
        const mfaEnabled = !!user.mfaSecret?.verified;
        if (mfaEnabled) {
          const totp = (credentials.totp || '').toString();
          if (!totp) {
            throw new Error(MFA_REQUIRED);
          }
          const ok = await validateSecondFactor(user.id, totp);
          if (!ok) {
            throw new Error(MFA_INVALID);
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user?.organization?.name ?? null,
        } as any;
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
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).organizationName = token.organizationName;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
