'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Building2, Network, Plus, Users, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import type { OrganizationSummary, ParentOrganizationSummary } from '@/lib/types';

async function errorMessage(response: Response, fallback: string) {
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
  const [parents, setParents] = useState<ParentOrganizationSummary[]>([]);
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [unassigned, setUnassigned] = useState<OrganizationSummary[]>([]);
  const [parentName, setParentName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [parentId, setParentId] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [departmentOrgId, setDepartmentOrgId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch('/api/admin/orgs', { cache: 'no-store' });
    if (!response.ok) throw new Error(await errorMessage(response, 'Failed to load hierarchy'));
    const data = await response.json();
    setParents(data.parents ?? []);
    setUnassigned(data.unassignedOrganizations ?? []);
    setOrganization(data.organization ?? null);
  };

  useEffect(() => {
    if (!sessionUser) return;
    load().catch((error) => toast.error(error.message)).finally(() => setLoading(false));
  }, [sessionUser?.id]);

  const post = async (payload: Record<string, unknown>, success: string) => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await errorMessage(response, 'Operation failed'));
      await load();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const allOrganizations = parents.flatMap((parent) => parent.organizations);

  if (loading) return <div className="p-6"><div className="h-64 rounded-xl bg-muted animate-pulse" /></div>;

  if (!isSuperAdmin && organization) {
    return (
      <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
        <FadeIn>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Organization Hierarchy</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sessionUser?.parentOrganizationName ? `${sessionUser.parentOrganizationName} / ` : ''}{organization.name}
            </p>
          </div>
        </FadeIn>
        <div className="grid sm:grid-cols-3 gap-4">
          <Metric label="Departments" value={organization._count?.departments ?? organization.departments?.length ?? 0} icon={Network} />
          <Metric label="Members" value={organization._count?.users ?? 0} icon={Users} />
          <Metric label="Threats" value={organization._count?.threats ?? 0} icon={AlertTriangle} />
        </div>
        <DepartmentPanel organization={organization} />
        <Card>
          <CardHeader><CardTitle className="text-base">Add Department</CardTitle><CardDescription>Departments are scoped to {organization.name}.</CardDescription></CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="Threat Intelligence" />
            <Button disabled={saving || !departmentName.trim()} onClick={async () => {
              await post({ action: 'createDepartment', name: departmentName }, 'Department created');
              setDepartmentName('');
            }}><Plus className="w-4 h-4 mr-2" />Add</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Organization Hierarchy</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage parent organizations, organizations, and departments.</p>
        </div>
      </FadeIn>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">1. Parent Organization</CardTitle><CardDescription>Top-level customer, holding company, or enterprise.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Label>Parent Name</Label>
            <Input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Acme Holdings" />
            <Button className="w-full" disabled={saving || !parentName.trim()} onClick={async () => {
              await post({ action: 'createParent', name: parentName }, 'Parent organization created');
              setParentName('');
            }}><Plus className="w-4 h-4 mr-2" />Create Parent</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. Organization</CardTitle><CardDescription>Create an organization under a parent.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Label>Parent</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Select parent</option>
              {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
            </select>
            <Label>Organization Name</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Security" />
            <Button className="w-full" disabled={saving || !parentId || !orgName.trim()} onClick={async () => {
              await post({ action: 'createOrg', name: orgName, parentOrganizationId: parentId }, 'Organization created with General department');
              setOrgName('');
            }}><Plus className="w-4 h-4 mr-2" />Create Organization</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">3. Department</CardTitle><CardDescription>Create a department inside an organization.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Label>Organization</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={departmentOrgId} onChange={(e) => setDepartmentOrgId(e.target.value)}>
              <option value="">Select organization</option>
              {parents.map((parent) => (
                <optgroup key={parent.id} label={parent.name}>
                  {parent.organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </optgroup>
              ))}
            </select>
            <Label>Department Name</Label>
            <Input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="Threat Intelligence" />
            <Button className="w-full" disabled={saving || !departmentOrgId || !departmentName.trim()} onClick={async () => {
              await post({ action: 'createDepartment', organizationId: departmentOrgId, name: departmentName }, 'Department created');
              setDepartmentName('');
            }}><Plus className="w-4 h-4 mr-2" />Create Department</Button>
          </CardContent>
        </Card>
      </div>

      {unassigned.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader><CardTitle className="text-base">Existing Organizations Need a Parent</CardTitle><CardDescription>{unassigned.length} pre-hierarchy organization(s) remain operational but should be migrated.</CardDescription></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Deploy the schema first, then use the migration command included in the deployment steps to attach these organizations and create their General departments.</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {parents.map((parent) => (
          <Card key={parent.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" />{parent.name}</CardTitle>
              <CardDescription className="font-mono">{parent.slug}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {parent.organizations.map((org) => <DepartmentPanel key={org.id} organization={org} />)}
              {parent.organizations.length === 0 && <p className="text-sm text-muted-foreground">No organizations under this parent.</p>}
            </CardContent>
          </Card>
        ))}
        {parents.length === 0 && <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Create the first parent organization to begin.</CardContent></Card>}
      </div>
    </div>
  );
}

function DepartmentPanel({ organization }: { organization: OrganizationSummary }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="font-semibold">{organization.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{organization.slug}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          {organization._count?.users ?? 0} members · {organization._count?.threats ?? 0} threats
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {(organization.departments ?? []).map((department) => (
          <div key={department.id} className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium">{department.name}</p>
            <p className="text-xs text-muted-foreground">{department._count?.users ?? 0} members · {department._count?.threats ?? 0} threats</p>
          </div>
        ))}
        {(organization.departments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No departments.</p>}
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Building2 }) {
  return (
    <Card><CardContent className="pt-5 pb-4 flex items-center gap-3"><Icon className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div></CardContent></Card>
  );
}
