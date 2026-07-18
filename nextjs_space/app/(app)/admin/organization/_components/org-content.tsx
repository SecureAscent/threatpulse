'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Users, AlertTriangle, Calendar, Save, Plus } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import type { OrganizationSummary } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data?.message || data?.error || fallback;
  } catch {
    return fallback;
  }
}

export default function OrgContent() {
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const isSuperAdmin = sessionUser?.role === 'SUPERADMIN';

  const [org, setOrg] = useState<any>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchOrganizations = async () => {
    const response = await fetch('/api/admin/orgs', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, 'Failed to load organizations'));
    }
    const data = await response.json();
    setOrganizations(data?.organizations ?? []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        if (isSuperAdmin) {
          await fetchOrganizations();
        } else if (sessionUser) {
          const response = await fetch('/api/admin/organization', { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(await getErrorMessage(response, 'Failed to load organization'));
          }
          const data = await response.json();
          setOrg(data?.organization ?? null);
          setName(data?.organization?.name ?? '');
        }
      } catch (error) {
        console.error('Fetch organization error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load organization');
      } finally {
        if (sessionUser) setLoading(false);
      }
    };

    load();
  }, [isSuperAdmin, sessionUser?.id]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        toast.error(await getErrorMessage(response, 'Failed to update organization'));
        return;
      }

      const data = await response.json();
      setOrg({ ...(org ?? {}), ...(data?.organization ?? {}) });
      toast.success('Organization updated');
    } catch {
      toast.error('Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) {
      toast.error('Organization name is required');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/admin/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createOrg',
          name: newName.trim(),
        }),
      });

      if (!response.ok) {
        toast.error(await getErrorMessage(response, 'Failed to create organization'));
        return;
      }

      const data = await response.json();
      setOrganizations((current) => [...current, data.organization].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setCreateOpen(false);
      toast.success('Organization created');
    } catch (error) {
      console.error('Create organization error:', error);
      toast.error('Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="p-6"><div className="h-64 bg-muted animate-pulse rounded-xl" /></div>;
  }

  if (isSuperAdmin) {
    const totalUsers = organizations.reduce((sum, organization) => sum + (organization._count?.users ?? 0), 0);
    const totalThreats = organizations.reduce((sum, organization) => sum + (organization._count?.threats ?? 0), 0);

    return (
      <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
        <FadeIn>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Organizations</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage tenants and review platform-wide membership</p>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="w-4 h-4" /> Add Organization</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px]">
                <form onSubmit={handleCreateOrganization}>
                  <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>
                      Enter the organization name. ThreatPulse will generate its internal identifier automatically.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        placeholder="Acme Security"
                        maxLength={120}
                        autoFocus
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Organization'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Organizations" value={organizations.length} icon={Building2} />
          <MetricCard label="Members" value={totalUsers} icon={Users} />
          <MetricCard label="Threats" value={totalThreats} icon={AlertTriangle} />
        </div>

        <FadeIn delay={0.15}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {organizations.map((organization) => (
              <Card key={organization.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    {organization.name}
                  </CardTitle>
                  <CardDescription className="font-mono">{organization.slug}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Members</p>
                    <p className="text-lg font-semibold">{organization._count?.users ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Threats</p>
                    <p className="text-lg font-semibold">{organization._count?.threats ?? 0}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {organizations.length === 0 && (
            <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">No organizations found.</CardContent></Card>
          )}
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[800px] mx-auto">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Organization Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your organization details and view statistics</p>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Slug" value={org?.slug ?? '—'} icon={Building2} monospace />
        <MetricCard label="Members" value={org?._count?.users ?? 0} icon={Users} />
        <MetricCard label="Threats" value={org?._count?.threats ?? 0} icon={AlertTriangle} />
      </div>

      <FadeIn delay={0.2}>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Organization Details</CardTitle>
            <CardDescription>Update your organization name</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              Created: {org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : '—'}
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, monospace = false }: {
  label: string;
  value: string | number;
  icon: typeof Building2;
  monospace?: boolean;
}) {
  return (
    <FadeIn delay={0.05}>
      <Card className="border-border/50">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={monospace ? 'text-sm font-mono' : 'text-xl font-bold'}>{value}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
