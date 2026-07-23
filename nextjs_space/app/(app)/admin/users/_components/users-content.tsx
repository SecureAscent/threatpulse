'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Users, Shield, User, UserPlus, Trash2, Loader2, Building2 } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import type { OrgUser, AdminOrganization } from '@/lib/types';
import { toast } from 'sonner';

const ROLES = ['VIEWER', 'ANALYST', 'DEPARTMENT_ADMIN', 'ADMIN', 'PARENT_ADMIN', 'SUPERADMIN'];
const roleLabel = (r: string) =>
  (r ?? '').split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

const ALL_ORGS = '__all__';

export default function UsersContent() {
  const { data: session } = useSession() || {};
  const currentUserId = (session?.user as any)?.id as string | undefined;
  const currentRole = (session?.user as any)?.role as string | undefined;
  const isSuper = currentRole === 'SUPERADMIN';

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);

  // SUPERADMIN-only: organization list + active org filter
  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [orgFilter, setOrgFilter] = useState<string>(ALL_ORGS);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'ANALYST', organizationId: '' });

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async (orgId?: string) => {
    try {
      const url = isSuper && orgId && orgId !== ALL_ORGS
        ? `/api/admin/users?organizationId=${encodeURIComponent(orgId)}`
        : '/api/admin/users';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data?.users ?? []);
      }
    } catch (err: any) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgs = async () => {
    try {
      const res = await fetch('/api/admin/organizations');
      if (res.ok) {
        const data = await res.json();
        setOrgs(data?.organizations ?? []);
      }
    } catch (err: any) {
      console.error('Fetch organizations error:', err);
    }
  };

  useEffect(() => {
    fetchUsers(orgFilter);
    if (isSuper) fetchOrgs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper]);

  const onOrgFilterChange = (v: string) => {
    setOrgFilter(v);
    setLoading(true);
    fetchUsers(v);
  };

  const updateRole = async (userId: string, role: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        setUsers((prev: OrgUser[]) => (prev ?? []).map((u: OrgUser) => u?.id === userId ? { ...(u ?? {}), role } : u));
        toast.success('Role updated');
      } else {
        toast.error('Failed to update role');
      }
    } catch {
      toast.error('Failed');
    }
  };

  const openAddDialog = () => {
    // Pre-select an org for superadmins: the active filter, else the first org.
    const preOrg = isSuper
      ? (orgFilter !== ALL_ORGS ? orgFilter : (orgs[0]?.id ?? ''))
      : '';
    setForm({ name: '', email: '', password: '', role: 'ANALYST', organizationId: preOrg });
    setAddOpen(true);
  };

  const addUser = async () => {
    if (!form.email || !form.password) {
      toast.error('Email and password are required');
      return;
    }
    if (isSuper && !form.organizationId) {
      toast.error('Please select an organization');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      };
      if (isSuper && form.organizationId) payload.organizationId = form.organizationId;

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('User added');
        setAddOpen(false);
        setForm({ name: '', email: '', password: '', role: 'ANALYST', organizationId: '' });
        await fetchUsers(orgFilter);
      } else {
        toast.error(data?.error ?? 'Failed to add user');
      }
    } catch {
      toast.error('Failed to add user');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (userId: string, name?: string | null) => {
    if (!confirm(`Remove ${name || 'this user'}? This cannot be undone.`)) return;
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsers((prev: OrgUser[]) => (prev ?? []).filter((u: OrgUser) => u?.id !== userId));
        toast.success('User removed');
      } else {
        toast.error(data?.error ?? 'Failed to remove user');
      }
    } catch {
      toast.error('Failed to remove user');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={`p-6 space-y-6 mx-auto ${isSuper ? 'max-w-[1100px]' : 'max-w-[900px]'}`}>
      <FadeIn>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuper
              ? 'Manage members and roles across all organizations'
              : 'View and manage organization members and their roles'}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Members ({users?.length ?? 0})
            </CardTitle>
            <div className="flex items-center gap-2">
              {isSuper && (
                <Select value={orgFilter} onValueChange={onOrgFilterChange}>
                  <SelectTrigger className="h-8 text-xs w-[200px]">
                    <Building2 className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="All organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_ORGS}>All organizations</SelectItem>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}{typeof o._count?.users === 'number' ? ` (${o._count.users})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" className="h-8 gap-1.5" onClick={openAddDialog}>
                <UserPlus className="w-3.5 h-3.5" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-6">
                {[1,2,3].map((i: number) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
              </div>
            ) : (users?.length ?? 0) === 0 ? (
              <div className="text-center py-12">
                <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No users found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    {isSuper && <TableHead>Organization</TableHead>}
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[200px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).map((u: OrgUser) => {
                    const isSelf = !!currentUserId && u?.id === currentUserId;
                    return (
                    <TableRow key={u?.id}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                            {u?.role === 'ADMIN' ? <Shield className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                          {u?.name ?? 'Unknown'}
                          {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u?.email ?? ''}</TableCell>
                      {isSuper && (
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                            {u?.organization?.name ?? '—'}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className={u?.role === 'ADMIN' ? 'bg-primary/10 text-primary border-primary/20 text-[10px]' : 'text-[10px]'}>
                          {roleLabel(u?.role ?? 'ANALYST')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u?.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select value={u?.role ?? 'ANALYST'} onValueChange={(v: string) => updateRole(u?.id ?? '', v)}>
                            <SelectTrigger className="h-7 text-xs w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={isSelf || deletingId === u?.id}
                            title={isSelf ? 'You cannot remove your own account' : 'Remove user'}
                            onClick={() => removeUser(u?.id ?? '', u?.name)}
                          >
                            {deletingId === u?.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              {isSuper
                ? 'Create a new member in the selected organization.'
                : 'Create a new member in your organization.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isSuper && (
              <div className="space-y-1.5">
                <Label htmlFor="add-org">Organization</Label>
                <Select value={form.organizationId} onValueChange={(v: string) => setForm((f) => ({ ...f, organizationId: v }))}>
                  <SelectTrigger id="add-org"><SelectValue placeholder="Select an organization" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Name</Label>
              <Input
                id="add-name"
                value={form.name}
                placeholder="Jane Analyst"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={form.email}
                placeholder="jane@company.com"
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-password">Password</Label>
              <Input
                id="add-password"
                type="password"
                value={form.password}
                placeholder="••••••••"
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-role">Role</Label>
              <Select value={form.role} onValueChange={(v: string) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger id="add-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={addUser} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
