'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, Eye, EyeOff, Lock, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { toast } from 'sonner';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Register an ActiveSession record so the user can see & revoke this device.
  const registerSession = async () => {
    try {
      await fetch('/api/auth/sessions', { method: 'POST' });
    } catch {
      /* non-fatal — session tracking is best-effort */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    if (mfaRequired && totp.length < 6) { toast.error('Enter your 6-digit code'); return; }
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email,
        password,
        totp: mfaRequired ? totp : undefined,
        redirect: false,
      });

      if (res?.error === 'MFA_REQUIRED') {
        setMfaRequired(true);
        toast.message('Enter the code from your authenticator app');
      } else if (res?.error === 'MFA_INVALID') {
        toast.error('Invalid or expired authentication code');
        setTotp('');
      } else if (res?.error) {
        toast.error('Invalid email or password');
      } else {
        await registerSession();
        router.replace('/dashboard');
      }
    } catch {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>
      <Card className="w-full max-w-md relative z-10 border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display tracking-tight">ThreatPulse Intel</CardTitle>
            <CardDescription className="mt-1">
              {mfaRequired ? 'Two-factor authentication required' : 'Sign in to your threat intelligence platform'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!mfaRequired ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="analyst@company.com" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="pl-10 pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="totp">Authentication code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="totp" inputMode="numeric" autoFocus maxLength={8} placeholder="6-digit code or backup code"
                    value={totp} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTotp(e.target.value.replace(/[^0-9A-Za-z-]/g, ''))} className="pl-10 tracking-widest" />
                </div>
                <p className="text-xs text-muted-foreground">Enter the code from your authenticator app, or one of your backup codes.</p>
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              {mfaRequired ? 'Verify & Sign In' : 'Sign In'}
            </Button>

            {mfaRequired ? (
              <button type="button" onClick={() => { setMfaRequired(false); setTotp(''); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-primary hover:underline font-medium">Sign Up</Link>
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
