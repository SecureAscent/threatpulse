import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Mail,
  Building2,
  User,
} from "lucide-react";
import Logo from "@/components/Logo";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const tierLabel = (t) =>
  t === "SmallMidsize"
    ? "Small to Midsize"
    : t === "Enterprise"
    ? "Enterprise"
    : "ThreatPulse";

export default function ContactSales() {
  const [params] = useSearchParams();
  const tier = params.get("tier") || "General";

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.company.trim() || !form.message.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("submitContactSales", {
        name: form.name.trim(),
        email: form.email.trim(),
        company: form.company.trim(),
        teamSize: form.teamSize.trim(),
        tier,
        message: form.message.trim(),
      });
      if (res?.data?.success) {
        setDone(true);
      } else {
        setError(res?.data?.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      const data = err?.response?.data || {};
      setError(data.error || err?.message || "Failed to submit inquiry.");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="text-lg font-bold tracking-tight">ThreatPulse</span>
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to pricing
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-gradient" />
        <div className="relative max-w-2xl mx-auto px-6 pt-14 pb-4 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-4">
            <Send className="w-3.5 h-3.5" /> Talk to sales
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">
            Let's build your threat intelligence plan
          </h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Tell us about your team and we'll get back within one business day with a tailored quote for the{" "}
            <span className="font-medium text-foreground">{tierLabel(tier)}</span> tier.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        {done ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-10 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Inquiry received</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Thanks, {form.name.split(" ")[0]}. Our sales team will reach out to {form.email} shortly.
            </p>
            <Link
              to="/pricing"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" /> Back to pricing
            </Link>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-5"
          >
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Full name <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={form.name}
                    onChange={set("name")}
                    required
                    placeholder="Jane Doe"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Work email <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    required
                    placeholder="jane@company.com"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Company <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={form.company}
                    onChange={set("company")}
                    required
                    placeholder="Acme Inc."
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Team size</label>
                <input
                  value={form.teamSize}
                  onChange={set("teamSize")}
                  placeholder="e.g. 10-50"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Requirements <span className="text-destructive">*</span>
              </label>
              <textarea
                value={form.message}
                onChange={set("message")}
                required
                rows={5}
                placeholder="Tell us about your security stack, monitoring needs, and what you'd like to cover…"
                className={`${inputCls} resize-y`}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? "Sending..." : "Submit inquiry"}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              By submitting, you agree to be contacted by ThreatPulse about your inquiry.
            </p>
          </form>
        )}
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