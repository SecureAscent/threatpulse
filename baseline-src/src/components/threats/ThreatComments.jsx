import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { MessageSquare, Reply, Loader2, Send, AtSign } from "lucide-react";

const extractMentions = (text) => (text.match(/@([\w.]+)/g) || []).map((m) => m.slice(1)).join(", ");

function rel(dateStr) {
  if (!dateStr) return "";
  const min = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function renderBody(text) {
  return (text || "").split(/(@[\w.]+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-primary font-medium bg-primary/10 rounded px-1">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function ThreatComments({ threatId }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const actor = user?.full_name || user?.email || "Analyst";
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", threatId],
    queryFn: () => base44.entities.Comment.filter({ threat_id: threatId }, "created_date", 200),
  });

  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await base44.entities.Comment.create({
        threat_id: threatId,
        parent_id: replyTo || "",
        body: body.trim(),
        mentions: extractMentions(body),
        actor_name: actor,
      });
      setBody("");
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["comments", threatId] });
    } finally {
      setBusy(false);
    }
  };

  // Build ordered flat list via DFS from roots (parent_id empty)
  const byParent = {};
  comments.forEach((c) => {
    const p = c.parent_id || "root";
    (byParent[p] = byParent[p] || []).push(c);
  });
  const ordered = [];
  const walk = (parentId, depth) => {
    (byParent[parentId] || []).forEach((c) => {
      ordered.push({ c, depth });
      walk(c.id, depth + 1);
    });
  };
  walk("root", 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Discussion</h3>
        <span className="text-xs text-muted-foreground">({comments.length})</span>
      </div>

      <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No discussion yet — start the thread.</p>
        ) : (
          ordered.map(({ c, depth }) => (
            <div key={c.id} style={{ marginLeft: depth * 20 }} className={depth > 0 ? "border-l-2 border-border pl-3" : ""}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-foreground">{c.actor_name || "Analyst"}</span>
                <span className="text-[10px] text-muted-foreground">{rel(c.created_date)}</span>
                {c.mentions && <AtSign className="w-3 h-3 text-primary" />}
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{renderBody(c.body)}</p>
              <button
                onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
              >
                <Reply className="w-3 h-3" /> Reply
              </button>
            </div>
          ))
        )}
      </div>

      <div className="rounded-lg border border-input bg-background p-3">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
            <span>Replying to thread</span>
            <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">cancel</button>
          </div>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment… use @name to mention a teammate"
          rows={2}
          className="w-full bg-transparent text-sm focus:outline-none resize-y"
        />
        <div className="flex justify-end mt-1">
          <button
            onClick={submit}
            disabled={!body.trim() || busy}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {replyTo ? "Reply" : "Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}