import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Clock, Radar } from "lucide-react";
import ThreatCard from "@/components/ThreatCard";
import Logo from "@/components/Logo";

export default function FreePreview() {
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Threat.list("-created_date", 50)
      .then(setThreats)
      .catch(() => setThreats([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="text-lg font-bold tracking-tight">ThreatPulse</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-3">
            <Clock className="w-3.5 h-3.5" /> Last 12 hours
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Free Threat Preview</h1>
          <p className="mt-2 text-muted-foreground">A live sample of recent threats collected by ThreatPulse. Sign up for the full feed, CVE search, and analyst workflow tools.</p>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : threats.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Radar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No threats in the last 12 hours. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {threats.map((t) => (
              <ThreatCard key={t.id} threat={t} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link to="/register" className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition inline-block">
            Get Full Access
          </Link>
        </div>
      </div>
    </div>
  );
}