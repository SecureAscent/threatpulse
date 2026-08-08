'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { riskLeaderboard, riskTier } from '@/lib/risk-analytics';
import type { ThreatLike } from '@/lib/risk-analytics';
import { Badge } from '@/components/ui/badge';
import { Trophy, ChevronRight } from 'lucide-react';

const severityBadge: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

export default function RiskLeaderboard({ threats = [], limit = 15 }: { threats?: ThreatLike[]; limit?: number }) {
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
            Top {limit} threats ranked by CVSS + EPSS + KEV + severity (0-100)
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
                href={`/threats/${t.id}`}
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
                    {t.threatId && <span className="font-mono">{t.threatId}</span>}
                    {t.cvssScore ? <span>· CVSS {t.cvssScore}</span> : null}
                    {t.epssScore ? <span>· EPSS {(t.epssScore * 100).toFixed(0)}%</span> : null}
                    {t.source ? <span>· {t.source}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge className={`text-[10px] font-mono px-2 py-0.5 ${severityBadge[(t.severity || '').toUpperCase()] ?? ''}`}>
                    {t.severity}
                  </Badge>
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
