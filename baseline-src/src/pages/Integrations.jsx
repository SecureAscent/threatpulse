import React from "react";
import { Link } from "react-router-dom";
import { Plug, Radio, Bug, Ticket, Boxes, CheckCircle2, XCircle } from "lucide-react";

const integrations = [
  { name: "CISA KEV", desc: "Known Exploited Vulnerabilities catalog", icon: Radio, status: "active", tag: "Public Feed", to: "/feeds" },
  { name: "NVD", desc: "NIST National Vulnerability Database", icon: Bug, status: "active", tag: "API Key", to: "/feeds" },
  { name: "Jira", desc: "Create tickets from high-severity threats", icon: Ticket, status: "off", tag: "Not Connected", to: "/jira-tickets" },
  { name: "Cybellum", desc: "SBOM & product inventory intelligence", icon: Boxes, status: "off", tag: "Not Connected", to: "/integrations" },
];

export default function Integrations() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6 flex items-center gap-2">
        <Plug className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">Connected data sources and tooling</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {integrations.map((i) => {
          const Icon = i.icon;
          const active = i.status === "active";
          return (
            <div key={i.name} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{i.name}</h3>
                    <p className="text-xs text-muted-foreground">{i.tag}</p>
                  </div>
                </div>
                {active ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground mb-4">{i.desc}</p>
              <Link
                to={i.to}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-primary/10 text-primary hover:bg-primary/20" : "border border-input text-muted-foreground hover:bg-accent"
                }`}
              >
                {active ? "Manage" : "Configure"}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}