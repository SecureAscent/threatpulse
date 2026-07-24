'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Building2, Users, AlertTriangle, Calendar, Save, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
  _count?: { users?: number; threats?: number };
}

export default function OrgContent() {
  const { data: session } = useSession() || {};
  const currentRole = (session?.user as any)?.role as string | undefined;
  const isSuper = currentRole === 'SUPERADMIN';

  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);

  // SUPERADMIN-only: list of all orgs + which one is being viewed/edited.
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  // Create-org dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  // Delete confirmation dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadOrg = useCallback(async (id?: string) => {
    setLoading(true);
    try {
      const url = id ? `/api/admin/organization?id=${encodeURIComponent(id)}` : '/api/admin/organization';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOrg(data?.organization ?? null);
        setName(data?.organization?.name ?? '');
        setSlug(data?.organization?.slug ?? '');
      } else {
        toast.error('Failed to load organization');
      }
    } catch (err: any) {
      console.error('Fetch org error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrgList = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrgs(data?.organizations ?? []);
      }
    } catch (err: any) {
      console.error('Fetch organizations error:', err);
    }
  }, []);

  // Initial load. For SUPERADMIN, also pull the full org list so they can switch.
  useEffect(() => {
    if (isSuper) loadOrgList();
    loadOrg();
  }, [isSuper, loadOrgList, loadOrg]);

  const handleSelectOrg = (id: string) => {
    setSelectedId(id);
    loadOrg(id);
  };

  const handleSave = async () => {
    if (!name?.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, string> = { name };
      if (isSuper) {
        if (org?.id) payload.id = org.id;
        if (slug?.trim()) payload.slug = slug.trim();
      }
      const res = await fetch('/api/admin/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setOrg({ ...(org ?? {}), ...(data?.organization ?? {}) });
        setSlug(data?.organization?.slug ?? slug);
        toast.success('Organization updated');
        if (isSuper) loadOrgList();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName?.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, slug: newSlug || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success('Organization created');
        setCreateOpen(false);
        setNewName('');
        setNewSlug('');
        await loadOrgList();
        if (data?.organization?.id) handleSelectOrg(data.organization.id);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Failed to create');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!org?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/organization?id=${encodeURIComponent(org.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Organization deleted');
        setDeleteOpen(false);
        setSelectedId('');
        await loadOrgList();
        loadOrg(); // fall back to own org
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setDeleting(false);
    }
  };

  const isOwnOrg = org?.id && org.id === (session?.user as any)?.organizationId;

  if (loading && !org) return <div className="p-6"><div className="h-64 bg-muted animate-pulse rounded-xl" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-[800px] mx-auto">
      <FadeIn>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Organization Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isSuper
                ? 'View and manage settings for any organization on the platform'
                : 'Manage your organization details and view statistics'}
            </p>
          </div>
          {isSuper && (
            <Button variant="outline" className="gap-2 flex-shrink-0" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> New Organization
            </Button>
          )}
        </div>
      </FadeIn>

      {isSuper && (
        <FadeIn delay={0.03}>
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Active organization</Label>
              <div className="mt-2">
                <Select value={org?.id ?? selectedId} onValueChange={handleSelectOrg}>
                  <SelectTrigger className="w-full sm:w-[420px]">
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} · {o.slug} ({o._count?.users ?? 0} users)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FadeIn delay={0.05}>
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Slug</p>
                  <p className="text-sm font-mono">{org?.slug ?? '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.1}>
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Members</p>
                  <p className="text-xl font-bold">{org?._count?.users ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.15}>
          <Card className="border-border/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Threats</p>
                  <p className="text-xl font-bold">{org?._count?.threats ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <FadeIn delay={0.2}>
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Organization Details</CardTitle>
            <CardDescription>
              {isSuper ? 'Update the organization name and slug' : 'Update your organization name'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
            </div>
            {isSuper && (
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={slug}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSlug(e.target.value)}
                  className="font-mono"
                  placeholder="organization-slug"
                />
                <p className="text-xs text-muted-foreground">
                  The slug is a stable identity key (e.g. the collector&apos;s <code>COLLECTOR_ORG_SLUG</code>). Change with care.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              Created: {org?.createdAt ? new Date(org.createdAt).toLocaleDateString() : '—'}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} loading={saving} className="gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {isSuper && (
        <FadeIn delay={0.25}>
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <ShieldAlert className="w-4 h-4" /> Danger Zone
              </CardTitle>
              <CardDescription>Permanently delete this organization. This cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={!org?.id || isOwnOrg}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4" /> Delete Organization
              </Button>
              {isOwnOrg && (
                <p className="text-xs text-muted-foreground mt-2">You cannot delete the organization you belong to.</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Create organization dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Organization</DialogTitle>
            <DialogDescription>Create a new tenant organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div className="space-y-2">
              <Label>Slug (optional)</Label>
              <Input value={newSlug} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSlug(e.target.value)} className="font-mono" placeholder="auto-generated from name" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} className="gap-2">
              <Plus className="w-4 h-4" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{org?.name}</strong>? This action cannot be undone. Organizations
              that still have users or threats cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting} className="gap-2">
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
