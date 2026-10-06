import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, Loader2, CalendarDays, Mail } from "lucide-react";
import { filterByRange } from "@/lib/executiveData";
import { batchMatchThreats } from "@/lib/productCpeMatch";
import { buildWeeklyBriefingCSV, downloadCsv } from "@/lib/csvExport";
import { BRIEF_PERIODS } from "@/lib/threatBriefData";
import BriefingSummary from "@/components/weekly/BriefingSummary";
import BriefingRow from "@/components/weekly/BriefingRow";
import SourceFilter from "@/components/weekly/SourceFilter";
import ThreatBriefReport from "@/components/weekly/ThreatBriefReport";

const TH = "text-left px-3 py-2.5 font-medium whitespace-nowrap";

export default function WeeklyBriefing() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(BRIEF_PERIODS[0]);
  const [exporting, setExporting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [updating, setUpdating] = useState(new Set());
  const [selectedSources, setSelectedSources] = useState(null);
  const [filterMode, setFilterMode] = useState("include");

  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "briefing"],
    queryFn: () => base44.entities.Threat.list("-created_date", 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "briefing"],
    queryFn: () => base44.entities.Product.list(),
  });

  const filtered = useMemo(() => filterByRange(threats, period.days * 24), [threats, period.days]);

  const allSources = useMemo(
    () => Array.from(new Set(filtered.map((t) => t.source).filter(Boolean))).sort(),
    [filtered]
  );

  const activeSources = useMemo(() => {
    if (selectedSources === null) return new Set(allSources);
    return selectedSources;
  }, [selectedSources, allSources]);

  const sourceFiltered = useMemo(() => {
    if (filterMode === "exclude") {
      return filtered.filter((t) => !t.source || !activeSources.has(t.source));
    }
    return filtered.filter((t) => !t.source || activeSources.has(t.source));
  }, [filtered, activeSources, filterMode]);

  const handleModeChange = (mode) => {
    setFilterMode(mode);
    setSelectedSources(mode === "exclude" ? new Set() : null);
  };

  const matchMap = useMemo(() => batchMatchThreats(sourceFiltered, products), [sourceFiltered, products]);

  const enriched = useMemo(
    () => sourceFiltered.map((t) => ({ ...t, _matchedProducts: matchMap[t.id] || [] })),
    [sourceFiltered, matchMap]
  );

  const summary = useMemo(() => ({
    total: enriched.length,
    matched: enriched.filter((t) => (matchMap[t.id] || []).length > 0).length,
    zeroDay: enriched.filter((t) => t.zero_day).length,
    discuss: enriched.filter((t) => t.discuss_monday).length,
    ticketCreated: enriched.filter((t) => t.ticket_created).length,
  }), [enriched, matchMap]);

  const toggleSource = (src) => {
    setSelectedSources((prev) => {
      const base = prev === null ? new Set(allSources) : new Set(prev);
      if (base.has(src)) base.delete(src); else base.add(src);
      return base;
    });
  };

  const toggleAllSources = () => {
    setSelectedSources((prev) => {
      const current = prev === null ? new Set(allSources) : prev;
      return current.size === allSources.length ? new Set() : new Set(allSources);
    });
  };

  const updateField = async (id, field, value) => {
    setUpdating((prev) => new Set(prev).add(id));
    queryClient.setQueryData(["threats", "briefing"], (old) =>
      (old || []).map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
    try {
      await base44.entities.Threat.update(id, { [field]: value });
    } catch {
      await queryClient.invalidateQueries({ queryKey: ["threats", "briefing"] });
    } finally {
      setUpdating((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleExportCsv = () => {
    const csv = buildWeeklyBriefingCSV(enriched);
    downloadCsv(`threatpulse-weekly-briefing-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await base44.functions.invoke("sendWeeklyExecutiveSummary", { days: period.days });
      setEmailStatus({ ok: true, delivered: res.data.delivered, subject: res.data.subject });
    } catch (err) {
      setEmailStatus({ ok: false, error: err.response?.data?.error || err.message || "Failed to send email" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { exportElementToPdf } = await import("@/lib/exportPdf");
      await exportElementToPdf(
        "weekly-briefing-table",
        `threatpulse-briefing-${period.key}.pdf`
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Weekly Vulnerability Briefing
          </h1>
          <p className="text-sm text-muted-foreground">
            {period.label} · {enriched.length} CVEs · {summary.matched} matched to portfolio · Generated{" "}
            {new Date().toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SourceFilter
            sources={allSources}
            selected={activeSources}
            onToggle={toggleSource}
            onToggleAll={toggleAllSources}
            mode={filterMode}
            onModeChange={handleModeChange}
          />
          <button
            onClick={handleSendEmail}
            disabled={sendingEmail}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Email
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Export PDF
          </button>
        </div>
      </div>

      {emailStatus && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${emailStatus.ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600" : "border-red-500/30 bg-red-500/5 text-red-500"}`}>
          {emailStatus.ok
            ? `✓ Email sent to ${emailStatus.delivered} recipient${emailStatus.delivered === 1 ? "" : "s"} — "${emailStatus.subject}"`
            : `✕ ${emailStatus.error}`}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : enriched.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No threats in this period</p>
          <p className="text-sm mt-1">Run the feed collector or widen the time range.</p>
        </div>
      ) : (
        <>
          <ThreatBriefReport threats={threats} products={products} period={period} onPeriodChange={setPeriod} />

          <BriefingSummary stats={summary} />

          <div id="weekly-briefing-table" className="mt-6 rounded-xl border border-border bg-card overflow-auto max-h-[70vh]">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-secondary text-xs text-muted-foreground uppercase sticky top-0 z-10">
                  <tr>
                    <th className={`${TH} sticky left-0 bg-secondary z-20`}>Date</th>
                    <th className={TH}>Tag</th>
                    <th className={TH}>Source</th>
                    <th className={TH}>CVE</th>
                    <th className="text-center px-3 py-2.5 font-medium">CVSS</th>
                    <th className={TH}>Severity</th>
                    <th className={TH}>Description</th>
                    <th className={TH}>Matched Products</th>
                    <th className="text-center px-3 py-2.5 font-medium">In VRM?</th>
                    <th className={TH}>Ticket Name</th>
                    <th className="text-center px-3 py-2.5 font-medium">Ticket?</th>
                    <th className="text-center px-3 py-2.5 font-medium">Discuss</th>
                    <th className="text-center px-3 py-2.5 font-medium">0-Day</th>
                    <th className={TH}>Notes</th>
                    <th className={TH}>Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((t) => (
                    <BriefingRow
                      key={t.id}
                      threat={t}
                      matchMap={matchMap}
                      updating={updating}
                      onToggle={(id, field, val) => updateField(id, field, val)}
                      onEdit={(id, field, val) => updateField(id, field, val)}
                    />
                  ))}
                </tbody>
              </table>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            ⚠ = product not enrolled in SBOM · Click any text cell to edit · Toggles save instantly · {enriched.length} rows
          </p>
        </>
      )}
    </div>
  );
}