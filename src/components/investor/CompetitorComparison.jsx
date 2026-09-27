import React from "react";
import { CheckCircle2, XCircle, Minus, Trophy } from "lucide-react";

const competitors = [
  {
    name: "ThreatPulse",
    isUs: true,
    segment: "SMB / Mid-market / Air-gapped",
    price: "$399–$7,500/mo · $150k/yr self-hosted",
    selfHosted: true,
    portfolioMatch: true,
    darkWeb: true,
    workflow: true,
    execBriefings: true,
  },
  {
    name: "Flare",
    segment: "SMB / Mid-market",
    price: "$417–$2,500/mo",
    selfHosted: false,
    portfolioMatch: false,
    darkWeb: true,
    workflow: false,
    execBriefings: false,
  },
  {
    name: "WhiteIntel",
    segment: "SMB / Mid-market",
    price: "$200+/mo",
    selfHosted: false,
    portfolioMatch: false,
    darkWeb: true,
    workflow: false,
    execBriefings: false,
  },
  {
    name: "Recorded Future",
    segment: "Enterprise / Gov",
    price: "$100k+/yr",
    selfHosted: false,
    portfolioMatch: false,
    darkWeb: true,
    workflow: false,
    execBriefings: true,
  },
  {
    name: "Mandiant / Google",
    segment: "Enterprise / Gov",
    price: "$100k+/yr",
    selfHosted: false,
    portfolioMatch: false,
    darkWeb: true,
    workflow: false,
    execBriefings: true,
  },
  {
    name: "Bitsight",
    segment: "Enterprise",
    price: "Quote-based",
    selfHosted: false,
    portfolioMatch: false,
    darkWeb: true,
    workflow: false,
    execBriefings: false,
  },
];

const features = [
  { key: "selfHosted", label: "Self-hosted / air-gapped" },
  { key: "portfolioMatch", label: "Portfolio-relevant CVE matching (CPE)" },
  { key: "darkWeb", label: "Dark-web credential monitoring" },
  { key: "workflow", label: "Structured triage workflow + SLA" },
  { key: "execBriefings", label: "Automated executive briefings" },
];

function Cell({ value, isUs }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <CheckCircle2 className={`w-4 h-4 ${isUs ? "text-primary" : "text-emerald-500"}`} />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <XCircle className="w-4 h-4 text-muted-foreground/40" />
      </div>
    );
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export default function CompetitorComparison() {
  return (
    <div>
      <div className="mb-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Competitive Landscape</span>
        <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight font-heading">
          Where ThreatPulse wins
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          ThreatPulse is the only platform in its price band that ships self-hosted, matches CVEs to each customer's
          product portfolio, and wraps it in a structured analyst workflow. Enterprise suites cost 10–50× more and
          can't reach air-gapped customers.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-secondary/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-xs uppercase whitespace-nowrap">Platform</th>
              <th className="text-left px-4 py-3 font-medium text-xs uppercase whitespace-nowrap">Target Segment</th>
              <th className="text-left px-4 py-3 font-medium text-xs uppercase whitespace-nowrap">Pricing</th>
              {features.map((f) => (
                <th key={f.key} className="text-center px-3 py-3 font-medium text-xs uppercase whitespace-nowrap">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {competitors.map((c) => (
              <tr
                key={c.name}
                className={`border-t border-border ${c.isUs ? "bg-primary/5" : ""}`}
              >
                <td className="px-4 py-3 font-semibold whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    {c.isUs && <Trophy className="w-3.5 h-3.5 text-primary" />}
                    {c.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.segment}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.price}</td>
                {features.map((f) => (
                  <td key={f.key} className="px-3 py-3 text-center">
                    <Cell value={c[f.key]} isUs={c.isUs} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
        Sources: Bitsight, Flare, WhiteIntel, and UpGuard competitor analyses (2026). Pricing reflects publicly available
        data and industry estimates; enterprise quotes vary by deployment scope.
      </p>
    </div>
  );
}