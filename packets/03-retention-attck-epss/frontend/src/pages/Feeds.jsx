import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Radar, Newspaper, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import RetentionHealth from "@/components/RetentionHealth";

export default function Feeds() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null); // null | "cisa" | "nvd" | "all"
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const ingest = async (source) => {
    setBusy(source);
    setResult(null);
    setError("");
    try {
      const res = await base44.functions.invoke("ingestFeeds", { source, limit: 25, days: 7 });
      setResult(res.data);
      qc.invalidateQueries({ queryKey: ["threats"] });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Ingestion failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Threat Feeds</h1>
        <p className="text-sm text-muted-foreground">Pull fresh intelligence from CISA KEV and NVD into your threat database</p>
      </div>

      <RetentionHealth />

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* CISA */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">CISA KEV</h3>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">Public</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Known Exploited Vulnerabilities catalog — the most recent additions flagged as High/Critical.</p>
          <button
            onClick={() => ingest("cisa")}
            disabled={!!busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {busy === "cisa" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {busy === "cisa" ? "Ingesting…" : "Ingest CISA KEV"}
          </button>
        </div>

        {/* NVD */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">NVD</h3>
            </div>
            <span className="text-[10px] uppercase tracking-wider text-emerald-500 border border-emerald-500/30 rounded px-1.5 py-0.5">API Key</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">NIST NVD CVEs published in the last 7 days, with CVSS scores and severity.</p>
          <button
            onClick={() => ingest("nvd")}
            disabled={!!busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {busy === "nvd" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {busy === "nvd" ? "Ingesting…" : "Ingest NVD CVEs"}
          </button>
        </div>
      </div>

      {/* News RSS feeds */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">News RSS Feeds</h3>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">RSS</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Security news from 18 industry-leading sources — including Dark Reading, Bleeping Computer, The Hacker News, Krebs on Security, Schneier on Security, Unit 42, Talos, Recorded Future, and more — classified by severity and threat type.</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {["US-CERT/CISA", "CISA Alerts", "Krebs on Security", "Bleeping Computer", "Dark Reading", "SANS ISC", "Threatpost", "SecurityWeek", "Recorded Future", "Unit 42", "Talos Intelligence", "The Hacker News", "Schneier on Security", "Naked Security", "Malwarebytes Labs", "Graham Cluley", "The Record", "CyberScoop"].map((s) => (
            <span key={s} className="text-[11px] px-2 py-0.5 rounded-md border border-border text-muted-foreground">{s}</span>
          ))}
        </div>
        <button
          onClick={() => ingest("rss")}
          disabled={!!busy}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {busy === "rss" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {busy === "rss" ? "Ingesting…" : "Ingest News Feeds"}
        </button>
      </div>

      {/* Ingest all */}
      <button
        onClick={() => ingest("all")}
        disabled={!!busy}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-input text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors mb-6"
      >
        {busy === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {busy === "all" ? "Ingesting all…" : "Ingest All Sources"}
      </button>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold">Ingestion complete</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div>
              <p className="text-2xl font-bold text-foreground">{result.fetched}</p>
              <p className="text-xs text-muted-foreground">Fetched</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{result.duplicates}</p>
              <p className="text-xs text-muted-foreground">Duplicates skipped</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-500">{result.created}</p>
              <p className="text-xs text-muted-foreground">New threats added</p>
            </div>
          </div>

          {result.feeds && result.feeds.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Per-feed status</p>
              <div className="space-y-2">
                {result.feeds.map((f) => (
                  <div key={f.name} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {f.error ? (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="font-medium truncate">{f.name}</span>
                    </div>
                    <span className={f.error ? "text-xs text-red-500 truncate ml-2" : "text-xs text-muted-foreground shrink-0"}>
                      {f.error ? f.error : `${f.fetched} fetched`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 mt-4">
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}