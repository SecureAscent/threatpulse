import React from "react";
import { Rocket, Building2, Server, Handshake, Target, Users } from "lucide-react";

const channels = [
  {
    icon: Rocket,
    title: "SMB — Product-led growth",
    price: "$399/mo · self-serve",
    points: [
      "Free preview tier lets buyers self-evaluate before talking to sales",
      "SEO content from our own threat ingestion engine compounds organically",
      "ISAC community participation (H-ISAC, MS-ISAC) for low-cost, high-trust distribution",
    ],
    metric: "Target CAC: < $200",
  },
  {
    icon: Building2,
    title: "Enterprise — Sales-led",
    price: "$7,500/mo · founder-led",
    points: [
      "Outbound to regulated industries (defense, healthcare, finance, critical infrastructure)",
      "Self-hosted Docker stack is the procurement wedge SaaS competitors can't match",
      "MSSP and security consultancy channel partners for white-label distribution",
    ],
    metric: "ACV: $90k+",
  },
];

const milestones = [
  { icon: Target, phase: "Year 1", desc: "5 SMB + 1 enterprise pilot — founder-led, proves both channels convert" },
  { icon: Users, phase: "Year 2", desc: "First GTM hire, 25 SMB + 1 enterprise — motion is repeatable without founder" },
  { icon: Server, phase: "Year 3", desc: "$1M ARR milestone — triggers seed round to scale GTM" },
];

export default function GoToMarket() {
  return (
    <div>
      <div className="mb-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Go-to-Market</span>
        <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight font-heading">
          Two channels, segment-specific motions
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          SMB buyers self-serve; enterprise buyers need a meeting. We run a different motion for each — and prove both
          with the first 5–10 customers before scaling GTM spend.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {channels.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{c.title}</h3>
                  <p className="text-xs text-muted-foreground">{c.price}</p>
                </div>
              </div>
              <ul className="space-y-1.5 mb-3">
                {c.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0 mt-2" /> {p}
                  </li>
                ))}
              </ul>
              <div className="pt-3 border-t border-border">
                <span className="text-xs font-semibold text-primary">{c.metric}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        {milestones.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.phase} className="rounded-xl border border-border bg-secondary/40 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">{m.phase}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}