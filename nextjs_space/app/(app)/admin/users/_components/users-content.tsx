'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Building2, Network, Shield, Trash2, User, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FadeIn } from '@/components/ui/animate';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { OrganizationSummary, OrgUser } from '@/lib/types';

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    return data?.message || data?.error || fallback;
  } catch {
    return fallback;
  }
}

export default function UsersContent() {
  const { data: session } = useSession();
  const sessionUser = session?.user as any;
  const isSuperAdmin = sessionUser?.role === 'SUPERADMIN';

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('ANALYST');
  const [newOrganizationId, setNewOrganizationId] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const effectiveNewOrganizationId = isSuperAdmin
    ? newOrganizationId
    : (sessionUser?.organizationId ?? organizations[0]?.id ?? '');

  const newUserDepartments = useMemo(
    () => organizations.find((organization) => organization.id === effectiveNewOrganizationId)?.departments ?? [],
    [organizations, effectiveNewOrganizationId],
  );

  const fetchUsers = async () => {
    const response = await fetch('/api/admin/users', { cache: 'no-store' });
    if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to load users'));
    const data = await response.json();
    setUsers(data?.users ?? []);
  };

  const fetchOrganizations = async () => {
    const response = await fetch('/api/admin/orgs', { cache: 'no-store' });
    if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to load organizations'));
    const data = await response.json();
    const nextOrganizations: OrganizationSummary[] = data?.organizations ?? [];
    setOrganizations(nextOrganizations);
    if (!newOrganizationId && nextOrganizations.length === 1) {
      setNewOrganizationId(nextOrganizations[0].id);
    }
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchOrganizations()])
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load user management'))
      .finally(() => setLoading(false));
  }, []);

  const replaceUser = (updated: OrgUser) => {
    setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
  };

  const patchUser = async (userId: string, changes: Record<string, unknown>, success: string) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...changes }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to update user'));
      const data = await response.json();
      replaceUser(data.user);
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!effectiveNewOrganizationId) {
      toast.error('Select an organization');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          ...(isSuperAdmin ? { organizationId: effectiveNewOrganizationId } : {}),
          departmentId: newDepartmentId || null,
        }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to add user'));
      const data = await response.json();
      setUsers((current) => [data.user, ...current]);
      setOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('ANALYST');
      setNewDepartmentId('');
      toast.success('User added successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setUpdatingUserId(userId);
    try {
      const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Failed to delete user'));
      setUsers((current) => current.filter((user) => user.id !== userId));
      toast.success('User deleted successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1250px] mx-auto">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">User Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage members, roles, organizations, and departments.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><UserPlus className="w-4 h-4" />Add User</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <form onSubmit={handleAddUser}>
                <DialogHeader>
                  <DialogTitle>Add New Member</DialogTitle>
                  <DialogDescription>Create a user and assign their role, organization, and department.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2"><Label htmlFor="name">Full Name</Label><Input id="name" value={newName} onChange={(event) => setNewName(event.target.value)} required /></div>
                  <div className="grid gap-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required /></div>
                  <div className="grid gap-2"><Label htmlFor="password">Temporary Password</Label><Input id="password" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></div>
                  <div className="grid gap-2">
                    <Label>Role</Label>
                    <Select value={newRole} onValueChange={setNewRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="ANALYST">Analyst</SelectItem></SelectContent></Select>
                  </div>
                  {isSuperAdmin && (
                    <div className="grid gap-2">
                      <Label>Organization</Label>
                      <Select value={newOrganizationId} onValueChange={(value) => { setNewOrganizationId(value); setNewDepartmentId(''); }}>
                        <SelectTrigger><SelectValue placeholder="Select an organization" /></SelectTrigger>
                        <SelectContent>{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label>Department</Label>
                    <Select value={newDepartmentId || 'none'} onValueChange={(value) => setNewDepartmentId(value === 'none' ? '' : value)} disabled={!effectiveNewOrganizationId}>
                      <SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Organization-wide / Unassigned</SelectItem>
                        {newUserDepartments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Save Member'}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-muted-foreground" />Members ({users.length})</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? <div className="p-6 text-sm text-muted-foreground">Loading users...</div> : users.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No users found.</div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Organization</TableHead><TableHead>Department</TableHead><TableHead>Role</TableHead><TableHead className="w-[190px]">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isUpdating = updatingUserId === user.id;
                    const userOrganization = organizations.find((organization) => organization.id === user.organizationId);
                    const departments = userOrganization?.departments ?? [];
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium"><div className="flex items-center gap-2">{user.role === 'ADMIN' ? <Shield className="w-4 h-4 text-primary" /> : <User className="w-4 h-4" />}{user.name ?? 'Unknown'}</div></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          {isSuperAdmin ? (
                            <Select value={user.organizationId ?? ''} onValueChange={(value) => patchUser(user.id, { organizationId: value, departmentId: null }, 'Organization updated')} disabled={isUpdating}>
                              <SelectTrigger className="h-8 min-w-[165px]"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                              <SelectContent>{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : <div className="flex items-center gap-2 text-sm"><Building2 className="w-3.5 h-3.5" />{user.organization?.name ?? 'Unassigned'}</div>}
                        </TableCell>
                        <TableCell>
                          <Select value={user.departmentId ?? 'none'} onValueChange={(value) => patchUser(user.id, { departmentId: value === 'none' ? null : value }, 'Department updated')} disabled={isUpdating || !user.organizationId}>
                            <SelectTrigger className="h-8 min-w-[165px]"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                            <SelectContent><SelectItem value="none">Organization-wide / Unassigned</SelectItem>{departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select value={user.role} onValueChange={(value) => patchUser(user.id, { role: value }, 'Role updated')} disabled={isUpdating}><SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="ANALYST">Analyst</SelectItem></SelectContent></Select>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteUser(user.id)} disabled={isUpdating || user.id === sessionUser?.id}><Trash2 className="w-4 h-4" /></Button>
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
    </div>
  );
}
