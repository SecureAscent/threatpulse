'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import { Target, Plus, Trash2, Loader2, Globe, Mail, Search, UserCircle } from 'lucide-react';

const kindIcon: Record<string, any> = { domain: Globe, keyword: Search, email: Mail, identity: UserCircle };

function termList(terms: string | null | undefined): string[] {
  return (terms || '').split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ExposureWatchlistsContent() {
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', kind: 'domain', terms: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchWatchlists = useCallback(async () => {
    try {
      const res = await fetch('/api/exposure/watchlists');
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data?.watchlists ?? []);
      }
    } catch (err) {
      console.error('Watchlists fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWatchlists(); }, [fetchWatchlists]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.terms.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/exposure/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Watchlist created');
        setForm({ name: '', kind: 'domain', terms: '', notes: '' });
        setShowForm(false);
        fetchWatchlists();
      } else { toast.error('Failed to create watchlist'); }
    } catch { toast.error('Failed to create watchlist'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (wl: any) => {
    if (!confirm(`Delete watchlist "${wl.name}"?`)) return;
    try {
      await fetch(`/api/exposure/watchlists?id=${wl.id}`, { method: 'DELETE' });
      toast.success('Watchlist deleted');
      fetchWatchlists();
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      <FadeIn>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-display font-bold tracking-tight">Watchlists</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Monitor domains, keywords, emails, and identities across intelligence sources.</p>
          </div>
          <Button onClick={() => setShowForm((s) => !s)} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" /> New Watchlist</Button>
        </div>
      </FadeIn>

      {showForm && (
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-5 space-y-4">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-1.5">Name</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Corporate Domains" required />
                </div>
                <div>
                  <Label className="block text-sm font-medium mb-1.5">Type</Label>
                  <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm">
                    <option value="domain">Domain</option>
                    <option value="keyword">Keyword</option>
                    <option value="email">Email</option>
                    <option value="identity">Identity</option>
                  </select>
                </div>
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1.5">Terms</Label>
                <Textarea value={form.terms} onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))} placeholder="Comma or newline separated — e.g. acme.com, api.acme.com" rows={3} required />
                <p className="text-xs text-muted-foreground mt-1">{termList(form.terms).length} term(s)</p>
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1.5">Notes (optional)</Label>
                <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Context or owner info" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="gap-1.5">{saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Watchlist</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : watchlists.length === 0 ? (
        <Card className="border-dashed"><CardContent className="pt-10 pb-10 text-center">
          <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">No watchlists configured yet.</p>
        </CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {watchlists.map((wl) => {
            const Icon = kindIcon[wl.kind] || Globe;
            const terms = termList(wl.terms);
            return (
              <Card key={wl.id} className="border-border/50">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-primary" /></div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{wl.name}</p>
                        <p className="text-xs text-muted-foreground">{wl.kind} · {terms.length} term(s)</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(wl)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                  {terms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {terms.slice(0, 8).map((t, i) => (<span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">{t}</span>))}
                      {terms.length > 8 && <span className="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">+{terms.length - 8} more</span>}
                    </div>
                  )}
                  {wl.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{wl.notes}</p>}
                  <p className="text-[10px] text-muted-foreground mt-2">Created {fmtDate(wl.createdAt)}{wl.ownerName ? ` · ${wl.ownerName}` : ''}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}