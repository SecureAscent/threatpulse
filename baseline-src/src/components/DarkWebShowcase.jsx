import React from "react";
import { Link } from "react-router-dom";
import {
  Fingerprint,
  Eye,
  Database,
  ShieldAlert,
  KeyRound,
  MessageSquareWarning,
  ArrowRight,
  Check,
} from "lucide-react";

const freeItems = [
  "Ransomware group directory (active groups & TTPs)",
  "Recent victims claimed on onion leak sites",
  "Threat-actor origin & trend visualization",
];

const entItems = [
  "Commercial dark-web monitoring scoped to your domains & identities",
  "Credential-leak alerts (marketplace & paste-site chatter)",
  "Mention tracking across forums, Telegram, and marketplaces",
  "IOC enrichment with confidence scoring & MITRE ATT&CK mapping",
  "Dedicated analyst workflow: triage, evidence, compliance export",
];

export default function DarkWebShowcase() {
  return (
    <section className="max-w-7xl mx-auto px-6 pb-16">
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Header band */}
        <div className="relative px-7 lg:px-9 py-8 lg:py-10 border-b border-border bg-gradient-to-br from-primary/10 via-card to-card">
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20 mb-4">
              <Fingerprint className="w-3.5 h-3.5" />
              Flagship Capability
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
              Dark-Web &amp; Threat-Actor Intelligence
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
              ThreatPulse continuously monitors ransomware leak sites, dark-web marketplaces, and threat-actor
              communities — surfacing the indicators that matter to <span className="text-foreground font-medium">your</span> organization
              before they become incidents.
            </p>
          </div>
        </div>

        {/* Two-column tier comparison */}
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Free / preview */}
          <div className="p-7 lg:p-9">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                Included in Free — Live Preview
              </h3>
            </div>
            <ul className="mt-4 space-y-3">
              {freeItems.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/free"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              See it live <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Enterprise */}
          <div className="p-7 lg:p-9 bg-secondary/30">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm uppercase tracking-wide text-primary">
                Enterprise — Commercial Monitoring
              </h3>
            </div>
            <ul className="mt-4 space-y-3">
              {entItems.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/contact-sales?tier=Enterprise"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Request a Dark-Web Demo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Icon strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border">
          {[
            { icon: Database, label: "Ransomware.live feed", sub: "Groups, victims, TTPs" },
            { icon: KeyRound, label: "Credential-leak watch", sub: "Marketplace & paste sites" },
            { icon: MessageSquareWarning, label: "Chatter monitoring", sub: "Forums & Telegram" },
            { icon: Fingerprint, label: "Actor attribution", sub: "MITRE ATT&CK mapping" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="p-5 border-r last:border-r-0 border-border flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium leading-tight">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}