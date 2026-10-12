import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  buildCorrelationGraph,
  findClusters,
  correlateWithActors,
  summarizeCluster,
} from "@/lib/threatCorrelation";
import ClusterCard from "@/components/correlation/ClusterCard";
import { Network, Loader2, Filter, GitBranch, Users, AlertCircle } from "lucide-react";

const STRENGTH_FILTERS = [
  { label: "All", value: "all" },
  { label: "Strong", value: "strong" },
  { label: "Medium+", value: "medium" },
];

export default function ThreatCorrelation() {
  const [strengthFilter, setStrengthFilter] = useState("all");
  const [sort_by, setSortBy] = useState("size"); // size | strength

  const { data: threats = [], isLoading: loadingThreats } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.filter({ archived: { $ne: true } }, "-created_date", 500),
  });
  const { data: actors = [] } = useQuery({
    queryKey: ["threatActors"],
    queryFn: () => base44.entities.ThreatActor.list("-created_date", 200),
  });

  const { clusters, actorLinks, stats } = useMemo(() => {
    if (!threats.length) return { clusters: [], actorLinks: [], stats: null };

    const edges = buildCorrelationGraph(threats);
    const allClusters = findClusters(threats, edges);
    const links = correlateWithActors(threats, actors);

    // Filter by strength
    const filtered = allClusters.filter((c) => {
      if (strengthFilter === "all") return true;
      const summary = summarizeCluster(c);
      if (strengthFilter === "strong") return summary.maxStrength === "strong";
      if (strengthFilter === "medium") return ["strong", "medium"].includes(summary.maxStrength);
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sort_by === "strength") {
        const sa = summarizeCluster(a);
        const sb = summarizeCluster(b);
        const rank = { strong: 3, medium: 2, weak: 1 };
        if (rank[sb.maxStrength] !== rank[sa.maxStrength]) return rank[sb.maxStrength] - rank[sa.maxStrength];
        return b.threats.length - a.threats.length;
      }
      return b.threats.length - a.threats.length;
    });

    const clusteredThreatIds = new Set();
    allClusters.forEach((c) => c.threats.forEach((t) => clusteredThreatIds.add(t.id)));

    return {
      clusters: filtered,
      actorLinks: links,
      stats: {
        totalThreats: threats.length,
        totalEdges: edges.length,
        totalClusters: allClusters.length,
        filteredClusters: filtered.length,
        clusteredThreats: clusteredThreatIds.size,
        largestCluster: Math.max(0, ...allClusters.map((c) => c.threats.length)),
        actorLinks: links.length,
      },
    };
  }, [threats, actors, strengthFilter, sort_by]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <Network className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Threat Correlation Engine</h1>
          <p className="text-sm text-muted-foreground">
            Connected threats clustered by shared CVEs, products, MITRE ATT&amp;CK techniques, and actor overlap
          </p>
        </div>
      </div>

      {loadingThreats ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !stats ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <Network className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No threat data to correlate yet.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatTile icon={GitBranch} label="Clusters" value={stats.totalClusters} color="text-primary" bg="bg-primary/10" />
            <StatTile icon={Network} label="Correlated Threats" value={stats.clusteredThreats} color="text-orange-500" bg="bg-orange-500/10" />
            <StatTile icon={AlertCircle} label="Largest Cluster" value={stats.largestCluster} color="text-red-500" bg="bg-red-500/10" />
            <StatTile icon={GitBranch} label="Total Links" value={stats.totalEdges} color="text-blue-500" bg="bg-blue-500/10" />
            <StatTile icon={Users} label="Actor Links" value={stats.actorLinks} color="text-fuchsia-500" bg="bg-fuchsia-500/10" />
            <StatTile icon={Network} label="Threats Analyzed" value={stats.totalThreats} color="text-emerald-500" bg="bg-emerald-500/10" />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Filter className="w-3.5 h-3.5" />
              Strength:
            </div>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
              {STRENGTH_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStrengthFilter(f.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    strengthFilter === f.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
              Sort by:
            </div>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
              <button
                onClick={() => setSortBy("size")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${sort_by === "size" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Cluster Size
              </button>
              <button
                onClick={() => setSortBy("strength")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${sort_by === "strength" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Correlation Strength
              </button>
            </div>
          </div>

          {/* Clusters */}
          {clusters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-16 text-center">
              <Network className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">
                No threat clusters found at the <span className="font-medium">{strengthFilter}</span> correlation level.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Clusters form when threats share CVEs, affected products, or ATT&amp;CK techniques.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {clusters.map((cluster, i) => (
                <ClusterCard key={i} cluster={cluster} actorLinks={actorLinks} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg} ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}