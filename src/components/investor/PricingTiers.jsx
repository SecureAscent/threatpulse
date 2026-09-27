import React from "react";
import { Zap, Users, Building2, Server, Check } from "lucide-react";

const tiers = [
  {
    icon: Zap,
    name: "Free",
    price: "$0",
    unit: "/mo",
    desc: "Individuals exploring threat intelligence",
    features: ["24h threat feed view", "1 portfolio product", "1 user seat", "Community support"],
    highlight: false,
  },
  {
    icon: Users,
    name: "Small to Midsize",
    price: "$399",
    unit: "/mo",
    desc: "Growing security teams needing full visibility",
    features: ["Full feed history & CVE DB", "25 portfolio products", "Blast-radius mapping", "5 seats, SLA timers"],
    highlight: true,
  },
  {
    icon: Building2,
    name: "Enterprise",
    price: "$7,500+",
    unit: "/mo",
    desc: "Organizations with compliance needs",
    features: ["Unlimited products & seats", "Dark-web monitoring", "SSO/SAML & RBAC", "Dedicated account manager"],
    highlight: false,
  },
  {
    icon: Server,
    name: "Self-Hosted",
    price: "$150k",
    unit: "/yr",
    desc: "Regulated & air-gapped environments",
    features: ["Docker stack in your env", "Full data sovereignty", "Air-gapped feed ingestion", "Annual license + support"],
    highlight: false,
  },
];

export default function PricingTiers() {
  return (
    <div>
      <div className="mb-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Business Model</span>
        <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight font-heading">
          Four tiers — from free to air-gapped
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          A land-and-expand funnel: free tier drives adoption, SMB delivers recurring revenue, enterprise unlocks
          dark-web upsell, and self-hosted captures regulated customers competitors can't reach.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiers.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.name}
              className={`relative rounded-xl border bg-card p-4 flex flex-col ${
                t.highlight ? "border-primary ring-1 ring-primary/30" : "border-border"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground whitespace-nowrap">
                  Most Popular
                </span>
              )}
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm leading-tight">{t.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.desc}</p>
              <div className="flex items-end gap-0.5 mt-3 mb-3">
                <span className="text-2xl font-bold tracking-tight font-heading">{t.price}</span>
                <span className="text-xs text-muted-foreground mb-1">{t.unit}</span>
              </div>
              <ul className="space-y-1.5 mt-auto">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}