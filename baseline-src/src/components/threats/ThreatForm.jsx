import React, { useState, useEffect } from "react";
import { estimateImpact } from "@/lib/impactAssessment";

const sevOptions = ["Critical", "High", "Medium", "Low"];
const typeOptions = ["Vulnerability", "Ransomware", "Campaign", "Malware", "Breach", "Advisory", "Other"];
const statusOptions = ["New", "Analyzing", "Mitigated"];

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5";

export default function ThreatForm({ initialData, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "Medium",
    type: "Other",
    cve_id: "",
    cvss_score: "",
    source: "",
    source_url: "",
    status: "New",
    assigned_to: "",
    affected_products: "",
    notes: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || "",
        description: initialData.description || "",
        severity: initialData.severity || "Medium",
        type: initialData.type || "Other",
        cve_id: initialData.cve_id || "",
        cvss_score: initialData.cvss_score ?? "",
        source: initialData.source || "",
        source_url: initialData.source_url || "",
        status: initialData.status || "New",
        assigned_to: initialData.assigned_to || "",
        affected_products: initialData.affected_products || "",
        notes: initialData.notes || "",
      });
    }
  }, [initialData]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const impact = estimateImpact({
      severity: form.severity,
      affected_products: form.affected_products,
    });
    const payload = {
      ...form,
      cvss_score: form.cvss_score === "" ? null : Number(form.cvss_score),
      source_url: form.source_url || undefined,
      estimated_downtime_hours: impact.downtimeHours,
      estimated_recovery_cost: impact.recoveryCost,
    };
    if (!payload.title.trim()) return;
    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelCls}>Title *</label>
        <input value={form.title} onChange={set("title")} className={inputCls} placeholder="Threat headline" required />
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea value={form.description} onChange={set("description")} rows={3} className={inputCls} placeholder="Summary of the threat" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Severity *</label>
          <select value={form.severity} onChange={set("severity")} className={inputCls}>
            {sevOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Type *</label>
          <select value={form.type} onChange={set("type")} className={inputCls}>
            {typeOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>CVE ID</label>
          <input value={form.cve_id} onChange={set("cve_id")} className={inputCls} placeholder="CVE-2025-1234" />
        </div>
        <div>
          <label className={labelCls}>CVSS Score</label>
          <input type="number" step="0.1" min="0" max="10" value={form.cvss_score} onChange={set("cvss_score")} className={inputCls} placeholder="7.5" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Source</label>
          <input value={form.source} onChange={set("source")} className={inputCls} placeholder="CISA KEV, NVD…" />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.status} onChange={set("status")} className={inputCls}>
            {statusOptions.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Source URL</label>
        <input value={form.source_url} onChange={set("source_url")} className={inputCls} placeholder="https://…" />
      </div>

      <div>
        <label className={labelCls}>Affected Products</label>
        <input value={form.affected_products} onChange={set("affected_products")} className={inputCls} placeholder="Comma-separated, e.g. Windows 11, Exchange" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Assigned To</label>
          <input value={form.assigned_to} onChange={set("assigned_to")} className={inputCls} placeholder="Analyst name" />
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <input value={form.notes} onChange={set("notes")} className={inputCls} placeholder="Analyst notes" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg border border-input text-sm hover:bg-accent transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {submitting ? "Saving…" : initialData ? "Save Changes" : "Create Threat"}
        </button>
      </div>
    </form>
  );
}