import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import Logo from "@/components/Logo";
import {
  Shirt,
  HardHat,
  Coffee,
  Sticker,
  ShoppingBag,
  Layers,
  ArrowLeft,
  ArrowUpRight,
  Truck,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const STORE_URL = "https://threatpulse.myshopify.com/";

const gear = [
  { icon: Shirt, name: "Tees & Apparel", price: "$28+", blurb: "Soft tri-blend tees with the ThreatPulse pulse mark.", grad: "from-cyan-500/20 to-blue-500/5", accent: "text-cyan-500" },
  { icon: Shirt, name: "Hoodies & Outerwear", price: "$52+", blurb: "Heavyweight hoodies built for the SOC and the weekend.", grad: "from-indigo-500/20 to-violet-500/5", accent: "text-indigo-500" },
  { icon: HardHat, name: "Headwear", price: "$26+", blurb: "Structured dad hats and snapbacks in navy and black.", grad: "from-amber-500/20 to-orange-500/5", accent: "text-amber-500" },
  { icon: Coffee, name: "Drinkware", price: "$18+", blurb: "Matte ceramic mugs and insulated bottles for late-shift analysts.", grad: "from-emerald-500/20 to-teal-500/5", accent: "text-emerald-500" },
  { icon: Sticker, name: "Stickers & Decals", price: "$6+", blurb: "Weatherproof vinyl stickers for laptops, helmets, and racks.", grad: "from-rose-500/20 to-pink-500/5", accent: "text-rose-500" },
  { icon: ShoppingBag, name: "Totes & Accessories", price: "$22+", blurb: "Canvas totes, lanyards, and enamel pins for the team.", grad: "from-sky-500/20 to-cyan-500/5", accent: "text-sky-500" },
];

const perks = [
  { icon: Truck, title: "Worldwide shipping", desc: "Printed and shipped on demand, worldwide." },
  { icon: RefreshCw, title: "30-day returns", desc: "Not loving it? Send it back within 30 days." },
  { icon: ShieldCheck, title: "Secure checkout", desc: "Powered by Shopify's encrypted checkout." },
];

export default function Shop() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="text-lg font-bold tracking-tight">ThreatPulse</span>
            <span className="hidden sm:inline text-xs font-medium text-muted-foreground border border-border rounded px-1.5 py-0.5 ml-1">Gear</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to app
            </Link>
            <a
              href={STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition shadow-sm inline-flex items-center gap-2"
            >
              Visit Store <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Official ThreatPulse Merchandise
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight font-heading leading-[1.1]">
              Gear up. <br />Stay vigilant.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-md">
              Branded apparel, drinkware, and accessories for the analysts, responders, and defenders who keep their orgs secure.
            </p>
            <div className="mt-7 flex items-center gap-3 flex-wrap">
              <a
                href={STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition shadow-sm inline-flex items-center gap-2"
              >
                Shop the Full Store <ArrowUpRight className="w-4 h-4" />
              </a>
              <a href="#featured" className="px-6 py-3 rounded-lg border border-border font-medium hover:bg-accent transition">Browse Highlights</a>
            </div>
            <div className="mt-6 flex items-center gap-x-5 gap-y-2 flex-wrap text-xs text-muted-foreground">
              {["Printed on demand", "Secure Shopify checkout", "Worldwide shipping"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> {t}
                </span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl ring-1 ring-border/50">
              <Image
                src="https://media.base44.com/images/public/6a601c9ee28f256387b6c791/c62ddec43_generated_image.png"
                alt="ThreatPulse branded gear flat lay"
                className="w-full aspect-[4/3]"
                fittingType="fill"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Featured gear */}
      <section id="featured" className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-2xl mb-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Featured gear</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight font-heading">Highlights from the collection</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            A taste of what's in the store. Tap any item to view it on the full Shopify shop.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {gear.map((g) => {
            const Icon = g.icon;
            return (
              <a
                key={g.name}
                href={STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all"
              >
                <div className={`relative h-40 bg-gradient-to-br ${g.grad} flex items-center justify-center`}>
                  <Icon className={`w-14 h-14 ${g.accent} group-hover:scale-105 transition-transform`} />
                  <span className="absolute top-3 right-3 text-xs font-semibold bg-background/80 backdrop-blur border border-border rounded-md px-2 py-1">
                    from {g.price}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold mb-1">{g.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{g.blurb}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    Shop Now <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Perks band */}
      <section className="bg-secondary/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-12 grid sm:grid-cols-3 gap-6">
          {perks.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="relative rounded-3xl border border-border bg-card overflow-hidden px-8 py-14 text-center shadow-lg">
            <div className="absolute inset-0 hero-gradient opacity-70" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight font-heading">Ready to rep the pulse?</h2>
              <p className="mt-3 text-muted-foreground mb-7 max-w-xl mx-auto leading-relaxed">
                The full collection lives on our Shopify store — browse every product and check out securely.
              </p>
              <a
                href={STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition inline-flex items-center gap-2 shadow-sm"
              >
                Visit the ThreatPulse Store <ArrowUpRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between flex-wrap gap-4">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-semibold">ThreatPulse</span>
          </Link>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ThreatPulse. Store powered by Shopify.</p>
        </div>
      </footer>
    </div>
  );
}