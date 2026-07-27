'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FadeIn } from '@/components/ui/animate';
import {
  ShieldCheck, ShieldAlert, KeyRound, Monitor, Loader2, Download,
  Trash2, LogOut, CheckCircle2, KeySquare,
} from 'lucide-react';
import { toast } from 'sonner';

type MfaStatus = { enabled: boolean; verified: boolean; backupCodesRemaining: number };
type SessionRow = {
  id: string; userAgent: string | null; ipAddress: string | null;
  lastSeenAt: string; createdAt: string; current: boolean;
};

function friendlyAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const b = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux'
    : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'Unknown OS';
  return `${b} on ${os}`;
}

export default function SecurityContent() {
  const { data: session } = useSession() || {};
  const user = session?.user as any;
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'PARENT_ADMIN';

  return (
    <div className="p-6 space-y-6 max-w-[900px] mx-auto">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Security</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage two-factor authentication, your password, and active sessions
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}><MfaCard /></FadeIn>
      <FadeIn delay={0.1}><PasswordCard /></FadeIn>
      <FadeIn delay={0.15}><SessionsCard /></FadeIn>

      {isAdmin && (
        <FadeIn delay={0.2}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <KeySquare className="w-4 h-4 text-muted-foreground" /> API Keys
              </CardTitle>
              <CardDescription>Manage programmatic access tokens for your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/api-keys">
                <Button variant="outline" size="sm">Manage API Keys</Button>
              </Link>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}

/* ------------------------------- MFA ------------------------------- */
function MfaCard() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/mfa/status');
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setSetupData(data);
      else toast.error(data?.error || 'Failed to start setup');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        setBackupCodes(data.backupCodes || []);
        setSetupData(null); setCode('');
        toast.success('Two-factor authentication enabled');
        load();
      } else toast.error(data?.error || 'Invalid code');
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Two-factor authentication disabled');
        setShowDisable(false); setDisablePassword(''); load();
      } else toast.error(data?.error || 'Failed to disable');
    } finally { setBusy(false); }
  };

  const downloadCodes = () => {
    if (!backupCodes) return;
    const blob = new Blob(
      [`ThreatPulse backup codes\nGenerated: ${new Date().toISOString()}\n\n${backupCodes.join('\n')}\n\nEach code can be used once.`],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'threatpulse-backup-codes.txt'; a.click();
    URL.revokeObjectURL(url);
  };

  const enabled = !!status?.enabled;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {enabled
            ? <ShieldCheck className="w-4 h-4 text-emerald-500" />
            : <ShieldAlert className="w-4 h-4 text-amber-500" />}
          Two-Factor Authentication (TOTP)
          {enabled && <Badge variant="secondary" className="ml-1">Enabled</Badge>}
        </CardTitle>
        <CardDescription>
          Add an extra layer of security using an authenticator app (Google Authenticator, Authy, 1Password).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-8 bg-muted animate-pulse rounded" />
        ) : backupCodes ? (
          <div className="space-y-3">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Save your backup codes</AlertTitle>
              <AlertDescription>
                Store these somewhere safe. Each code can be used once if you lose access to your authenticator.
                They will not be shown again.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-muted/50 rounded-md p-4">
              {backupCodes.map((c) => <div key={c}>{c}</div>)}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={downloadCodes}>
                <Download className="w-4 h-4 mr-1" /> Download
              </Button>
              <Button size="sm" onClick={() => setBackupCodes(null)}>Done</Button>
            </div>
          </div>
        ) : setupData ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setupData.qrCode} alt="MFA QR code" className="w-40 h-40 rounded-md border border-border bg-white p-1" />
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Scan the QR code with your authenticator app, or enter this secret manually:</p>
                <code className="block bg-muted px-2 py-1 rounded font-mono text-xs break-all">{setupData.secret}</code>
              </div>
            </div>
            <div className="space-y-2 max-w-[240px]">
              <Label htmlFor="mfa-code">Enter the 6-digit code</Label>
              <Input id="mfa-code" inputMode="numeric" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={verify} disabled={busy || code.length !== 6}>
                {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Verify & Enable
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSetupData(null); setCode(''); }}>Cancel</Button>
            </div>
          </div>
        ) : enabled ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Two-factor authentication is active. {status?.backupCodesRemaining ?? 0} backup code(s) remaining.
            </p>
            {!showDisable ? (
              <Button size="sm" variant="outline" onClick={() => setShowDisable(true)}>Disable 2FA</Button>
            ) : (
              <div className="space-y-2 max-w-[320px]">
                <Label htmlFor="disable-pw">Confirm your password to disable</Label>
                <Input id="disable-pw" type="password" value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)} placeholder="Current password" />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={disable} disabled={busy || !disablePassword}>
                    {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirm Disable
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowDisable(false); setDisablePassword(''); }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Button size="sm" onClick={startSetup} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Enable 2FA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Password ----------------------------- */
function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next !== confirm) { toast.error('New passwords do not match'); return; }
    if (next.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Password updated. Other sessions were signed out.');
        setCurrent(''); setNext(''); setConfirm('');
      } else toast.error(data?.error || 'Failed to change password');
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground" /> Password
        </CardTitle>
        <CardDescription>Change your account password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-w-[360px]">
        <div className="space-y-1.5">
          <Label htmlFor="cur-pw">Current password</Label>
          <Input id="cur-pw" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pw">New password</Label>
          <Input id="new-pw" type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="conf-pw">Confirm new password</Label>
          <Input id="conf-pw" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button size="sm" onClick={submit} disabled={busy || !current || !next || !confirm}>
          {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Update Password
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Sessions ----------------------------- */
function SessionsCard() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/sessions');
      if (res.ok) { const d = await res.json(); setSessions(d?.sessions ?? []); }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Session revoked'); load(); }
      else toast.error('Failed to revoke session');
    } finally { setBusy(false); }
  };

  const revokeOthers = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/auth/sessions/others', { method: 'DELETE' });
      if (res.ok) { toast.success('All other sessions revoked'); load(); }
      else toast.error('Failed');
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="w-4 h-4 text-muted-foreground" /> Active Sessions
          </CardTitle>
          <CardDescription>Devices currently signed in to your account</CardDescription>
        </div>
        {sessions.length > 1 && (
          <Button size="sm" variant="outline" onClick={revokeOthers} disabled={busy}>
            <LogOut className="w-4 h-4 mr-1" /> Sign out others
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="h-12 bg-muted animate-pulse rounded" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active session records yet.</p>
        ) : (
          sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-md border border-border/50 p-3">
              <div className="text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {friendlyAgent(s.userAgent)}
                  {s.current && <Badge variant="secondary" className="text-[10px]">This device</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {s.ipAddress || 'Unknown IP'} · Last active {new Date(s.lastSeenAt).toLocaleString()}
                </div>
              </div>
              {!s.current && (
                <Button size="icon" variant="ghost" onClick={() => revoke(s.id)} disabled={busy}
                  aria-label="Revoke session">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
