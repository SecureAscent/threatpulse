import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Fingerprint,
  RefreshCw,
  Search,
  Globe,
  ShieldAlert,
  ExternalLink,
  Info,
} from "lucide-react";
import ThreatActorTrends from "@/components/threats/ThreatActorTrends";

const kindBadge = {
  threat_actor: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  malware: "bg-red-500/10 text-red-500 border-red-500/20",
  campaign: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  darkweb_mention: "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20",
  indicator: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const confBadge = {
  high: "bg-red-500/10 text-red-500 border-red-500/20",
  medium: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

function relTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ThreatActors() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [collecting, setCollecting] = useState(false);
  const [collectMsg, setCollectMsg] = useState(null);

  const { data: actors = [], isLoading } = useQuery({
    queryKey: ["threatActors"],
    queryFn: () => base44.entities.ThreatActor.list("-created_date", 200),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return actors.filter((a) => {
      if (kindFilter !== "all" && a.kind !== kindFilter) return false;
      if (!q) return true;
      return [a.name, a.ioc_value, a.malware_printable, a.tags, a.aliases]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [actors, search, kindFilter]);

  const counts = useMemo(() => {
    const byKind = {};
    actors.forEach((a) => { byKind[a.kind] = (byKind[a.kind] || 0) + 1; });
    return byKind;
  }, [actors]);

  const handleCollect = async () => {
    setCollecting(true);
    setCollectMsg(null);
    try {
      const res = await base44.functions.invoke("ingestThreatActors", {});
      const d = res?.data || {};
      if (d.error) {
        setCollectMsg({ type: "error", text: d.error });
      } else {
        const f = d.fetched || {};
        setCollectMsg({ type: "success", text: `Fetched ${f.victims || 0} victims · ${f.groups || 0} groups — added ${d.created || 0}, skipped ${d.skipped || 0}` });
        qc.invalidateQueries({ queryKey: ["threatActors"] });
      }
    } catch (e) {
      setCollectMsg({ type: "error", text: e?.response?.data?.error || e?.message || "Collection failed" });
    }
    setCollecting(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Threat Actors &amp; Dark-Web Intel</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Threat-actor &amp; campaign indicators ingested from open intelligence sources.
          </p>
        </div>
        <button
          onClick={handleCollect}
          disabled={collecting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${collecting ? "animate-spin" : ""}`} />
          {collecting ? "Collecting…" : "Collect Now"}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4 mb-6">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ransomware group &amp; victim data sourced from <span className="font-medium text-foreground">Ransomware.live</span> —
          threat-actor profiles (with MITRE ATT&amp;CK TTPs) and recent victims claimed on onion leak sites. Full
          {" "}<span className="font-medium text-foreground">dark-web mention monitoring</span> (credential leaks, marketplace chatter)
          is an Enterprise-tier capability backed by a commercial feed.
        </p>
      </div>

      {collectMsg && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 mb-4 text-sm ${
            collectMsg.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{collectMsg.text}</span>
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="text-2xl font-bold mt-1">{actors.length}</p>
        </div>
        {["threat_actor", "darkweb_mention", "malware", "indicator"].map((k) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.replace("_", " ")}</p>
            <p className="text-2xl font-bold mt-1">{counts[k] || 0}</p>
          </div>
        ))}
      </div>

      {/* Trends & origins */}
      <ThreatActorTrends actors={actors} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor, IOC, malware, tags…"
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All kinds</option>
          <option value="indicator">Indicator</option>
          <option value="malware">Malware</option>
          <option value="campaign">Campaign</option>
          <option value="threat_actor">Threat Actor</option>
          <option value="darkweb_mention">Dark-Web Mention</option>
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No threat-actor records yet. Run <span className="font-medium text-foreground">Collect Now</span> to ingest from Ransomware.live.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
            <div className="col-span-4 sm:col-span-3">Name / Malware</div>
            <div className="col-span-4 sm:col-span-4">IOC</div>
            <div className="col-span-2 hidden sm:block">Confidence</div>
            <div className="col-span-2 hidden sm:block">Last Seen</div>
            <div className="col-span-2 sm:col-span-1 text-right">Source</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((a) => (
              <div key={a.id} className="grid grid-cols-12 gap-3 px-4 py-3 items-center text-sm hover:bg-accent/40 transition-colors">
                <div className="col-span-4 sm:col-span-3">
                  <p className="font-medium truncate">{a.name || "Unknown"}</p>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${kindBadge[a.kind] || kindBadge.indicator}`}>
                    {(a.kind || "indicator").replace("_", " ")}
                  </span>
                </div>
                <div className="col-span-4 sm:col-span-4 min-w-0">
                  <p className="font-mono text-xs truncate">{a.ioc_value}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.ioc_type}{a.threat_type ? ` · ${a.threat_type}` : ""}</p>
                </div>
                <div className="col-span-2 hidden sm:block">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${confBadge[a.confidence] || confBadge.low}`}>
                    {a.confidence || "low"}
                  </span>
                </div>
                <div className="col-span-2 hidden sm:block text-xs text-muted-foreground">{relTime(a.last_seen)}</div>
                <div className="col-span-2 sm:col-span-1 text-right">
                  <a
                    href={a.source_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    title={a.source}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}