import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileCode, Plus, Search, Pencil, Trash2, Package, Link2, Layers, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";

const DEP_TYPES = ["direct", "transitive", "unknown"];
const STATUSES = ["active", "deprecated", "retired"];

function SbomForm({ open, onClose, onSave, initial, products, saving }) {
  const [form, setForm] = useState({
    component_name: initial?.component_name || "",
    component_version: initial?.component_version || "",
    vendor: initial?.vendor || "",
    purl: initial?.purl || "",
    cpe: initial?.cpe || "",
    license: initial?.license || "",
    dependency_type: initial?.dependency_type || "direct",
    product_id: initial?.product_id || "",
    status: initial?.status || "active",
    notes: initial?.notes || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    const product = products.find(p => p.id === form.product_id);
    onSave({ ...form, product_name: product?.name || "" });
  };

  const selectClass = "w-full h-9 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit SBOM Record" : "Add SBOM Record"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Component Name *</Label>
              <Input value={form.component_name} onChange={e => set("component_name", e.target.value)} />
            </div>
            <div>
              <Label>Version *</Label>
              <Input value={form.component_version} onChange={e => set("component_version", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Vendor / Supplier</Label>
            <Input value={form.vendor} onChange={e => set("vendor", e.target.value)} />
          </div>
          <div>
            <Label>Package URL (PURL)</Label>
            <Input value={form.purl} onChange={e => set("purl", e.target.value)} placeholder="pkg:npm/lodash@4.17.21" />
          </div>
          <div>
            <Label>CPE 2.3</Label>
            <Input value={form.cpe} onChange={e => set("cpe", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>License</Label>
              <Input value={form.license} onChange={e => set("license", e.target.value)} />
            </div>
            <div>
              <Label>Dependency Type</Label>
              <select value={form.dependency_type} onChange={e => set("dependency_type", e.target.value)} className={selectClass}>
                {DEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Linked Product</Label>
              <select value={form.product_id} onChange={e => set("product_id", e.target.value)} className={selectClass}>
                <option value="">— None —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select value={form.status} onChange={e => set("status", e.target.value)} className={selectClass}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.component_name || !form.component_version}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SbomCmdb() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [depFilter, setDepFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["sbom-records"],
    queryFn: () => base44.entities.SbomRecord.list("-created_date", 200),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: user } = useQuery({
    queryKey: ["current-user-org"],
    queryFn: () => base44.auth.me(),
  });
  const { data: orgs = [] } = useQuery({
    queryKey: ["all-orgs-list"],
    queryFn: () => base44.entities.Organization.list(),
  });
  const [activeOrgId, setActiveOrgId] = useState(null);

  useEffect(() => {
    if (user?.organization_id) setActiveOrgId(user.organization_id);
  }, [user]);

  const handleSwitchOrg = async (orgId) => {
    await base44.auth.updateMe({ organization_id: orgId });
    setActiveOrgId(orgId);
    qc.invalidateQueries({ queryKey: ["sbom-records"] });
    qc.invalidateQueries({ queryKey: ["products-list"] });
  };

  const filtered = records.filter(r => {
    if (depFilter !== "all" && r.dependency_type !== depFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (r.component_name || "").toLowerCase().includes(q) ||
        (r.vendor || "").toLowerCase().includes(q) ||
        (r.purl || "").toLowerCase().includes(q) ||
        (r.cpe || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const summary = {
    total: records.length,
    direct: records.filter(r => r.dependency_type === "direct").length,
    transitive: records.filter(r => r.dependency_type === "transitive").length,
    linked: records.filter(r => r.product_id).length,
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.SbomRecord.update(editing.id, data);
      } else {
        await base44.entities.SbomRecord.create({ ...data, source: "test", organization_id: activeOrgId });
      }
      qc.invalidateQueries({ queryKey: ["sbom-records"] });
      setDialogOpen(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this SBOM record?")) return;
    await base44.entities.SbomRecord.delete(id);
    qc.invalidateQueries({ queryKey: ["sbom-records"] });
  };

  const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <FileCode className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight font-heading">SBOM / Test CMDB</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Test configuration management database for software bill of materials records.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add Component
        </Button>
      </div>

      {/* Org switcher */}
      {orgs.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <select
            value={activeOrgId || ""}
            onChange={e => handleSwitchOrg(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm max-w-xs"
          >
            {orgs.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            {filtered.length} components in this organization
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Components", value: summary.total, icon: Package, color: "text-primary" },
          { label: "Direct", value: summary.direct, icon: Layers, color: "text-blue-500" },
          { label: "Transitive", value: summary.transitive, icon: Layers, color: "text-amber-500" },
          { label: "Linked to Products", value: summary.linked, icon: Link2, color: "text-emerald-500" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold">{isLoading ? "—" : s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search components…"
            className="pl-9"
          />
        </div>
        <select value={depFilter} onChange={e => setDepFilter(e.target.value)} className={selectClass}>
          <option value="all">All Types</option>
          {DEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Component</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Version</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">PURL</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">License</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No SBOM records found.</td></tr>
              ) : filtered.map(r => {
                const product = products.find(p => p.id === r.product_id);
                return (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{r.component_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.component_version}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.vendor || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.purl || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.license || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.dependency_type === "direct" ? "bg-blue-500/10 text-blue-500" : r.dependency_type === "transitive" ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>
                        {r.dependency_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{product?.name || r.product_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.status === "active" ? "bg-emerald-500/10 text-emerald-500" : r.status === "deprecated" ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(r); setDialogOpen(true); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SbomForm
        key={editing?.id || "new"}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing}
        products={products}
        saving={saving}
      />
    </div>
  );
}