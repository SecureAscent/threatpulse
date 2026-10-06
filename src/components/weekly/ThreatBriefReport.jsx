import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, AlertCircle, FileText } from "lucide-react";
import {
  BRIEF_PERIODS,
  periodHeading,
  periodVolumeLabel,
  filterByDays,
  computeBriefStats,
  priorityVulns,
  exposureMatches,
} from "@/lib/threatBriefData";
import BriefStatCards from "@/components/weekly/brief/BriefStatCards";
import BriefSectionHeader from "@/components/weekly/brief/BriefSectionHeader";
import BriefLandscape from "@/components/weekly/brief/BriefLandscape";
import BriefPriorityQueue from "@/components/weekly/brief/BriefPriorityQueue";
import BriefExposureActions from "@/components/weekly/brief/BriefExposureActions";

const SCHEMA = {
  type: "object",
  properties: {
    executive_summary: { type: "string" },
    landscape_bullets: { type: "array", items: { type: "string" } },
    attack_surface_title: { type: "string" },
    attack_surface_description: { type: "string" },
    exposure_items: { type: "array", items: { type: "string" } },
    action_immediate: { type: "string" },
    action_this_week: { type: "string" },
    action_ongoing: { type: "string" },
    key_takeaway: { type: "string" },
  },
};

function buildPrompt(ctx) {
  return [
    "You are the chief intelligence analyst at ThreatPulse Intel writing a branded executive cyber threat brief",
    "for C-suite leadership. Use ONLY the real data below — never invent CVEs or numbers.",
    "",
    "Return:",
    "- executive_summary: 3-4 sentence paragraph summarizing volume, critical vulns, CISA KEV adds, and the most urgent risks (name specific CVEs/products from the data).",
    "- landscape_bullets: 4-6 short bullet strings (no bullet prefix) covering volume, critical/high counts, KEV adds, notable exploitation, ransomware activity.",
    "- attack_surface_title: 2-4 word label for the primary attack surface this period (e.g. 'EDGE INFRASTRUCTURE', 'EDGE + IDENTITY').",
    "- attack_surface_description: 1-2 sentence explanation.",
    "- exposure_items: 3-5 short validation-priority bullet strings for the security team.",
    "- action_immediate / action_this_week / action_ongoing: one short actionable sentence each.",
    "- key_takeaway: 2-3 sentence closing statement for leadership.",
    "",
    "DATA:",
    JSON.stringify(ctx, null, 2),
  ].join("\n");
}

export default function ThreatBriefReport({ threats, products, period, onPeriodChange }) {
  const [narrative, setNarrative] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inRange = useMemo(() => filterByDays(threats, period.days), [threats, period.days]);
  const stats = useMemo(() => computeBriefStats(inRange), [inRange]);
  const vulns = useMemo(() => priorityVulns(inRange), [inRange]);
  const exposure = useMemo(() => exposureMatches(inRange, products), [inRange, products]);
  const heading = periodHeading(period.key);

  const generate = async () => {
    if (!inRange.length) {
      setNarrative(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: buildPrompt({
          period: period.label,
          stats,
          top_vulnerabilities: vulns,
          ransomware_names: [...new Set(inRange.filter((t) => t.type === "Ransomware").map((t) => t.title))].slice(0, 6),
          portfolio_match_count: exposure.count,
          portfolio_matches: exposure.matched.slice(0, 8).map((t) => ({ cve: t.cve_id, title: t.title })),
        }),
        response_json_schema: SCHEMA,
      });
      setNarrative(result);
    } catch (err) {
      setError(err.message || "Failed to generate brief");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
  }, [period.key, threats, products]); // eslint-disable-line react-hooks/exhaustive-deps

  const exposureHeadline =
    exposure.count > 0 ? `${exposure.count} Portfolio Match${exposure.count === 1 ? "" : "es"} Found` : "No Confirmed Company-Specific Exposure";

  return (
    <div id="threat-brief-report" className="rounded-xl overflow-hidden border border-[#1c3350] bg-[#0a1526] mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-[#0f2135] border-b border-[#1c3350]">
        <div className="flex items-center gap-2 text-slate-300">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wide">ThreatPulse Intel Brief</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-[#1c3350] bg-[#0a1526] p-0.5">
            {BRIEF_PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => onPeriodChange(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period.key === p.key ? "bg-cyan-500 text-slate-900" : "text-slate-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={generate}
            disabled={loading || !inRange.length}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1c3350] text-xs font-medium text-slate-300 hover:bg-[#132941] disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Regenerate
          </button>
        </div>
      </div>

      {!inRange.length ? (
        <div className="py-16 text-center text-slate-400 text-sm">No threats in this period yet.</div>
      ) : (
        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-400">
              THREATPULSE INTEL // {period.label.toUpperCase()} THREAT BRIEF //
            </p>
            <p className="text-[11px] text-slate-500">
              ThreatPulse Intel • threatpulseintel.com • {heading} • Executive Intelligence
            </p>
          </div>

          <div className="bg-[#0f2135] border-l-4 border-cyan-400 rounded px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-400">ThreatPulse Intel / Cyber Threat Intelligence</p>
            <h2 className="text-2xl font-bold text-white mt-1">{period.label} Cyber Threat Intelligence Brief</h2>
            <p className="text-xs font-semibold text-slate-400 mt-1 uppercase">{heading}</p>
          </div>

          <BriefStatCards stats={stats} volumeLabel={periodVolumeLabel(period.days)} />

          {loading ? (
            <div className="flex items-center justify-center py-14 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Analyzing {inRange.length} threats…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 rounded-lg border border-rose-500/30 bg-rose-500/5 text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ) : narrative ? (
            <>
              <div className="rounded-lg overflow-hidden border border-[#1c3350]">
                <BriefSectionHeader label="2-Minute Read" title="Executive Summary" />
                <div className="bg-[#132941] border-l-4 border-cyan-400 px-4 py-3.5">
                  <p className="text-sm text-slate-200 leading-relaxed">{narrative.executive_summary}</p>
                </div>
              </div>

              <div className="rounded-lg overflow-hidden border border-[#1c3350]">
                <BriefSectionHeader label="What Changed" title="Threat Landscape" />
                <BriefLandscape
                  bullets={narrative.landscape_bullets || []}
                  attackSurface={{ title: narrative.attack_surface_title, description: narrative.attack_surface_description }}
                />
              </div>

              <div className="rounded-lg overflow-hidden border border-[#1c3350]">
                <BriefSectionHeader label="Priority Queue" title="Critical Vulnerabilities" />
                <BriefPriorityQueue vulns={vulns} />
              </div>

              <div className="rounded-lg overflow-hidden border border-[#1c3350]">
                <BriefSectionHeader label="Decision Support" title="Exposure & Response" />
                <BriefExposureActions
                  exposureItems={narrative.exposure_items || []}
                  exposureHeadline={exposureHeadline}
                  actions={{ immediate: narrative.action_immediate, thisWeek: narrative.action_this_week, ongoing: narrative.action_ongoing }}
                />
              </div>

              <div className="rounded-lg overflow-hidden border border-[#1c3350]">
                <BriefSectionHeader label="Key Takeaway" title="Leadership Focus" />
                <div className="bg-[#0f2135] px-4 py-4">
                  <p className="text-sm font-semibold text-white leading-relaxed">{narrative.key_takeaway}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}