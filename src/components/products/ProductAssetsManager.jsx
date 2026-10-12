import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";
import ProductAssetForm from "@/components/products/ProductAssetForm";

const statusStyle = {
  Active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Inactive: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  Retired: "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function ProductAssetsManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["products", "assets"],
    queryFn: () => base44.entities.Product.list("-created_date", 200),
  });
  const [editing, setEditing] = useState(null); // null | asset | { new: true }
  const [submitting, setSubmitting] = useState(false);

  const submit = async (payload) => {
    setSubmitting(true);
    try {
      if (editing?.id) {
        await base44.entities.Product.update(editing.id, payload);
        toast({ title: "Asset updated" });
      } else {
        await base44.entities.Product.create(payload);
        toast({ title: "Asset added" });
      }
      await qc.invalidateQueries({ queryKey: ["products", "assets"] });
      await qc.invalidateQueries({ queryKey: ["threats"] });
      setEditing(null);
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (asset) => {
    if (!window.confirm(`Remove ${asset.name}?`)) return;
    try {
      await base44.entities.Product.delete(asset.id);
      await qc.invalidateQueries({ queryKey: ["products", "assets"] });
      toast({ title: "Asset removed" });
    } catch (e) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-sm">Tracked Assets & Active Versions</h3>
          <p className="text-xs text-muted-foreground">
            Record currently deployed versions to refine blast radius impact assessments
          </p>
        </div>
        <button
          onClick={() => setEditing({ new: true })}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </div>

      {editing ? (
        <div className="rounded-lg border border-border p-4 bg-secondary/20 mb-4">
          <ProductAssetForm
            initialData={editing.id ? editing : null}
            onSubmit={submit}
            onCancel={() => setEditing(null)}
            submitting={submitting}
          />
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tracked assets yet. Add one to record its active version.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Asset</th>
                <th className="text-left px-3 py-2 font-medium">Vendor</th>
                <th className="text-left px-3 py-2 font-medium">Active Version</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">EOL</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-t border-border hover:bg-accent/50">
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{a.vendor || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{a.current_version || "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold border ${
                        statusStyle[a.status] || statusStyle.Active
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                    {a.end_of_life_date || "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setEditing(a)}
                        className="p-1.5 rounded-md hover:bg-accent"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(a)}
                        className="p-1.5 rounded-md hover:bg-accent text-red-500"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}