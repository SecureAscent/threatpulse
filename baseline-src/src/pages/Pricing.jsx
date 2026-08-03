import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Check,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Building2,
  Users,
  Zap,
  Server,
} from "lucide-react";
import Logo from "@/components/Logo";
import DarkWebShowcase from "@/components/DarkWebShowcase";

const tiers = [
  {
    id: "Free",
    name: "Free Tier",
    tagline: "For individuals exploring threat intelligence.",
    icon: Zap,
    price: { monthly: 0, annual: 0 },
    cta: "Start Free",
    href: "/register",
    popular: false,
    keyRequired: false,
    features: [
      "Real-time threat feed (last 24h view)",
      "Ransomware threat-actor directory (groups & TTPs)",
      "Up to 1 portfolio product",
      "Basic severity filtering",
      "1 user seat",
      "Community support",
    ],
  },
  {
    id: "SmallMidsize",
    name: "Small to Midsize",
    tagline: "For growing security teams that need full visibility.",
    icon: Users,
    price: { monthly: 399, annual: 319 },
    cta: "Contact Sales",
    href: "/contact-sales?tier=SmallMidsize",
    popular: true,
    features: [
      "Full threat feed history & CVE database",
      "Up to 25 portfolio products",
      "Blast radius mapping with active versions",
      "Ransomware threat-actor & victim tracking",
      "PDF & CSV investigation reports",
      "SLA timers & breach alerts",
      "30-day trend & threat-origin analytics",
      "Daily email digest",
      "5 user seats included",
      "Standard support",
    ],
  },
  {
    id: "Enterprise",
    name: "Enterprise",
    tagline: "For organizations with advanced compliance needs.",
    icon: Building2,
    price: { monthly: null, annual: null },
    cta: "Contact Sales",
    href: "/contact-sales?tier=Enterprise",
    popular: false,
    features: [
      "Unlimited portfolio products & user seats",
      "Custom threat feeds & API integrations",
      "Commercial dark-web monitoring (credential leaks, marketplace chatter) — scoped to your domains & identities",
      "Advanced analytics & executive briefs",
      "SSO/SAML & role-based access control",
      "Audit-ready compliance exports & framework mapping",
      "Dedicated account manager & onboarding",
      "24/7 priority support",
      "From $7,500/mo — scales with monitored assets & identities",
    ],
  },
];

const tierLabel = (t) =>
  t === "SmallMidsize" ? "Small to Midsize" : t === "Enterprise" ? "Enterprise" : "Free";

export default function Pricing() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    base44.auth
      .isAuthenticated()
      .then(async (authed) => {
        if (authed) {
          try {
            setUser(await base44.auth.me());
          } catch {}
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  const currentPlan = user?.plan || "Free";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="text-lg font-bold tracking-tight">ThreatPulse</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/free" className="hidden sm:inline text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Live Preview
            </Link>
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition shadow-sm"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-8 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Simple, transparent pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight font-heading">
            Choose the plan that fits your team
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Start free, then contact our sales team to unlock the Small to Midsize or Enterprise tier.
            Every plan includes real-time threat intelligence and audit-ready reporting.
          </p>

          {/* Billing toggle */}
          <div className="mt-7 inline-flex items-center gap-3">
            <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <button
              onClick={() => setAnnual((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${annual ? "bg-primary" : "bg-muted"}`}
              aria-label="Toggle annual billing"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  annual ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
              Annual <span className="text-xs text-primary">save ~20%</span>
            </span>
          </div>

          {authChecked && user && currentPlan !== "Free" && (
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Your current plan: {tierLabel(currentPlan)}
            </div>
          )}
        </div>
      </section>

      {/* Pricing cards */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {tiers.map((t) => {
            const Icon = t.icon;
            const price = annual ? t.price.annual : t.price.monthly;
            return (
              <div
                key={t.id}
                className={`relative rounded-2xl border bg-card p-7 flex flex-col ${
                  t.popular ? "border-primary ring-2 ring-primary/30 shadow-xl lg:scale-[1.03]" : "border-border shadow-sm"
                }`}
              >
                {t.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground shadow">
                    Most Popular
                  </span>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.popular ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold leading-tight">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.tagline}</p>
                  </div>
                </div>

                <div className="mb-5">
                  {price === null ? (
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold tracking-tight font-heading">Custom</span>
                    </div>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-bold tracking-tight font-heading">${price}</span>
                      <span className="text-sm text-muted-foreground mb-1">/mo</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {price === null
                      ? "Contact sales for a quote"
                      : price === 0
                      ? "Free forever"
                      : annual
                      ? "billed annually"
                      : "billed monthly"}
                  </p>
                </div>

                <Link
                  to={t.href}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition mb-6 ${
                    t.popular
                      ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                      : "border border-border hover:bg-accent"
                  }`}
                >
                  {t.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <ul className="space-y-2.5">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>


              </div>
            );
          })}
        </div>
      </section>

      {/* Dark-Web Intelligence flagship showcase */}
      <DarkWebShowcase />

      {/* Self-Hosted option */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="grid lg:grid-cols-5 gap-0">
            <div className="lg:col-span-3 p-7 lg:p-9">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold leading-tight">Self-Hosted</h3>
                  <p className="text-xs text-muted-foreground">Run ThreatPulse entirely in your environment — full data sovereignty, no data leaves your network.</p>
                </div>
              </div>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-4xl font-bold tracking-tight font-heading">$150,000</span>
                <span className="text-sm text-muted-foreground mb-1">/yr</span>
              </div>
              <p className="text-xs text-muted-foreground mb-6">Base annual license + priority support & managed updates — scales with deployment size & monitored assets</p>
              <ul className="space-y-2.5 max-w-md">
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Everything in Enterprise, deployed as a Docker container stack in your own environment</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Full data sovereignty — threat intel, evidence, and audit logs never leave your network</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Air-gapped / on-prem feed ingestion compatible</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">SSO/SAML, RBAC & your own retention policies</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Annual license + priority support & managed updates</span>
                </li>
              </ul>
            </div>
            <div className="lg:col-span-2 bg-secondary/30 p-7 lg:p-9 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-border">
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                Best for regulated industries, government, and teams with strict data-residency or air-gap requirements. We handle deployment guidance and ongoing updates.
              </p>
              <Link
                to="/contact-sales?tier=SelfHosted"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-accent transition mb-3"
              >
                Talk to Sales
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="text-xs text-muted-foreground text-center">Deployment assessment & quote in 1–2 business days</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-semibold">ThreatPulse</span>
          </Link>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ThreatPulse. Automated Threat Intelligence Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}