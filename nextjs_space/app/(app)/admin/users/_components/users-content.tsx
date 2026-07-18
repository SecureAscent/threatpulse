'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Shield, Trash2, User, UserPlus, Users } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import type { OrganizationSummary, OrgUser } from '@/lib/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [submitting, setSubmitting] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      if (!response.ok) {
        toast.error(await getErrorMessage(response, 'Failed to load users'));
        return;
      }
      const data = await response.json();
      setUsers(data?.users ?? []);
    } catch (error) {
      console.error('Fetch users error:', error);
      toast.error('Failed to load users');
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/admin/orgs', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const nextOrganizations = data?.organizations ?? [];
      setOrganizations(nextOrganizations);

      if (!newOrganizationId && nextOrganizations.length === 1) {
        setNewOrganizationId(nextOrganizations[0].id);
      }
    } catch (error) {
      console.error('Fetch organizations error:', error);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchOrganizations()]);
      setLoading(false);
    };
    load();
  }, []);

  const replaceUser = (updated: OrgUser) => {
    setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
  };

  const updateRole = async (userId: string, role: string) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });

      if (!response.ok) {
        toast.error(await getErrorMessage(response, 'Failed to update role'));
        return;
      }

      const data = await response.json();
      replaceUser(data.user);
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const updateOrganization = async (userId: string, organizationId: string) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, organizationId }),
      });

      if (!response.ok) {
        toast.error(await getErrorMessage(response, 'Failed to assign organization'));
        return;
      }

      const data = await response.json();
      replaceUser(data.user);
      toast.success('Organization assignment updated');
    } catch {
      toast.error('Failed to assign organization');
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

    if (isSuperAdmin && !newOrganizationId) {
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
          ...(isSuperAdmin ? { organizationId: newOrganizationId } : {}),
        }),
      });

      if (!response.ok) {
        toast.error(await getErrorMessage(response, 'Failed to add user'));
        return;
      }

      const data = await response.json();
      setUsers((current) => [data.user, ...current]);
      setOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('ANALYST');
      if (!isSuperAdmin && organizations.length === 1) {
        setNewOrganizationId(organizations[0].id);
      }
      toast.success('User added successfully');
    } catch {
      toast.error('Error adding user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    setUpdatingUserId(userId);
    try {
      const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        toast.error(await getErrorMessage(response, 'Failed to delete user'));
        return;
      }

      setUsers((current) => current.filter((user) => user.id !== userId));
      toast.success('User deleted successfully');
    } catch {
      toast.error('Error deleting user');
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
      <FadeIn>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">User Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage members, roles, and organization assignments
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 self-start sm:self-auto">
                <UserPlus className="w-4 h-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px]">
              <form onSubmit={handleAddUser}>
                <DialogHeader>
                  <DialogTitle>Add New Member</DialogTitle>
                  <DialogDescription>
                    Create a user and assign their initial role and organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Jane Doe"
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="jane@example.com"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Temporary Password</Label>
                    <Input
                      id="password"
                      type="password"
                      minLength={8}
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="ANALYST">Analyst</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isSuperAdmin && (
                    <div className="grid gap-2">
                      <Label htmlFor="organization">Organization</Label>
                      <Select value={newOrganizationId} onValueChange={setNewOrganizationId}>
                        <SelectTrigger id="organization">
                          <SelectValue placeholder="Select an organization" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((organization) => (
                            <SelectItem key={organization.id} value={organization.id}>
                              {organization.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Save Member'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Members ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="space-y-2 p-6">
                {[1, 2, 3].map((item) => <div key={item} className="h-12 bg-muted animate-pulse rounded" />)}
              </div>
            ) : users.length === 0 ? (
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
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[220px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isUpdating = updatingUserId === user.id;
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                              {user.role === 'ADMIN'
                                ? <Shield className="w-3.5 h-3.5 text-primary" />
                                : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                            {user.name ?? 'Unknown'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          {isSuperAdmin ? (
                            <Select
                              value={user.organizationId ?? ''}
                              onValueChange={(value) => updateOrganization(user.id, value)}
                              disabled={isUpdating}
                            >
                              <SelectTrigger className="h-8 min-w-[160px]">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                {organizations.map((organization) => (
                                  <SelectItem key={organization.id} value={organization.id}>
                                    {organization.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{user.organization?.name ?? 'Unassigned'}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={user.role === 'ADMIN' ? 'bg-primary/10 text-primary border-primary/20 text-[10px]' : 'text-[10px]'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Select
                              value={user.role}
                              onValueChange={(value) => updateRole(user.id, value)}
                              disabled={isUpdating}
                            >
                              <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="ANALYST">Analyst</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={isUpdating || user.id === sessionUser?.id}
                              aria-label={`Delete ${user.name ?? user.email}`}
                            >
                              <Trash2 className="w-4 h-4" />
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
    </div>
  );
}
