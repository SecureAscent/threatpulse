import React, { useState, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";

const FIELD_KEYS = [
  "title", "description", "severity", "type", "cve_id", "cvss_score",
  "source", "source_url", "status", "assigned_to", "affected_products", "notes",
];

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function mapRow(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    if (FIELD_KEYS.includes(h)) obj[h] = row[i] || "";
  });
  if (obj.cvss_score !== undefined && obj.cvss_score !== "") obj.cvss_score = Number(obj.cvss_score);
  else if ("cvss_score" in obj) delete obj.cvss_score;
  return obj;
}

export default function Upload() {
  const qc = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState({ headers: [], rows: [] });
  const [mapped, setMapped] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file) => {
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    const p = parseCSV(text);
    setParsed(p);
    const rows = p.rows.map((r) => mapRow(p.headers, r)).filter((r) => r.title);
    setMapped(rows);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onPick = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setFileName(""); setParsed({ headers: [], rows: [] }); setMapped([]); setResult(null);
  };

  const importAll = async () => {
    if (mapped.length === 0) return;
    setImporting(true);
    setResult(null);
    let ok = 0, fail = 0;
    try {
      // bulk in chunks of 100
      for (let i = 0; i < mapped.length; i += 100) {
        const chunk = mapped.slice(i, i + 100);
        try {
          await base44.entities.Threat.bulkCreate(chunk);
          ok += chunk.length;
        } catch {
          fail += chunk.length;
        }
      }
      qc.invalidateQueries({ queryKey: ["threats"] });
      setResult({ ok, fail });
    } catch (err) {
      setResult({ ok, fail: mapped.length, error: err.message });
    } finally {
      setImporting(false);
    }
  };

  const expectedCols = useMemo(() => FIELD_KEYS.join(", "), []);

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Upload</h1>
        <p className="text-sm text-muted-foreground">Bulk import threats from a CSV file</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        <UploadCloud className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">Drag & drop a CSV here, or</p>
        <label className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer transition-colors">
          <FileText className="w-4 h-4" /> Choose File
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} />
        </label>
        <p className="text-xs text-muted-foreground mt-4">
          Expected columns: <code className="font-mono">{expectedCols}</code>
        </p>
        <p className="text-xs text-muted-foreground mt-1">Only <code className="font-mono">title</code> is required.</p>
      </div>

      {/* Selected file */}
      {fileName && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">{fileName}</span>
            <span className="text-xs text-muted-foreground shrink-0">— {mapped.length} valid rows</span>
          </div>
          <button onClick={reset} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview */}
      {mapped.length > 0 && !result && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Preview ({mapped.length} rows)</h3>
            <button
              onClick={importAll}
              disabled={importing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {importing ? "Importing…" : `Import ${mapped.length} Threats`}
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Title</th>
                  <th className="text-left px-3 py-2 font-medium">Severity</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">CVE</th>
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {mapped.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium line-clamp-1 max-w-[200px]">{r.title}</td>
                    <td className="px-3 py-2 text-xs">{r.severity || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.type || "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono">{r.cve_id || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.source || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mapped.length > 8 && <p className="px-3 py-2 text-xs text-muted-foreground">+{mapped.length - 8} more rows</p>}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-2">
            {result.fail === 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-orange-500" />}
            <h3 className="font-semibold">Import complete</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="text-emerald-500 font-medium">{result.ok} imported</span>
            {result.fail > 0 && <>, <span className="text-red-500 font-medium">{result.fail} failed</span></>}
          </p>
          {result.error && <p className="text-xs text-red-500 mt-1">{result.error}</p>}
          <button onClick={reset} className="mt-4 px-4 py-2 rounded-lg border border-input text-sm hover:bg-accent transition-colors">
            Upload Another
          </button>
        </div>
      )}
    </div>
  );
}