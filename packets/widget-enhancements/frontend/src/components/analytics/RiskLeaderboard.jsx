import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { riskLeaderboard, riskTier } from "@/lib/riskAnalytics";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import { Trophy, ChevronRight } from "lucide-react";

export default function RiskLeaderboard({ threats = [], limit = 15 }) {
  const ranked = useMemo(() => riskLeaderboard(threats, limit), [threats, limit]);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            Composite Risk Leaderboard
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Top {limit} threats ranked by CVSS + EPSS + severity + active status (0-100)
          </p>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
          No threats to rank yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {ranked.map((t, i) => {
            const tier = riskTier(t.riskScore);
            return (
              <Link
                key={t.id}
                to={`/threats/${t.id}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/40 transition-colors group"
              >
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${tier.bg} border`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                    {t.cve_id && <span className="font-mono">{t.cve_id}</span>}
                    {t.cvss_score > 0 && <span>· CVSS {t.cvss_score}</span>}
                    {t.epss_score > 0 && <span>· EPSS {(t.epss_score * 100).toFixed(0)}%</span>}
                    {t.source && <span>· {t.source}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <SeverityBadge severity={t.severity} />
                  <StatusBadge status={t.status} />
                  <div className="flex items-center gap-2 w-28">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${t.riskScore}%`, background: tier.color }}
                      />
                    </div>
                    <span className="text-sm font-bold tabular-nums w-7 text-right" style={{ color: tier.color }}>
                      {t.riskScore}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
