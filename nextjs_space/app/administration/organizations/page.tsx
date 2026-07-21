'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Building2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';

type Organization = {
  id: string;
  parentOrganizationId: string | null;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    departments: number;
    assets: number;
    threats: number;
  };
};

type OrganizationResponse = {
  organizations: Organization[];
  page: number;
  pageSize: number;
  total: number;
  error?: string;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  timezone: string;
};

const emptyForm: FormState = {
  name: '',
  slug: '',
  description: '',
  timezone: 'UTC',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }
  return payload;
}

export default function OrganizationsAdministrationPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        includeArchived: String(includeArchived),
      });
      if (search) params.set('search', search);
      const response = await fetch(`/api/organizations?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = (await readJson(response)) as OrganizationResponse;
      setOrganizations(payload.organizations || []);
      setTotal(payload.total || 0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load organizations.');
    } finally {
      setLoading(false);
    }
  }, [includeArchived, page, pageSize, search]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const stats = useMemo(
    () =>
      organizations.reduce(
        (summary, organization) => ({
          users: summary.users + (organization._count?.users || 0),
          departments: summary.departments + (organization._count?.departments || 0),
          assets: summary.assets + (organization._count?.assets || 0),
          threats: summary.threats + (organization._count?.threats || 0),
        }),
        { users: 0, departments: 0, assets: 0, threats: 0 },
      ),
    [organizations],
  );

  function openCreateDialog() {
    setEditing(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setError(null);
    setDialogOpen(true);
  }

  function openEditDialog(organization: Organization) {
    setEditing(organization);
    setForm({
      name: organization.name,
      slug: organization.slug,
      description: organization.description || '',
      timezone: organization.timezone,
    });
    setSlugTouched(true);
    setError(null);
    setDialogOpen(true);
  }

  function updateName(name: string) {
    setForm((current) => ({
      ...current,
      name,
      slug: slugTouched ? current.slug : slugify(name),
    }));
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        editing ? `/api/organizations/${editing.id}` : '/api/organizations',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      await readJson(response);
      setDialogOpen(false);
      setNotice(editing ? 'Organization updated.' : 'Organization created.');
      await loadOrganizations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save organization.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveOrganization(organization: Organization) {
    if (organization.archivedAt) return;
    const confirmed = window.confirm(
      `Archive ${organization.name}? Existing tenant data will be retained but the organization will be hidden from active lists.`,
    );
    if (!confirmed) return;

    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/organizations/${organization.id}`, { method: 'DELETE' });
      await readJson(response);
      setNotice(`${organization.name} was archived.`);
      await loadOrganizations();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to archive organization.');
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-300">
              <ShieldCheck className="h-4 w-4" />
              Administration
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Organizations</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Manage tenant boundaries, organization identity, time zones, and lifecycle state.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          >
            <Plus className="h-4 w-4" />
            New organization
          </button>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Organizations', total],
            ['Users on page', stats.users],
            ['Departments on page', stats.departments],
            ['Assets on page', stats.assets],
            ['Threats on page', stats.threats],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
            </div>
          ))}
        </section>

        {(error || notice) && (
          <div
            className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
              error
                ? 'border-red-900/70 bg-red-950/50 text-red-200'
                : 'border-emerald-900/70 bg-emerald-950/40 text-emerald-200'
            }`}
          >
            {error || notice}
          </div>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/10">
          <div className="flex flex-col gap-4 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
            <form onSubmit={submitSearch} className="flex w-full max-w-xl gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name or slug"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800">
                Search
              </button>
            </form>

            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(event) => {
                    setPage(1);
                    setIncludeArchived(event.target.checked);
                  }}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                Include archived
              </label>
              <button
                type="button"
                onClick={() => void loadOrganizations()}
                disabled={loading}
                className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50"
                aria-label="Refresh organizations"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Organization</th>
                  <th className="px-5 py-3 font-medium">Users</th>
                  <th className="px-5 py-3 font-medium">Departments</th>
                  <th className="px-5 py-3 font-medium">Assets</th>
                  <th className="px-5 py-3 font-medium">Threats</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-slate-400">
                      <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan-400" />
                      Loading organizations…
                    </td>
                  </tr>
                ) : organizations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-slate-400">
                      <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                      No organizations match the current filters.
                    </td>
                  </tr>
                ) : (
                  organizations.map((organization) => (
                    <tr key={organization.id} className="transition hover:bg-slate-800/40">
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-100">{organization.name}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">{organization.slug}</div>
                        {organization.description && (
                          <div className="mt-1 max-w-md truncate text-xs text-slate-500">
                            {organization.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-300">{organization._count?.users || 0}</td>
                      <td className="px-5 py-4 text-slate-300">{organization._count?.departments || 0}</td>
                      <td className="px-5 py-4 text-slate-300">{organization._count?.assets || 0}</td>
                      <td className="px-5 py-4 text-slate-300">{organization._count?.threats || 0}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            organization.archivedAt
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-emerald-950 text-emerald-300 ring-1 ring-inset ring-emerald-800'
                          }`}
                        >
                          {organization.archivedAt ? 'Archived' : 'Active'}
                        </span>
                        <div className="mt-1 text-xs text-slate-600">{organization.timezone}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDialog(organization)}
                            className="rounded-md border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                            aria-label={`Edit ${organization.name}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void archiveOrganization(organization)}
                            disabled={Boolean(organization.archivedAt)}
                            className="rounded-md border border-slate-700 p-2 text-slate-400 hover:border-red-800 hover:bg-red-950/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`Archive ${organization.name}`}
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-800 px-5 py-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-slate-700 p-2 hover:bg-slate-800 disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-24 text-center">Page {page} of {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-md border border-slate-700 p-2 hover:bg-slate-800 disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold">{editing ? 'Edit organization' : 'Create organization'}</h2>
                <p className="mt-1 text-sm text-slate-500">Configure tenant identity and regional defaults.</p>
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitForm} className="space-y-5 p-6">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">Name</span>
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={(event) => updateName(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">Slug</span>
                <input
                  required
                  minLength={2}
                  maxLength={63}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  value={form.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setForm((current) => ({ ...current, slug: slugify(event.target.value) }));
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <span className="mt-1 block text-xs text-slate-600">Lowercase letters, numbers, and hyphens only.</span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">Description</span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-300">Time zone</span>
                <input
                  required
                  value={form.timezone}
                  onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                  placeholder="America/Chicago"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </label>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? 'Save changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
