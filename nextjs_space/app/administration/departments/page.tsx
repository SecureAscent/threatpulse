'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Edit3, Loader2, Plus, RefreshCw, Search, ShieldCheck, Trash2, Users } from 'lucide-react';

type Organization = { id: string; name: string; slug: string; archivedAt: string | null };
type Department = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  organization: { id: string; name: string; slug: string };
  _count: { users: number; assets: number; threats: number };
};

type DepartmentForm = { organizationId: string; name: string; slug: string };
const emptyForm: DepartmentForm = { organizationId: '', name: '', slug: '' };

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed with status ${response.status}`);
  return payload;
}

export default function DepartmentsAdministrationPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<DepartmentForm>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);

  const loadOrganizations = useCallback(async () => {
    const response = await fetch('/api/organizations?pageSize=100', { cache: 'no-store' });
    const payload = await readJson(response);
    const active = (payload.organizations || []).filter((item: Organization) => !item.archivedAt);
    setOrganizations(active);
    if (!organizationId && active.length === 1) setOrganizationId(active[0].id);
  }, [organizationId]);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (organizationId) params.set('organizationId', organizationId);
      if (search) params.set('search', search);
      const response = await fetch(`/api/departments?${params.toString()}`, { cache: 'no-store' });
      const payload = await readJson(response);
      setDepartments(payload.departments || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load departments.');
    } finally {
      setLoading(false);
    }
  }, [organizationId, search]);

  useEffect(() => {
    void loadOrganizations().catch((requestError) => {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load organizations.');
    });
  }, [loadOrganizations]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  const totals = useMemo(
    () => departments.reduce(
      (summary, department) => ({
        users: summary.users + department._count.users,
        assets: summary.assets + department._count.assets,
        threats: summary.threats + department._count.threats,
      }),
      { users: 0, assets: 0, threats: 0 },
    ),
    [departments],
  );

  function openCreateDialog() {
    setEditing(null);
    setForm({ ...emptyForm, organizationId: organizationId || organizations[0]?.id || '' });
    setSlugTouched(false);
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(department: Department) {
    setEditing(department);
    setForm({ organizationId: department.organizationId, name: department.name, slug: department.slug });
    setSlugTouched(true);
    setError(null);
    setDialogOpen(true);
  }

  function updateName(name: string) {
    setForm((current) => ({ ...current, name, slug: slugTouched ? current.slug : slugify(name) }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(editing ? `/api/departments/${editing.id}` : '/api/departments', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      await readJson(response);
      setDialogOpen(false);
      setNotice(editing ? 'Department updated.' : 'Department created.');
      if (!editing && form.organizationId) setOrganizationId(form.organizationId);
      await loadDepartments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save department.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDepartment(department: Department) {
    if (!window.confirm(`Delete ${department.name}? This is only allowed when no users, assets, or threats are assigned.`)) return;
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/departments/${department.id}`, { method: 'DELETE' });
      await readJson(response);
      setNotice(`${department.name} was deleted.`);
      await loadDepartments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete department.');
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-300">
              <ShieldCheck className="h-4 w-4" /> Administration
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Departments</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Manage organizational subdivisions and review their assigned users, assets, and threats.</p>
          </div>
          <button type="button" onClick={openCreateDialog} disabled={organizations.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" /> New department
          </button>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Departments', departments.length],
            ['Users', totals.users],
            ['Assets', totals.assets],
            ['Threats', totals.threats],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        {(error || notice) && (
          <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-900/70 bg-red-950/50 text-red-200' : 'border-emerald-900/70 bg-emerald-950/40 text-emerald-200'}`}>
            {error || notice}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-cyan-500">
                <option value="">All organizations</option>
                {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
              </select>
              <form onSubmit={submitSearch} className="flex w-full max-w-xl gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name or slug" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-500" />
                </div>
                <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800">Search</button>
              </form>
            </div>
            <button type="button" onClick={() => void loadDepartments()} disabled={loading} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50" aria-label="Refresh departments">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Department</th>
                  <th className="px-5 py-3 font-medium">Organization</th>
                  <th className="px-5 py-3 font-medium">Users</th>
                  <th className="px-5 py-3 font-medium">Assets</th>
                  <th className="px-5 py-3 font-medium">Threats</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-400"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan-400" />Loading departments…</td></tr>
                ) : departments.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-400"><Building2 className="mx-auto mb-3 h-8 w-8 text-slate-600" />No departments match the current filters.</td></tr>
                ) : departments.map((department) => (
                  <tr key={department.id} className="transition hover:bg-slate-800/40">
                    <td className="px-5 py-4"><div className="font-medium">{department.name}</div><div className="mt-1 font-mono text-xs text-slate-500">{department.slug}</div></td>
                    <td className="px-5 py-4 text-slate-300">{department.organization.name}</td>
                    <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-500" />{department._count.users}</span></td>
                    <td className="px-5 py-4 text-slate-300">{department._count.assets}</td>
                    <td className="px-5 py-4 text-slate-300">{department._count.threats}</td>
                    <td className="px-5 py-4"><div className="flex justify-end gap-2">
                      <button onClick={() => openEditDialog(department)} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label={`Edit ${department.name}`}><Edit3 className="h-4 w-4" /></button>
                      <button onClick={() => void deleteDepartment(department)} className="rounded-lg border border-red-900/70 p-2 text-red-300 hover:bg-red-950/60" aria-label={`Delete ${department.name}`}><Trash2 className="h-4 w-4" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <h2 className="font-display text-xl font-semibold">{editing ? 'Edit department' : 'Create department'}</h2>
            <form onSubmit={submitForm} className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300">Organization
                <select value={form.organizationId} disabled={Boolean(editing)} onChange={(event) => setForm((current) => ({ ...current, organizationId: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-500" required>
                  <option value="">Select organization</option>
                  {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              </label>
              <label className="block text-sm text-slate-300">Name
                <input value={form.name} onChange={(event) => updateName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-cyan-500" required maxLength={120} />
              </label>
              <label className="block text-sm text-slate-300">Slug
                <input value={form.slug} onChange={(event) => { setSlugTouched(true); setForm((current) => ({ ...current, slug: slugify(event.target.value) })); }} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono outline-none focus:border-cyan-500" required maxLength={63} />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setDialogOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Cancel</button>
                <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? 'Save changes' : 'Create department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
