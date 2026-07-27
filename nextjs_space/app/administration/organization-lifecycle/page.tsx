'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, Building2, Edit3, Loader2, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';

type Organization = { id: string; name: string; slug: string; archivedAt: string | null; parentOrganizationId: string | null };

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed with status ${response.status}`);
  return payload;
}

export default function OrganizationLifecyclePage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await readJson(await fetch('/api/organizations?includeArchived=true&pageSize=250', { cache: 'no-store' }));
      setOrganizations(payload.organizations || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load organizations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function mutate(organization: Organization, action: 'rename' | 'archive' | 'restore') {
    let name: string | undefined;
    if (action === 'rename') {
      const entered = window.prompt(`Rename ${organization.name}`, organization.name);
      if (entered === null) return;
      name = entered.trim();
      if (!name) return;
    } else if (!window.confirm(`${action === 'archive' ? 'Archive' : 'Restore'} ${organization.name}?`)) return;

    setBusy(organization.id);
    setError(null);
    setNotice(null);
    try {
      await readJson(await fetch('/api/admin/orgs/lifecycle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, organizationId: organization.id, name }),
      }));
      setNotice(`${organization.name} was ${action === 'rename' ? 'renamed' : action === 'archive' ? 'archived' : 'restored'}.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Organization lifecycle operation failed.');
    } finally {
      setBusy(null);
    }
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100"><div className="mx-auto max-w-6xl px-4 py-8">
    <div className="mb-8 flex items-start justify-between"><div><div className="mb-2 flex items-center gap-2 text-sm text-cyan-300"><ShieldCheck className="h-4 w-4" /> Administration</div><h1 className="text-3xl font-semibold">Organization lifecycle</h1><p className="mt-2 text-sm text-slate-400">Rename, archive, and restore tenant organizations while retaining historical data.</p></div><button onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-700 p-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
    {(error || notice) && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-900 bg-red-950/50 text-red-200' : 'border-emerald-900 bg-emerald-950/40 text-emerald-200'}`}>{error || notice}</div>}
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70"><table className="min-w-full divide-y divide-slate-800 text-sm"><thead className="bg-slate-950/60 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Organization</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">
      {loading ? <tr><td colSpan={3} className="px-5 py-16 text-center text-slate-400"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />Loading organizations…</td></tr> : organizations.length === 0 ? <tr><td colSpan={3} className="px-5 py-16 text-center text-slate-500"><Building2 className="mx-auto mb-3 h-7 w-7" />No organizations.</td></tr> : organizations.map((organization) => <tr key={organization.id} className={organization.archivedAt ? 'bg-slate-950/40 text-slate-500' : ''}><td className="px-5 py-4"><div className="font-medium">{organization.name}</div><div className="font-mono text-xs text-slate-500">{organization.slug}</div></td><td className="px-5 py-4">{organization.archivedAt ? 'Archived' : 'Active'}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{!organization.archivedAt && <button onClick={() => void mutate(organization, 'rename')} className="rounded border border-slate-700 p-2"><Edit3 className="h-4 w-4" /></button>}<button disabled={busy === organization.id} onClick={() => void mutate(organization, organization.archivedAt ? 'restore' : 'archive')} className="rounded border border-slate-700 p-2 disabled:opacity-50">{busy === organization.id ? <Loader2 className="h-4 w-4 animate-spin" /> : organization.archivedAt ? <RotateCcw className="h-4 w-4 text-emerald-300" /> : <Archive className="h-4 w-4 text-amber-300" />}</button></div></td></tr>)}
    </tbody></table></section>
  </div></main>;
}
