'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FadeIn } from '@/components/ui/animate';
import { KeySquare, Plus, Trash2, Copy, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const AVAILABLE_SCOPES: { id: string; label: string }[] = [
  { id: 'threats.read', label: 'Read threats' },
  { id: 'threats.manage', label: 'Manage threats' },
  { id: 'assets.read', label: 'Read assets' },
  { id: 'assets.manage', label: 'Manage assets' },
];

type ApiKey = {
  id: string; name: string; keyPrefix: string; scopes: string[];
  lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null;
  createdAt: string; status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
};

function StatusBadge({ status }: { status: ApiKey['status'] }) {
  if (status === 'ACTIVE') return <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">Active</Badge>;
  if (status === 'EXPIRED') return <Badge variant="outline" className="text-amber-500 border-amber-500/30">Expired</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Revoked</Badge>;
}

export default function ApiKeysContent() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/api-keys');
      if (res.ok) { const d = await res.json(); setKeys(d?.keys ?? []); }
      else toast.error('Failed to load API keys');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleScope = (id: string) =>
    setScopes((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const resetForm = () => { setName(''); setScopes([]); setExpiresInDays(''); };

  const create = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (scopes.length === 0) { toast.error('Select at least one scope'); return; }
    setBusy(true);
    try {
      const body: any = { name: name.trim(), scopes };
      if (expiresInDays) body.expiresInDays = Number(expiresInDays);
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setNewKey(data.fullKey);
        setCreateOpen(false);
        resetForm();
        load();
      } else toast.error(data?.error || 'Failed to create key');
    } finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('API key revoked'); load(); }
      else toast.error('Failed to revoke key');
    } finally { setBusy(false); }
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard?.writeText(newKey);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">API Keys</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Programmatic access tokens for the ThreatPulse API. Authenticate with
              <code className="mx-1 px-1 py-0.5 rounded bg-muted text-xs">Authorization: Bearer &lt;key&gt;</code>
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Key
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <KeySquare className="w-4 h-4 text-muted-foreground" /> Keys ({keys.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-6">
                {[1, 2].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-12">
                <KeySquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No API keys yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell className="font-mono text-xs">{k.keyPrefix}…</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell><StatusBadge status={k.status} /></TableCell>
                      <TableCell>
                        {k.status !== 'REVOKED' && (
                          <Button size="icon" variant="ghost" onClick={() => revoke(k.id)} disabled={busy}
                            aria-label="Revoke key">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>Grant scoped, programmatic access to the ThreatPulse API.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Name</Label>
              <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SIEM integration" />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SCOPES.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={scopes.includes(s.id)} onCheckedChange={() => toggleScope(s.id)} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key-exp">Expires in (days, optional)</Label>
              <Input id="key-exp" type="number" min={1} value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)} placeholder="Leave blank for no expiry" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show-once new key dialog */}
      <Dialog open={!!newKey} onOpenChange={(o) => { if (!o) setNewKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" /> API Key Created
            </DialogTitle>
          </DialogHeader>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Copy your key now</AlertTitle>
            <AlertDescription>
              This is the only time the full key will be shown. Store it securely — you cannot retrieve it later.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-xs break-all">{newKey}</code>
            <Button size="icon" variant="outline" onClick={copyKey} aria-label="Copy key">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
