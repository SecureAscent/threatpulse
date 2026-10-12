import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { BarChart3, Loader2 } from "lucide-react";
import RiskLeaderboard from "@/components/analytics/RiskLeaderboard";
import RiskScatterPlot from "@/components/analytics/RiskScatterPlot";
import TrendForecast from "@/components/analytics/TrendForecast";
import CveProductMatrix from "@/components/analytics/CveProductMatrix";

export default function Analytics() {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.filter({ archived: { $ne: true } }, "-created_date", 500),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Advanced Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Composite risk scoring, CVE-product correlation, and trend forecasting
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : threats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-16 text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            No threat data yet. Run feed ingestion to populate analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <RiskLeaderboard threats={threats} />
          <div className="grid lg:grid-cols-2 gap-6">
            <RiskScatterPlot threats={threats} />
            <TrendForecast threats={threats} />
          </div>
          <CveProductMatrix threats={threats} />
        </div>
      )}
    </div>
  );
}