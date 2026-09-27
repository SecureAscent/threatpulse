import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  KeySquare,
  Plus,
  Copy,
  Check,
  Trash2,
  Loader2,
  X,
  ShieldCheck,
  Clock,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ALL_SCOPES = [
  { key: "read:threats", label: "Read Threats" },
  { key: "write:threats", label: "Write Threats" },
  { key: "read:exposures", label: "Read Exposures" },
  { key: "read:portfolio", label: "Read Portfolio" },
  { key: "read:actors", label: "Read Threat Actors" },
];

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return "tp_live_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ApiKeys() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState(["read:threats"]);
  const [expiresIn, setExpiresIn] = useState("never");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["apikeys"],
    queryFn: () => base44.entities.ApiKey.list("-created_date", 50),
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const rawKey = randomKey();
      const hash = await sha256(rawKey);
      const expiresAt =
        expiresIn === "never" ? null : new Date(Date.now() + Number(expiresIn) * 86400000).toISOString();
      await base44.entities.ApiKey.create({
        name,
        key_prefix: rawKey.slice(0, 12),
        key_hash: hash,
        scopes: scopes.join(","),
        expires_at: expiresAt,
        active: true,
      });
      setNewKey(rawKey);
      setName("");
      setScopes(["read:threats"]);
      setExpiresIn("never");
      qc.invalidateQueries({ queryKey: ["apikeys"] });
    } catch (err) {
      setError(err.message || "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key) => {
    if (!confirm(`Revoke API key "${key.name}"? This cannot be undone.`)) return;
    await base44.entities.ApiKey.update(key.id, { active: false });
    qc.invalidateQueries({ queryKey: ["apikeys"] });
  };

  const handleDelete = async (key) => {
    if (!confirm(`Permanently delete API key "${key.name}"?`)) return;
    await base44.entities.ApiKey.delete(key.id);
    qc.invalidateQueries({ queryKey: ["apikeys"] });
  };

  const copyKey = () => {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeySquare className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
            <p className="text-sm text-muted-foreground">Customer-facing API keys for SIEM, SOAR, and automation integrations</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Generate Key
        </Button>
      </div>

      {/* API docs callout */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-6">
        <div className="flex items-start gap-3">
          <Code className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">ThreatPulse REST API</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Use your API key in the <code className="font-mono text-primary">Authorization: Bearer tp_live_…</code> header.
              Base URL: <code className="font-mono text-primary">https://spectral-pulse-guard-pro.base44.app/functions</code>.
              Rate limit: 100 req/min per key.
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <KeySquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">No API keys yet</p>
          <p className="text-sm text-muted-foreground mt-1">Generate a key to pull threat data into your SIEM or SOAR.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Name</th>
                <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Prefix</th>
                <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Scopes</th>
                <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Expires</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium">{k.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">{k.key_prefix}…</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground hidden md:table-cell">{k.scopes || "—"}</td>
                  <td className="px-5 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                    {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-5 py-3">
                    {k.active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border bg-secondary text-muted-foreground border-border">
                        Revoked
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {k.active && (
                        <button onClick={() => handleRevoke(k)} title="Revoke" className="p-1.5 rounded-lg text-muted-foreground hover:text-orange-500 hover:bg-orange-500/5 transition-colors">
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(k)} title="Delete" className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Generate API Key</h3>
              <button onClick={() => { setShowCreate(false); setNewKey(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {newKey ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm font-medium text-emerald-600">Key generated — copy it now</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">This is the only time the full key will be shown.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-card border border-border font-mono text-xs break-all">{newKey}</code>
                    <button onClick={copyKey} className="shrink-0 p-2 rounded-lg border border-border hover:bg-accent transition-colors">
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button onClick={() => { setShowCreate(false); setNewKey(""); }} className="w-full">Done</Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Key Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Splunk HEC Integration"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Scopes</label>
                  <div className="space-y-2">
                    {ALL_SCOPES.map((s) => (
                      <label key={s.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scopes.includes(s.key)}
                          onChange={(e) => {
                            if (e.target.checked) setScopes([...scopes, s.key]);
                            else setScopes(scopes.filter((x) => x !== s.key));
                          }}
                          className="rounded border-border"
                        />
                        <span className="text-sm">{s.label}</span>
                        <code className="text-xs text-muted-foreground font-mono">{s.key}</code>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Expires In</label>
                  <select
                    value={expiresIn}
                    onChange={(e) => setExpiresIn(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="never">Never</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex items-center gap-2 pt-2">
                  <Button type="submit" disabled={creating} className="flex-1">
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Generate Key
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}