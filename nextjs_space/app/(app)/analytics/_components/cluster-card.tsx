'use client';
import { useState } from 'react';
import Link from 'next/link';
import { summarizeCluster } from '@/lib/threat-correlation';
import type { ThreatCluster } from '@/lib/threat-correlation';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Shield, Package, Target, Link2 } from 'lucide-react';

const severityBadge: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const strengthConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  strong: { label: 'Strong', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500' },
  medium: { label: 'Medium', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-500' },
  weak: { label: 'Weak', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500' },
};

const attrBadge: Record<string, string> = {
  cve: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  product: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  technique: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  campaign: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

export default function ClusterCard({ cluster }: { cluster: ThreatCluster }) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeCluster(cluster);
  const strength = strengthConfig[summary.maxStrength] || strengthConfig.weak;

  const threatCount = cluster.threats.length;
  const criticalCount = cluster.threats.filter((t) => (t.severity || '').toUpperCase() === 'CRITICAL').length;
  const activeCount = cluster.threats.filter((t) => t.status !== 'MITIGATED').length;
  const displayedThreats = expanded ? cluster.threats : cluster.threats.slice(0, 3);

  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${strength.bg}`}>
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm line-clamp-1">{summary.label}</h3>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border ${strength.bg} ${strength.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${strength.dot}`} />
                {strength.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span>{threatCount} threats</span>
              {criticalCount > 0 && <span className="text-red-500">{criticalCount} critical</span>}
              {activeCount > 0 && <span className="text-orange-500">{activeCount} active</span>}
              <span>{summary.edgeCount} links</span>
            </div>
            <div className="flex h-1 rounded-full overflow-hidden bg-muted/60 mt-2 max-w-[200px]">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => {
                const count = cluster.threats.filter((t) => (t.severity || '').toUpperCase() === s).length;
                const pct = threatCount ? (count / threatCount) * 100 : 0;
                const colors: Record<string, string> = { CRITICAL: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-emerald-500' };
                return pct > 0 && <div key={s} className={colors[s]} style={{ width: `${pct}%` }} />;
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 space-y-2 border-b border-border/50">
        {summary.sharedCves.length > 0 && (
          <div className="flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1.5">
              {summary.sharedCves.slice(0, 5).map((cve) => (
                <span key={cve} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${attrBadge.cve}`}>{cve}</span>
              ))}
            </div>
          </div>
        )}
        {summary.sharedProducts.length > 0 && (
          <div className="flex items-start gap-2">
            <Package className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1.5">
              {summary.sharedProducts.slice(0, 5).map((p) => (
                <span key={p} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${attrBadge.product}`}>{p}</span>
              ))}
            </div>
          </div>
        )}
        {summary.sharedTechniques.length > 0 && (
          <div className="flex items-start gap-2">
            <Target className="w-3.5 h-3.5 text-teal-500 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1.5">
              {summary.sharedTechniques.slice(0, 4).map((tech) => (
                <span key={tech.label} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${attrBadge.technique}`}>
                  {tech.label}<span className="ml-1 opacity-60">×{tech.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="divide-y divide-border/50">
        {displayedThreats.map((t) => (
          <Link key={t.id} href={`/threats/${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-accent/40 transition-colors">
            <Badge className={`text-[10px] font-mono px-2 py-0.5 ${severityBadge[(t.severity || '').toUpperCase()] ?? ''}`}>{t.severity}</Badge>
            <span className="text-sm truncate flex-1">{t.title}</span>
            {t.threatId && <span className="text-xs font-mono text-muted-foreground shrink-0">{t.threatId}</span>}
            <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>

      {threatCount > 3 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-center gap-1 px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors border-t border-border/50"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          {expanded ? 'Show less' : `Show ${threatCount - 3} more`}
        </button>
      )}
    </div>
  );
}
