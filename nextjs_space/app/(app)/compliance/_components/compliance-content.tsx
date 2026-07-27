'use client';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, RefreshCw, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { FadeIn } from '@/components/ui/animate';
import { toast } from 'sonner';

interface ControlStat {
  controlId: string;
  controlName: string;
  threatCount: number;
  covered: boolean;
}
interface FrameworkSummary {
  framework: string;
  label: string;
  totalControls: number;
  coveredControls: number;
  coveragePercent: number;
  controls: ControlStat[];
  gaps: ControlStat[];
}

const coverageColor = (pct: number) => (pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500');
const coverageText = (pct: number) => (pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-yellow-600' : 'text-red-500');

export default function ComplianceContent() {
  const [frameworks, setFrameworks] = useState<FrameworkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/compliance');
      const data = await res.json();
      setFrameworks(data?.frameworks ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/compliance/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Sync failed');
      toast.success(`Synced ${data.threatsProcessed} threats — ${data.tagsCreated} control mappings`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const exportCsv = () => {
    // Trigger a download of the gap report CSV.
    window.open('/api/compliance/export', '_blank');
  };

  // Flatten controls across frameworks for the table, filtered by tab.
  const tableRows = useMemo(() => {
    const rows: { framework: string; label: string; control: ControlStat }[] = [];
    for (const fw of frameworks) {
      if (activeTab !== 'ALL' && fw.framework !== activeTab) continue;
      for (const c of fw.controls) rows.push({ framework: fw.framework, label: fw.label, control: c });
    }
    return rows;
  }, [frameworks, activeTab]);

  const hasAnyCoverage = frameworks.some((f) => f.coveredControls > 0);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Compliance Mapping</h1>
              <p className="text-sm text-muted-foreground">How your threats map to security framework controls</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportCsv}>
              <Download className="w-3.5 h-3.5" /> Export Gap Report
            </Button>
            <Button size="sm" className="gap-1.5 h-9" onClick={sync} disabled={syncing}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync Controls
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Framework coverage cards */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            [1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)
          ) : (
            frameworks.map((fw) => (
              <Card key={fw.framework} className="border-border/50">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold">{fw.label}</p>
                    <span className={`text-lg font-display font-bold ${coverageText(fw.coveragePercent)}`}>
                      {fw.coveragePercent}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${coverageColor(fw.coveragePercent)} transition-all`}
                      style={{ width: `${fw.coveragePercent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {fw.coveredControls} / {fw.totalControls} controls covered
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </FadeIn>

      {!loading && !hasAnyCoverage && (
        <FadeIn>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-4 px-5 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                No controls are mapped yet. Click <span className="font-medium text-foreground">Sync Controls</span> to
                auto-tag your threats against the frameworks based on severity, KEV status, and MITRE ATT&amp;CK coverage.
              </p>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Controls table */}
      <FadeIn delay={0.1}>
        <Card className="border-border/50">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Control Coverage</CardTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-8">
                <TabsTrigger value="ALL" className="text-xs h-6">All</TabsTrigger>
                {frameworks.map((fw) => (
                  <TabsTrigger key={fw.framework} value={fw.framework} className="text-xs h-6">{fw.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-6">
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
              </div>
            ) : tableRows.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">No controls to display.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Framework</TableHead>
                    <TableHead>Control ID</TableHead>
                    <TableHead>Control Name</TableHead>
                    <TableHead className="text-center">Threats Mapped</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((r) => (
                    <TableRow key={`${r.framework}:${r.control.controlId}`}>
                      <TableCell className="text-sm text-muted-foreground">{r.label}</TableCell>
                      <TableCell className="font-mono text-xs">{r.control.controlId}</TableCell>
                      <TableCell className="text-sm">{r.control.controlName}</TableCell>
                      <TableCell className="text-center text-sm font-medium">{r.control.threatCount}</TableCell>
                      <TableCell>
                        {r.control.covered ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Covered
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20 gap-1">
                            <AlertCircle className="w-3 h-3" /> Gap
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
