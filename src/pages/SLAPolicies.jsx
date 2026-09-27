import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Clock,
  Plus,
  Trash2,
  Loader2,
  X,
  Check,
  AlertTriangle,
  Mail,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SEVERITIES = [
  { key: "critical_hours", label: "Critical", color: "text-red-500", default: 1 },
  { key: "high_hours", label: "High", color: "text-orange-500", default: 4 },
  { key: "medium_hours", label: "Medium", color: "text-yellow-500", default: 24 },
  { key: "low_hours", label: "Low", color: "text-blue-500", default: 72 },
];

export default function SLAPolicies() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    critical_hours: 1,
    high_hours: 4,
    medium_hours: 24,
    low_hours: 72,
    escalation_email: "",
    escalation_slack_webhook: "",
    auto_escalate: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["sla-policies"],
    queryFn: () => base44.entities.SLAPolicy.list("-created_date", 50),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      critical_hours: 1,
      high_hours: 4,
      medium_hours: 24,
      low_hours: 72,
      escalation_email: "",
      escalation_slack_webhook: "",
      auto_escalate: true,
    });
    setShowCreate(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      critical_hours: p.critical_hours ?? 1,
      high_hours: p.high_hours ?? 4,
      medium_hours: p.medium_hours ?? 24,
      low_hours: p.low_hours ?? 72,
      escalation_email: p.escalation_email || "",
      escalation_slack_webhook: p.escalation_slack_webhook || "",
      auto_escalate: p.auto_escalate ?? true,
    });
    setShowCreate(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        critical_hours: Number(form.critical_hours),
        high_hours: Number(form.high_hours),
        medium_hours: Number(form.medium_hours),
        low_hours: Number(form.low_hours),
      };
      if (editing) {
        await base44.entities.SLAPolicy.update(editing.id, payload);
      } else {
        await base44.entities.SLAPolicy.create({ ...payload, active: true });
      }
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["sla-policies"] });
    } catch (err) {
      setError(err.message || "Failed to save SLA policy");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p) => {
    await base44.entities.SLAPolicy.update(p.id, { active: !p.active });
    qc.invalidateQueries({ queryKey: ["sla-policies"] });
  };

  const handleDelete = async (p) => {
    if (!confirm(`Delete SLA policy "${p.name}"?`)) return;
    await base44.entities.SLAPolicy.delete(p.id);
    qc.invalidateQueries({ queryKey: ["sla-policies"] });
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SLA Policies</h1>
            <p className="text-sm text-muted-foreground">Configurable severity-based SLA timers with escalation routing</p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New Policy
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : policies.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Clock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">No SLA policies configured</p>
          <p className="text-sm text-muted-foreground mt-1">Create a policy to set custom response-time targets and escalation rules.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {policies.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-5 border-b border-border flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg">{p.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
                      p.active
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                    {p.auto_escalate && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border bg-orange-500/10 text-orange-500 border-orange-500/20">
                        <AlertTriangle className="w-3 h-3" /> Auto-Escalate
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                    {p.escalation_email && (
                      <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {p.escalation_email}</span>
                    )}
                    {p.escalation_slack_webhook && (
                      <span className="inline-flex items-center gap-1"><Bell className="w-3 h-3" /> Slack webhook</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>Edit</Button>
                  <button
                    onClick={() => handleToggle(p)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors"
                  >
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => handleDelete(p)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SEVERITIES.map((s) => (
                  <div key={s.key} className="rounded-lg border border-border p-3 text-center">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${s.color}`}>{s.label}</p>
                    <p className="text-xl font-bold mt-1">{p[s.key] ?? s.default}h</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{editing ? "Edit SLA Policy" : "New SLA Policy"}</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Policy Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Default SLA Policy"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">SLA Targets (hours to first response)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SEVERITIES.map((s) => (
                    <div key={s.key}>
                      <label className={`text-xs font-semibold uppercase tracking-wide ${s.color} mb-1 block`}>{s.label}</label>
                      <Input
                        type="number"
                        value={form[s.key]}
                        onChange={(e) => setForm({ ...form, [s.key]: e.target.value })}
                        min={0}
                        step={0.5}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Escalation Email</label>
                <Input
                  type="email"
                  value={form.escalation_email}
                  onChange={(e) => setForm({ ...form, escalation_email: e.target.value })}
                  placeholder="soc-lead@company.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Slack Webhook URL (optional)</label>
                <Input
                  type="url"
                  value={form.escalation_slack_webhook}
                  onChange={(e) => setForm({ ...form, escalation_slack_webhook: e.target.value })}
                  placeholder="https://hooks.slack.com/services/…"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.auto_escalate}
                  onChange={(e) => setForm({ ...form, auto_escalate: e.target.checked })}
                  className="rounded border-border"
                />
                <span className="text-sm">Auto-escalate on SLA breach</span>
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {editing ? "Save Changes" : "Create Policy"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}