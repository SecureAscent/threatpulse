import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plug, Radio, Bug, Ticket, Boxes, CheckCircle2, XCircle, ChevronDown, Shield } from "lucide-react";
import ConfluenceSetup from "@/components/integrations/ConfluenceSetup";
import CybellumSetup from "@/components/integrations/CybellumSetup";
import JiraWebhookSetup from "@/components/integrations/JiraWebhookSetup";

export default function Integrations() {
  const [expanded, setExpanded] = useState(null);

  // Fetch Jira webhook status so the card reflects real connection state
  const { data: jiraSetup } = useQuery({
    queryKey: ["jira-webhook-setup"],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke("getJiraWebhookSetup", {});
        return res.data;
      } catch {
        return null;
      }
    },
  });

  const jiraConnected = !!jiraSetup?.token;

  const integrations = [
    { name: "CISA KEV", desc: "Known Exploited Vulnerabilities catalog", icon: Radio, status: "active", tag: "Public Feed", to: "/feeds" },
    { name: "NVD", desc: "NIST National Vulnerability Database", icon: Bug, status: "active", tag: "API Key", to: "/feeds" },
    {
      name: "Jira",
      desc: "Create tickets from threats and auto-mitigate them when tickets close. Each organization connects its own Jira instance.",
      icon: Ticket,
      status: jiraConnected ? "active" : "off",
      tag: jiraConnected ? "Connected" : "Admin setup required",
      to: "/jira-tickets",
      expandable: "jira-webhook",
    },
    { name: "Cybellum", desc: "SBOM & product inventory intelligence (per-tenant)", icon: Boxes, status: "off", tag: "Per-tenant", expandable: "cybellum" },
  ];

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
          const isOpen = expanded === i.expandable;
          return (
            <div key={i.name}>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-1.5">
                        {i.name}
                        {i.expandable && <Shield className="w-3 h-3 text-muted-foreground" title="Admin-managed" />}
                      </h3>
                      <p className="text-xs text-muted-foreground">{i.tag}</p>
                    </div>
                  </div>
                  {active ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-muted-foreground" />}
                </div>
                <p className="text-sm text-muted-foreground mb-4">{i.desc}</p>
                {i.expandable ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setExpanded(isOpen ? null : i.expandable)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-input text-muted-foreground hover:bg-accent ${isOpen ? "bg-primary/10 text-primary border-primary/20" : ""}`}
                    >
                      {isOpen ? "Hide setup" : "Configure"}
                      <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    <Link to={i.to} className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      View tickets
                    </Link>
                  </div>
                ) : i.to ? (
                  <Link
                    to={i.to}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active ? "bg-primary/10 text-primary hover:bg-primary/20" : "border border-input text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {active ? "Manage" : "Configure"}
                  </Link>
                ) : (
                  <span className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium border border-input text-muted-foreground opacity-60 cursor-not-allowed">
                    Coming soon
                  </span>
                )}
              </div>
              {i.expandable && isOpen && (
                <div className="mt-3">
                  {i.expandable === "jira-webhook" && <JiraWebhookSetup />}
                  {i.expandable === "cybellum" && <CybellumSetup />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">User-connected</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <ConfluenceSetup />
        </div>
      </div>
    </div>
  );
}