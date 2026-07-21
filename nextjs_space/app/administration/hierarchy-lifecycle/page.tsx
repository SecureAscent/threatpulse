'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, Building2, Edit3, Loader2, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';

type Parent = { id: string; name: string; slug: string; archivedAt: string | null };
type Department = { id: string; organizationId: string; organizationName?: string; name: string; slug: string; archivedAt: string | null };

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed with status ${response.status}`);
  return payload;
}

export default function HierarchyLifecyclePage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [canManageParents, setCanManageParents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson(await fetch('/api/admin/orgs/hierarchy-lifecycle', { cache: 'no-store' }));
      setParents(payload.parents || []);
      setDepartments(payload.departments || []);
      setCanManageParents(Boolean(payload.canManageParents));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load hierarchy lifecycle state.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function mutate(entityType: 'parentOrganization' | 'department', item: Parent | Department, action: 'rename' | 'archive' | 'restore') {
    let name: string | undefined;
    if (action === 'rename') {
      const entered = window.prompt(`Rename ${item.name}`, item.name);
      if (entered === null) return;
      name = entered.trim();
      if (!name) return;
    } else if (!window.confirm(`${action === 'archive' ? 'Archive' : 'Restore'} ${item.name}?`)) return;

    setBusy(`${entityType}:${item.id}`);
    setError(null);
    setNotice(null);
    try {
      await readJson(await fetch('/api/admin/orgs/hierarchy-lifecycle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          action,
          name,
          ...(entityType === 'parentOrganization' ? { parentOrganizationId: item.id } : { departmentId: item.id }),
        }),
      }));
      setNotice(`${item.name} was ${action === 'rename' ? 'renamed' : action === 'archive' ? 'archived' : 'restored'}.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Lifecycle operation failed.');
    } finally {
      setBusy(null);
    }
  }

  function actions(entityType: 'parentOrganization' | 'department', item: Parent | Department) {
    const key = `${entityType}:${item.id}`;
    return <div className="flex justify-end gap-2">
      {!item.archivedAt && <button onClick={() => void mutate(entityType, item, 'rename')} className="rounded border border-slate-700 p-2" aria-label={`Rename ${item.name}`}><Edit3 className="h-4 w-4" /></button>}
      <button disabled={busy === key} onClick={() => void mutate(entityType, item, item.archivedAt ? 'restore' : 'archive')} className="rounded border border-slate-700 p-2 disabled:opacity-50" aria-label={`${item.archivedAt ? 'Restore' : 'Archive'} ${item.name}`}>
        {busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : item.archivedAt ? <RotateCcw className="h-4 w-4 text-emerald-300" /> : <Archive className="h-4 w-4 text-amber-300" />}
      </button>
    </div>;
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100"><div className="mx-auto max-w-6xl px-4 py-8">
    <div className="mb-8 flex items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm text-cyan-300"><ShieldCheck className="h-4 w-4" /> Administration</div><h1 className="text-3xl font-semibold">Hierarchy lifecycle</h1><p className="mt-2 text-sm text-slate-400">Rename, archive, and restore parent organizations and departments without deleting historical data.</p></div><button onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-700 p-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
    {(error || notice) && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-900 bg-red-950/50 text-red-200' : 'border-emerald-900 bg-emerald-950/40 text-emerald-200'}`}>{error || notice}</div>}
    {loading ? <div className="py-20 text-center text-slate-400"><Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin" />Loading hierarchy…</div> : <div className="space-y-8">
      {canManageParents && <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70"><div className="border-b border-slate-800 px-5 py-4"><h2 className="font-semibold">Parent organizations</h2></div><table className="min-w-full divide-y divide-slate-800 text-sm"><thead className="bg-slate-950/60 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">{parents.length === 0 ? <tr><td colSpan={3} className="px-5 py-10 text-center text-slate-500">No parent organizations.</td></tr> : parents.map((parent) => <tr key={parent.id} className={parent.archivedAt ? 'text-slate-500' : ''}><td className="px-5 py-4"><div className="font-medium">{parent.name}</div><div className="font-mono text-xs text-slate-500">{parent.slug}</div></td><td className="px-5 py-4">{parent.archivedAt ? 'Archived' : 'Active'}</td><td className="px-5 py-4">{actions('parentOrganization', parent)}</td></tr>)}</tbody></table></section>}
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70"><div className="border-b border-slate-800 px-5 py-4"><h2 className="font-semibold">Departments</h2></div><table className="min-w-full divide-y divide-slate-800 text-sm"><thead className="bg-slate-950/60 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Department</th><th className="px-5 py-3">Organization</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">{departments.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500"><Building2 className="mx-auto mb-2 h-6 w-6" />No departments.</td></tr> : departments.map((department) => <tr key={department.id} className={department.archivedAt ? 'text-slate-500' : ''}><td className="px-5 py-4"><div className="font-medium">{department.name}</div><div className="font-mono text-xs text-slate-500">{department.slug}</div></td><td className="px-5 py-4">{department.organizationName || department.organizationId}</td><td className="px-5 py-4">{department.archivedAt ? 'Archived' : 'Active'}</td><td className="px-5 py-4">{actions('department', department)}</td></tr>)}</tbody></table></section>
    </div>}
  </div></main>;
}
