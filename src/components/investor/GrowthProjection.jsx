import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  Database,
  Zap,
  Filter,
  TrendingUp,
  Clock,
  DollarSign,
  Target,
  Loader2,
  RefreshCw,
  Workflow,
} from "lucide-react";

// ─── Per-customer value model constants (business assumptions) ───
const RELEVANT_PCT = 0.12;       // industry avg portfolio relevance for mid-size stack
const TRIAGE_MIN = 20;            // L1 manual triage min/threat (industry standard: Dropzone AI, D3 Security)
const WORK_DAYS = 250;            // working days per year
const ANALYST_HOURLY = 80;        // loaded SOC analyst cost (salary $80-120k + benefits/overhead)

// ─── Integration automation value (Jira/ServiceNow/Cybellum/workflow) ───
const ACTIONABLE_PCT = 0.55;     // ~55% of relevant threats are actionable (aligns w/ critical-high rate)
const TICKET_MIN = 6;             // min saved per actionable threat via auto-ticketing (Jira/ServiceNow)
const VRM_MIN = 12;               // min saved per CVE via auto-correlation to SBOM (Cybellum/VRM)
const WORKFLOW_MIN = 4;           // min saved per threat via auto-routing/escalation/SLA tracking

// ─── Pricing (business model assumptions) ───
const SMB_PRICE = 4788;           // $399/mo
const ENT_PRICE = 90000;         // $7,500/mo
const SELF_PRICE = 150000;       // /yr license

// ─── 5-year customer ramp (conservative GTM assumptions) ───
const CUSTOMER_RAMP = [
  { year: "Year 1", smb: 5, ent: 0, self: 0, label: "Pre-seed · founder-led" },
  { year: "Year 2", smb: 25, ent: 1, self: 0, label: "First GTM hire" },
  { year: "Year 3", smb: 100, ent: 5, self: 1, label: "$1M ARR milestone → Seed" },
  { year: "Year 4", smb: 300, ent: 15, self: 2, label: "Scale GTM" },
  { year: "Year 5", smb: 700, ent: 40, self: 5, label: "Series A readiness" },
];

