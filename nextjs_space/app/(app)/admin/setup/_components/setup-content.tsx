'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/ui/animate';
import { CheckCircle2, Circle, Loader2, ShieldCheck, Users, KeySquare, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

type SetupData = {
  setupCompleted: boolean;
  signals: { adminCount: number; adminsWithMfa: number; allAdminsHaveMfa: boolean; userCount: number };
};

function ChecklistItem({ done, title, desc, action }: {
  done: boolean; title: string; desc: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      {done
        ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        : <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />}
      <div className="flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      {action}
    </div>
  );
}

export default function SetupContent() {
  const { data: session } = useSession() || {};
  const user = session?.user as any;
  const isSuperAdmin = user?.role === 'SUPERADMIN';

  const [data, setData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/setup');
      if (res.ok) setData(await res.json());
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setCompleted = async (completed: boolean) => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/setup/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(completed ? 'Setup marked complete' : 'Setup reopened');
        load();
      } else toast.error(d?.error || 'Failed to update setup');
    } finally { setBusy(false); }
  };

  const s = data?.signals;
  const hasUsers = (s?.userCount ?? 0) > 0;
  const hasAdmin = (s?.adminCount ?? 0) > 0;
  const mfaOk = !!s?.allAdminsHaveMfa;

  return (
    <div className="p-6 space-y-6 max-w-[800px] mx-auto">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Setup Checklist</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete these steps to finish onboarding your organization
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="border-border/50">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">Onboarding</CardTitle>
              <CardDescription>Recommended security and configuration tasks</CardDescription>
            </div>
            {data && (
              <Badge variant={data.setupCompleted ? 'secondary' : 'outline'}
                className={data.setupCompleted ? 'bg-emerald-500/15 text-emerald-500' : 'text-amber-500 border-amber-500/30'}>
                {data.setupCompleted ? 'Complete' : 'In progress'}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                <ChecklistItem
                  done={hasAdmin}
                  title="Create an administrator account"
                  desc={`${s?.adminCount ?? 0} admin account(s) configured`}
                  action={<Link href="/admin/users"><Button size="sm" variant="outline"><Users className="w-4 h-4 mr-1" />Users</Button></Link>}
                />
                <ChecklistItem
                  done={hasUsers}
                  title="Invite your team"
                  desc={`${s?.userCount ?? 0} user(s) in the organization`}
                  action={<Link href="/admin/users"><Button size="sm" variant="outline">Manage</Button></Link>}
                />
                <ChecklistItem
                  done={mfaOk}
                  title="Enable two-factor authentication for all admins"
                  desc={`${s?.adminsWithMfa ?? 0} of ${s?.adminCount ?? 0} admin(s) have 2FA enabled`}
                  action={<Link href="/settings/security"><Button size="sm" variant="outline"><ShieldCheck className="w-4 h-4 mr-1" />2FA</Button></Link>}
                />
                <ChecklistItem
                  done={false}
                  title="Create an API key (optional)"
                  desc="Enable programmatic access for integrations"
                  action={<Link href="/admin/api-keys"><Button size="sm" variant="outline"><KeySquare className="w-4 h-4 mr-1" />API Keys</Button></Link>}
                />
                <ChecklistItem
                  done={!!data?.setupCompleted}
                  title="Mark setup as complete"
                  desc="Dismiss the setup banner across the platform"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {!loading && (
        <FadeIn delay={0.1}>
          <div className="flex items-center gap-3">
            {!isSuperAdmin ? (
              <p className="text-xs text-muted-foreground">
                Only a Super Admin can mark setup as complete.
              </p>
            ) : data?.setupCompleted ? (
              <Button variant="outline" size="sm" onClick={() => setCompleted(false)} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                Reopen Setup
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCompleted(true)} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Mark Setup Complete
              </Button>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
