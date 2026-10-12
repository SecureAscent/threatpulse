import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, Globe, Server, ShieldAlert, ExternalLink } from "lucide-react";

function SourceRow({ icon: Icon, name, data }) {
  if (!data) return null;
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">{name}</span>
        {data.error && <span className="text-[10px] text-destructive ml-auto">{data.error}</span>}
      </div>
      {data.error ? null : (
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          {name === "VirusTotal" && (
            <p>
              <span className="text-red-500 font-medium">{data.malicious}</span> malicious ·
              <span className="text-amber-500"> {data.suspicious}</span> suspicious ·
              <span className="text-emerald-500"> {data.harmless}</span> harmless
            </p>
          )}
          {name === "Shodan" && (
            <p>{[data.org, data.isp, data.os].filter(Boolean).join(" · ") || "no data"}{data.ports?.length ? ` · ports ${data.ports.join(", ")}` : ""}</p>
          )}
          {name === "GreyNoise" && (
            <p>
              <span className={data.classification === "malicious" ? "text-red-500" : data.classification === "benign" ? "text-emerald-500" : "text-muted-foreground"}>{data.classification || "unknown"}</span>
              {data.name ? ` · ${data.name}` : ""}{data.noise ? " · noisy" : ""}
            </p>
          )}
          {data.link && (
            <a href={data.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
              view <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function EnrichmentPanel() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  const run = async () => {
    if (!value.trim()) return;
    setLoading(true);
    setErr(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke("enrichIoc", { value: value.trim() });
      setResult(res?.data || res);
    } catch (e) {
      const d = e?.response?.data;
      setErr(d?.error || e?.message || "Enrichment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">IOC Enrichment</h3>
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="IP, domain, hash, or URL…"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={run}
          disabled={!value.trim() || loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Lookup
        </button>
      </div>
      {err && <p className="text-xs text-destructive mb-2">{err}</p>}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-medium">{result.value}</span>
            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">{result.type}</span>
          </div>
          {result.summary && <p className="text-xs text-muted-foreground">{result.summary}</p>}
          <SourceRow icon={Globe} name="VirusTotal" data={result.sources?.virustotal} />
          <SourceRow icon={Server} name="Shodan" data={result.sources?.shodan} />
          <SourceRow icon={ShieldAlert} name="GreyNoise" data={result.sources?.greynoise} />
          {(!result.keysConfigured?.virustotal && !result.keysConfigured?.shodan && !result.keysConfigured?.greynoise) && (
            <p className="text-[10px] text-muted-foreground pt-1">No API keys configured — only keyless sources will return data.</p>
          )}
        </div>
      )}
    </div>
  );
}