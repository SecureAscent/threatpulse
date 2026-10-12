import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Target, Plus, Trash2, Loader2, Globe, Mail, Search, UserCircle } from "lucide-react";

const kindIcon = {
  domain: Globe,
  keyword: Search,
  email: Mail,
  identity: UserCircle,
};

function termList(terms) {
  return (terms || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export default function ExposureWatchlists() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", kind: "domain", terms: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { data: watchlists = [], isLoading } = useQuery({
    queryKey: ["exposureWatchlists"],
    queryFn: () => base44.entities.TenantWatchlist.list("-created_date", 100),
  });

  const resetForm = () => {
    setForm({ name: "", kind: "domain", terms: "", notes: "" });
    setShowForm(false);
    setError(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.terms.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await base44.entities.TenantWatchlist.create({
        name: form.name.trim(),
        kind: form.kind,
        terms: form.terms.trim(),
        notes: form.notes.trim() || undefined,
        enabled: true,
        organizationId: user?.id || "default",
        owner_name: user?.full_name || user?.email || undefined,
      });
      qc.invalidateQueries({ queryKey: ["exposureWatchlists"] });
      resetForm();
    } catch (e) {
      setError(e?.message || "Failed to create watchlist");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (wl) => {
    try {
      await base44.entities.TenantWatchlist.update(wl.id, { enabled: !wl.enabled });
      qc.invalidateQueries({ queryKey: ["exposureWatchlists"] });
    } catch (e) {
      setError(e?.message || "Toggle failed");
    }
  };

  const handleDelete = async (wl) => {
    if (!confirm(`Delete watchlist "${wl.name}"?`)) return;
    try {
      await base44.entities.TenantWatchlist.delete(wl.id);
      qc.invalidateQueries({ queryKey: ["exposureWatchlists"] });
    } catch (e) {
      setError(e?.message || "Delete failed");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Watchlists</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor domains, keywords, emails, and identities across intelligence sources.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Watchlist
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive px-4 py-2.5 mb-4 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-border bg-card p-5 mb-6 space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Corporate Domains"
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="domain">Domain</option>
                <option value="keyword">Keyword</option>
                <option value="email">Email</option>
                <option value="identity">Identity</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Terms</label>
            <textarea
              value={form.terms}
              onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
              placeholder="Comma or newline separated — e.g. acme.com, api.acme.com"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {termList(form.terms).length} term(s)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes (optional)</label>
            <input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Context or owner info"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border border-input text-sm font-medium hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Watchlist
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : watchlists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No watchlists configured yet. Create one to start monitoring.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {watchlists.map((wl) => {
            const Icon = kindIcon[wl.kind] || Globe;
            const terms = termList(wl.terms);
            return (
              <div key={wl.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{wl.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {wl.kind} · {terms.length} term(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(wl)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        wl.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                      }`}
                      title={wl.enabled ? "Enabled" : "Disabled"}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          wl.enabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleDelete(wl)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {terms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {terms.slice(0, 8).map((t, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                    {terms.length > 8 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                        +{terms.length - 8} more
                      </span>
                    )}
                  </div>
                )}
                {wl.notes && (
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                    {wl.notes}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">
                  Created {fmtDate(wl.created_date)}
                  {wl.owner_name ? ` · ${wl.owner_name}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}