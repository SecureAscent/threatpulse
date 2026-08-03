import React from "react";
import { Rss, Search, Bell, FileText, ShieldCheck } from "lucide-react";

const steps = [
  {
    icon: Rss,
    title: "Collection",
    desc: "ThreatPulse continuously ingests intelligence from 18 authoritative sources — including CISA KEV, NVD, H-ISAC, and leading security publications — every few minutes.",
  },
  {
    icon: Search,
    title: "Enrichment & Correlation",
    desc: "Each item is enriched with CVE metadata, CVSS scoring, and affected product mapping, then correlated against your portfolio to prioritize what matters.",
  },
  {
    icon: Bell,
    title: "Alerting",
    desc: "Critical and high-severity threats matching your watchlist trigger real-time alerts so analysts can respond within SLA targets.",
  },
  {
    icon: FileText,
    title: "Triage & Workflow",
    desc: "Analysts advance threats through New → Analyzing → Mitigated, capturing response times and notes for audit and metrics.",
  },
  {
    icon: ShieldCheck,
    title: "Reporting",
    desc: "Executive briefs and operational metrics surface trend lines, response performance, and SLA compliance to leadership.",
  },
];

export default function HowItWorks() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">How It Works</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The ThreatPulse intelligence pipeline, from collection to reporting
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="rounded-xl border border-border bg-card p-6 flex gap-4">
              <div className="shrink-0 w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-muted-foreground">0{i + 1}</span>
                  <h3 className="font-semibold">{s.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}