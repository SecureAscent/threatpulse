import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Bookmark, Plus, Loader2, X, Check } from "lucide-react";

export default function WatchlistChips({ current, applyFilters }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const owner = user?.full_name || user?.email || "Me";
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: lists = [] } = useQuery({
    queryKey: ["watchlists"],
    queryFn: () => base44.entities.Watchlist.filter({ kind: "saved_search" }, "created_date", 50),
  });
  const mine = lists.filter((w) => w.created_by_id === user?.id);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await base44.entities.Watchlist.create({
        name: name.trim(),
        kind: "saved_search",
        filters: JSON.stringify(current),
        owner_name: owner,
      });
      setName("");
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["watchlists"] });
    } finally {
      setSaving(false);
    }
  };

  const apply = (w) => {
    try {
      applyFilters(JSON.parse(w.filters || "{}"));
    } catch { /* ignore */ }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-1 flex items-center gap-1">
        <Bookmark className="w-3.5 h-3.5" /> Saved
      </span>
      {mine.map((w) => (
        <button
          key={w.id}
          onClick={() => apply(w)}
          title={w.name}
          className="px-3 py-1.5 rounded-full text-xs font-medium border bg-card text-foreground/80 border-border hover:border-primary/40 hover:bg-accent transition-colors truncate max-w-[12rem]"
        >
          {w.name}
        </button>
      ))}
      {adding ? (
        <div className="inline-flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Search name…"
            className="w-32 px-2.5 py-1.5 rounded-full text-xs border border-input bg-card focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button onClick={save} disabled={saving || !name.trim()} className="p-1.5 rounded-full bg-primary text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => { setAdding(false); setName(""); }} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Save current search
        </button>
      )}
    </div>
  );
}