const fmtMoney = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}k`;
  return `$${n}`;
};

export default function GrowthProjection() {
  const { data: metrics, isLoading, isError, refetch } = useQuery({
    queryKey: ["investor-metrics"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getInvestorMetrics", {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // refresh every 5 min
  });

  // Derive per-customer value from real daily ingestion
  const model = useMemo(() => {
    const dailyIngestion = metrics?.dailyIngestion || 0;
    const threatsPerCustomerDay = Math.round(dailyIngestion * RELEVANT_PCT);
    const dailyTriageHours = (threatsPerCustomerDay * TRIAGE_MIN) / 60;
    const annualHoursSaved = Math.round(dailyTriageHours * WORK_DAYS);
    const annualValuePerCustomer = annualHoursSaved * ANALYST_HOURLY;
    const roiMultiple = SMB_PRICE > 0 ? Math.round(annualValuePerCustomer / SMB_PRICE) : 0;

    // Integration automation value (additive to triage)
    const actionableThreatsDay = threatsPerCustomerDay * ACTIONABLE_PCT;
    const dailyIntegrationMin =
      actionableThreatsDay * TICKET_MIN +
      threatsPerCustomerDay * VRM_MIN +
      threatsPerCustomerDay * WORKFLOW_MIN;
    const dailyIntegrationHours = dailyIntegrationMin / 60;
    const annualIntegrationHours = Math.round(dailyIntegrationHours * WORK_DAYS);
    const annualIntegrationValue = annualIntegrationHours * ANALYST_HOURLY;
    const totalAnnualValue = annualValuePerCustomer + annualIntegrationValue;
    const totalRoiMultiple = SMB_PRICE > 0 ? Math.round(totalAnnualValue / SMB_PRICE) : 0;

    const projection = CUSTOMER_RAMP.map((row) => {
      const arr = row.smb * SMB_PRICE + row.ent * ENT_PRICE + row.self * SELF_PRICE;
      const customers = row.smb + row.ent + row.self;
      const hoursSaved = customers * annualHoursSaved;
      return { ...row, arr, customers, hoursSaved };
    });

    const milestoneYear = projection.find((p) => p.arr >= 1_000_000);
    const chartData = projection.map((p) => ({ year: p.year, ARR: Math.round(p.arr / 1000) }));

    return {
      dailyIngestion,
      threatsPerCustomerDay,
      dailyTriageHours,
      annualHoursSaved,
      annualValuePerCustomer,
      roiMultiple,
      annualIntegrationHours,
      annualIntegrationValue,
      totalAnnualValue,
      totalRoiMultiple,
      projection,
      milestoneYear,
      chartData,
    };
  }, [metrics]);

  const realMetrics = metrics
    ? [
        { icon: Activity, label: "Daily Ingestion", value: `${metrics.dailyIngestion}`, unit: "threats/day", desc: `Across ${metrics.sources} active feeds` },
        { icon: Database, label: "Intelligence Sources", value: `${metrics.sources}`, unit: "feeds", desc: "CISA, NVD, H-ISAC, RSS" },
        { icon: Zap, label: "Critical / High", value: `${metrics.criticalHighPct}%`, unit: "of threats", desc: "The actionable workload" },
        { icon: Filter, label: "CVE Enrichment", value: `${metrics.cveEnrichmentPct}%`, unit: "auto-scored", desc: "CVSS + EPSS at ingest" },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="space-y-10">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Live Platform Data</span>
          <h3 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight font-heading">Proven throughput, not slideware</h3>
          <div className="flex items-center gap-2 mt-5 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Pulling live metrics from the ThreatPulse database…</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 h-32 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !metrics || metrics.error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">Couldn't load live platform metrics right now.</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section 1: Real operational data */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Live Platform Data</span>
            <h3 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight font-heading">
              Proven throughput, not slideware
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Updated {new Date(metrics.generatedAt || Date.now()).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          These aren't projections — they're live metrics pulled directly from the ThreatPulse production database.
          {metrics.totalThreats} threats ingested across {metrics.sources} sources. This is the engine every paying
          customer plugs into.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {realMetrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-xl border border-border bg-card p-5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-bold tracking-tight font-heading mt-1">
                  {m.value} <span className="text-sm font-normal text-muted-foreground">{m.unit}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Per-customer value model */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4 lg:p-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Per-Customer Value Model</span>
        <h3 className="mt-1 text-lg font-bold tracking-tight font-heading">
          From real ingestion rate to dollars saved
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <ValueStep
            icon={Filter}
            label="Portfolio-relevant threats"
            value={`${model.threatsPerCustomerDay}/day`}
            desc={`${model.dailyIngestion} raw threats × ${RELEVANT_PCT * 100}% portfolio match rate`}
          />
          <ValueStep
            icon={Clock}
            label="Triage hours saved"
            value={`${model.annualHoursSaved.toLocaleString()}/yr`}
            desc={`${model.dailyTriageHours} hrs/day × ${WORK_DAYS} working days (at ${TRIAGE_MIN} min triage each)`}
          />
          <ValueStep
            icon={Workflow}
            label="Integration hours saved"
            value={`${model.annualIntegrationHours.toLocaleString()}/yr`}
            desc={`Auto-ticketing (Jira/ServiceNow), VRM correlation (Cybellum), workflow routing`}
          />
          <ValueStep
            icon={DollarSign}
            label="Total annual value"
            value={fmtMoney(model.totalAnnualValue)}
            desc={`$${ANALYST_HOURLY}/hr → ${model.totalRoiMultiple}× ROI at SMB price (triage + integration)`}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          Methodology: live ingestion rate ({model.dailyIngestion}/day) × industry-standard portfolio relevance
          ({RELEVANT_PCT * 100}%) × manual L1 triage time ({TRIAGE_MIN} min/threat — the cited industry standard from
          Dropzone AI & D3 Security benchmarks) × loaded SOC analyst rate (${ANALYST_HOURLY}/hr, salary $80-120k +
          benefits/overhead). Integration value is additive: auto-ticketing saves {TICKET_MIN} min per actionable
          threat (Jira/ServiceNow), SBOM auto-correlation saves {VRM_MIN} min per CVE (Cybellum/VRM), and workflow
          routing/escalation saves {WORKFLOW_MIN} min per threat. Every customer gets the same feed engine; their
          portfolio filter determines what surfaces.
        </p>
      </div>

      {/* Section 3: 5-year revenue projection */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Data-Backed Projection</span>
        <h3 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight font-heading">
          5-year revenue ramp
        </h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          A conservative adoption curve grounded in real per-customer value and solo-founder GTM constraints —
          not a top-down market share assumption.
        </p>

        {/* Chart */}
        <div className="rounded-xl border border-border bg-card p-5 mt-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Projected ARR ($k)</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={model.chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="arrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v) => [`$${v.toLocaleString()}k`, "ARR"]}
              />
              <Area type="monotone" dataKey="ARR" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#arrGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Projection table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                {["Year", "SMB", "Enterprise", "Self-Hosted", "Customers", "ARR", "Analyst Hrs Saved", "Phase"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium whitespace-nowrap text-xs uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.projection.map((p) => (
                <tr key={p.year} className={`border-t border-border ${p.arr >= 1_000_000 ? "bg-primary/5" : ""}`}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{p.year}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.smb}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.ent}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.self}</td>
                  <td className="px-4 py-3 font-medium">{p.customers}</td>
                  <td className="px-4 py-3 font-bold text-primary whitespace-nowrap">{fmtMoney(p.arr)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.hoursSaved.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{p.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Milestone callout */}
        {model.milestoneYear && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 mt-4">
            <Target className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">
              <strong className="text-foreground">$1M ARR reached in {model.milestoneYear.year}</strong> — the trigger
              for the $2.5–3.0M seed round. Year 5 projects{" "}
              <strong className="text-foreground">{fmtMoney(model.projection[4].arr)}</strong> across{" "}
              {model.projection[4].customers} customers, saving{" "}
              {(model.projection[4].hoursSaved / 1000).toFixed(0)}k analyst-hours annually — a defensible foundation
              for Series A.
            </p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            <strong className="text-foreground">Enterprise pricing upside:</strong> the projection uses a conservative
            flat $90k/yr per enterprise customer, but pricing starts at $7,500/mo and scales with monitored assets &
            identities — real deals will likely average $120k–180k/yr as customers expand scope. This makes the
            Year 5 ARR estimate conservative by design.
          </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ValueStep({ icon: Icon, label, value, desc }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold tracking-tight font-heading">{value}</p>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{desc}</p>
    </div>
  );
}