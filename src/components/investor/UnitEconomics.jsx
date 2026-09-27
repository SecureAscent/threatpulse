import React from "react";
import { TrendingUp, DollarSign, Percent, Server } from "lucide-react";

const tiers = [
  {
    icon: DollarSign,
    name: "Small to Midsize",
    price: "$4,788/yr",
    costToServe: "~$400–600/yr",
    margin: "85–90%",
    costNotes: "Shared free feeds (CISA/NVD/H-ISAC/RSS), ~$5–20/mo infra, community support",
  },
  {
    icon: TrendingUp,
    name: "Enterprise",
    price: "$90k+/yr",
    costToServe: "~$25–40k/yr",
    margin: "50–70%",
    costNotes: "Commercial dark-web data licensing + dedicated account manager (~$60–80k/yr loaded)",
  },
  {
    icon: Server,
    name: "Self-Hosted",
    price: "$150k/yr",
    costToServe: "~$20–35k/yr",
    margin: "70–85%",
    costNotes: "Customer bears all infra; we provide support, managed updates & deployment guidance",
  },
];

export default function UnitEconomics() {
  return (
    <div>
      <div className="mb-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Unit Economics</span>
        <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight font-heading">
          Healthy margins across every tier
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          ThreatPulse runs on free and open intelligence feeds as its backbone, keeping cost-to-serve low. Commercial
          dark-web data licensing is the only significant variable cost — reserved for the enterprise tier where
          customers pay a premium for it.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {tiers.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.name} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm">{t.name}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Price</p>
                  <p className="text-sm font-bold tracking-tight font-heading mt-0.5">{t.price}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cost/yr</p>
                  <p className="text-sm font-bold tracking-tight font-heading mt-0.5">{t.costToServe}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Margin</p>
                  <p className="text-sm font-bold tracking-tight font-heading mt-0.5 text-primary">{t.margin}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.costNotes}</p>
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3.5 mt-4">
        <Percent className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm leading-relaxed">
          <strong className="text-foreground">Blended gross margin target: 70%+ at scale.</strong> As the customer mix
          shifts toward enterprise and self-hosted (57% of Year 5 revenue from just 45 customers), the high-margin
          tiers dominate the mix while SMB provides volume and logo count for future rounds.
        </p>
      </div>
    </div>
  );
}