import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Pencil, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import ThreatForm from "@/components/threats/ThreatForm";

const typeOptions = ["All Types", "Vulnerability", "Ransomware", "Campaign", "Malware", "Breach", "Advisory", "Other"];

export default function Threats() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [sevFilter, setSevFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });

  const filtered = useMemo(() => {
    return threats.filter((t) => {
      if (typeFilter !== "All Types" && t.type !== typeFilter) return false;
      if (sevFilter !== "All" && t.severity !== sevFilter) return false;
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${t.title} ${t.description} ${t.cve_id || ""} ${t.source} ${t.affected_products || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [threats, query, typeFilter, sevFilter, statusFilter]);

  const hasFilters = query || typeFilter !== "All Types" || sevFilter !== "All" || statusFilter !== "All";

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t) => { setEditing(t); setDialogOpen(true); };

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      if (editing) await base44.entities.Threat.update(editing.id, payload);
      else await base44.entities.Threat.create(payload);
      qc.invalidateQueries({ queryKey: ["threats"] });
      setDialogOpen(false);
      setEditing(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t) => {
    if (!confirm(`Delete "${t.title}"?`)) return;
    setDeletingId(t.id);
    try {
      await base44.entities.Threat.delete(t.id);
      qc.invalidateQueries({ queryKey: ["threats"] });
    } finally {
      setDeletingId(null);
    }
  };

  const selectCls = "px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Threats</h1>
          <p className="text-sm text-muted-foreground">Manage all tracked threats — create, edit, and remove records</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Threat
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, CVE, source, products…"
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
          {typeOptions.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className={selectCls}>
          <option>All</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
          <option>All</option><option>New</option><option>Analyzing</option><option>Mitigated</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setQuery(""); setTypeFilter("All Types"); setSevFilter("All"); setStatusFilter("All"); }}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">{filtered.length} threats</p>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 border-b border-border last:border-0 bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No threats found{hasFilters ? " for your filters" : " yet"}. Click <span className="font-medium text-foreground">New Threat</span> to add one.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Severity</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Type</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">CVE</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Source</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium line-clamp-1 max-w-xs">{t.title}</p>
                    {t.affected_products && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 max-w-xs">{t.affected_products}</p>}
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={t.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{t.type}</td>
                  <td className="px-4 py-3 font-mono text-xs hidden lg:table-cell">{t.cve_id || "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">{t.source || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(t)} disabled={deletingId === t.id} className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-accent transition-colors disabled:opacity-50" title="Delete">
                        {deletingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Threat" : "New Threat"}</DialogTitle>
          </DialogHeader>
          <ThreatForm
            initialData={editing}
            onSubmit={handleSubmit}
            onCancel={() => { setDialogOpen(false); setEditing(null); }}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}