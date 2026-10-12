import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Paperclip, Upload, Loader2, Download, Trash2, FileText, Image as ImageIcon, Eye, Lock } from "lucide-react";

function rel(dateStr) {
  if (!dateStr) return "";
  const min = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default function EvidenceLocker({ threatId }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const actor = user?.full_name || user?.email || "Analyst";
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "superadmin";
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [revealing, setRevealing] = useState(null);

  const handleReveal = async (id) => {
    setRevealing(id);
    try {
      await base44.functions.invoke("revealThreatEvidence", { evidence_id: id });
      qc.invalidateQueries({ queryKey: ["evidence", threatId] });
    } finally {
      setRevealing(null);
    }
  };

  const [signedUrls, setSignedUrls] = useState({});

  const handleDownload = async (it) => {
    if (signedUrls[it.id]) {
      window.open(signedUrls[it.id], "_blank");
      return;
    }
    if (it.file_uri) {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: it.file_uri, expires_in: 300 });
      setSignedUrls((prev) => ({ ...prev, [it.id]: signed_url }));
      window.open(signed_url, "_blank");
    } else if (it.file_url) {
      window.open(it.file_url, "_blank");
    }
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["evidence", threatId],
    queryFn: () => base44.entities.Evidence.filter({ threat_id: threatId }, "-created_date", 100),
  });

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        await base44.entities.Evidence.create({
          threat_id: threatId,
          file_name: file.name,
          file_uri,
          content_type: file.type,
          uploaded_by: actor,
        });
      }
      qc.invalidateQueries({ queryKey: ["evidence", threatId] });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (id) => {
    setDeleting(id);
    try {
      await base44.entities.Evidence.delete(id);
      qc.invalidateQueries({ queryKey: ["evidence", threatId] });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Paperclip className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Evidence Locker</h3>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full mb-4 rounded-lg border-2 border-dashed border-border hover:border-primary/40 py-5 flex flex-col items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-60"
      >
        {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
        <span className="text-xs font-medium">{uploading ? "Uploading…" : "Click to attach evidence"}</span>
        <span className="text-[10px]">Screenshots, logs, PCAP, IOC exports</span>
      </button>
      <input ref={inputRef} type="file" multiple onChange={onFiles} className="hidden" />

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No evidence attached.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const isImg = (it.content_type || "").startsWith("image");
            return (
              <li key={it.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {it.revealed ? (
                    isImg ? <ImageIcon className="w-4 h-4 text-muted-foreground" /> : <FileText className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${!it.revealed ? "blur-[3px] select-none" : ""}`}>{it.file_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {it.uploaded_by} · {rel(it.created_date)}
                    {it.revealed && (
                      <span className="text-emerald-500"> · revealed{it.reveal_expires ? ` · exp ${rel(it.reveal_expires)}` : ""}{it.reveal_audit ? ` · ${it.reveal_audit.split("\n").length}×` : ""}</span>
                    )}
                  </p>
                </div>
                {!it.revealed ? (
                  <button
                    onClick={() => handleReveal(it.id)}
                    disabled={revealing === it.id}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary disabled:opacity-50"
                    title="Reveal (audited, 24h window)"
                  >
                    {revealing === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  </button>
                ) : (
                  <button
                    onClick={() => handleDownload(it)}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-primary"
                    title="Download (signed URL, 5-min expiry)"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => remove(it.id)}
                    disabled={deleting === it.id}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-destructive disabled:opacity-50"
                    title="Delete"
                  >
                    {deleting === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}