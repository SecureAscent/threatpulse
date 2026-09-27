import React from "react";
import {
  Ticket,
  FileText,
  Database,
  Lock,
  Mail,
  Rss,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

const integrations = [
  {
    icon: Ticket,
    name: "Jira",
    desc: "Auto-create remediation tickets from high-severity threats and sync status bidirectionally.",
    tag: "Ticketing",
  },
  {
    icon: FileText,
    name: "Confluence",
    desc: "Publish threat intelligence summaries and remediation playbooks directly to Confluence pages.",
    tag: "Documentation",
    isNew: true,
  },
  {
    icon: Database,
    name: "Cybellum",
    desc: "Cross-reference CVEs against your SBOM and product catalog for blast-radius mapping.",
    tag: "SBOM / VRM",
  },
  {
    icon: Lock,
    name: "H-ISAC",
    desc: "Healthcare-sector threat bulletins and IOC feeds for regulated industry compliance.",
    tag: "Healthcare Intel",
  },
  {
    icon: Mail,
    name: "Brevo",
    desc: "Deliver threat alert emails and executive digest notifications to stakeholders.",
    tag: "Notifications",
  },
  {
    icon: Rss,
    name: "18+ Threat Feeds",
    desc: "CISA KEV, NVD, H-ISAC, Dark Reading, Krebs, Mandiant, CrowdStrike and more — ingested every 2 hours.",
    tag: "Feeds",
  },
];

export default function NativeIntegrations() {
  return (
    <div>
      <div className="mb-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Native Integrations</span>
        <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight font-heading">
          Plugs into the tools your team already uses
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          ThreatPulse ships with first-class connectors for the security stack — no custom glue code required.
          Each integration is configurable per organization and testable from the admin dashboard.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {integrations.map((i) => {
          const Icon = i.icon;
          return (
            <div
              key={i.name}
              className="relative rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors"
            >
              {i.isNew && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground">
                  New
                </span>
              )}
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm">{i.name}</h3>
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  {i.tag}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{i.desc}</p>
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 mt-5">
        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">
          <strong className="text-foreground">Available in both SaaS and self-hosted deployments.</strong> The
          self-hosted Docker stack ships with the same integration framework, so regulated and air-gapped
          customers get identical connector support without external dependencies.
        </p>
      </div>
    </div>
  );
}