'use client';
import { useEffect, useState, useCallback } from 'react';
import { FadeIn } from '@/components/ui/animate';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Loader2 } from 'lucide-react';
import RiskLeaderboard from './risk-leaderboard';
import RiskScatterPlot from './risk-scatter-plot';
import CveProductMatrix from './cve-product-matrix';
import ClusterCard from './cluster-card';
import { buildCorrelationGraph, findClusters } from '@/lib/threat-correlation';
import type { ThreatLike } from '@/lib/risk-analytics';

export default function AnalyticsContent() {
  const [threats, setThreats] = useState<ThreatLike[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreats = useCallback(async () => {
    try {
      const res = await fetch('/api/threats');
      if (res.ok) {
        const data = await res.json();
        setThreats(data?.threats ?? []);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchThreats(); }, [fetchThreats]);

  const clusters = (() => {
    if (threats.length < 2) return [];
    const edges = buildCorrelationGraph(threats);
    return findClusters(threats, edges);
  })();

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <FadeIn>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Advanced Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Composite risk scoring, CVE-product correlation, and threat clustering across {threats.length} threats.
          </p>
        </div>
      </FadeIn>

      {threats.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-10 pb-10 text-center">
            <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">No threats available for analysis yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <RiskLeaderboard threats={threats} limit={15} />
          <RiskScatterPlot threats={threats} />
          <CveProductMatrix threats={threats} />

          {clusters.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Threat Correlation Clusters ({clusters.length})</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {clusters.slice(0, 6).map((cluster, i) => (
                  <ClusterCard key={i} cluster={cluster} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
