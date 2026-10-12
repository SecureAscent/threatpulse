import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Ticket, Copy, Check, Loader2, RefreshCw, ExternalLink, AlertCircle, Lock } from "lucide-react";

export default function JiraWebhookSetup() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "superadmin";
  const [copied, setCopied] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["jira-webhook-setup"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getJiraWebhookSetup", {});
      return res.data;
    },
  });

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const regenerate = async () => {
    if (!confirm("Regenerate webhook token? The old URL will stop working immediately.")) return;
    setRegenerating(true);
    try {
      await base44.functions.invoke("getJiraWebhookSetup", { regenerate: true });
      qc.invalidateQueries({ queryKey: ["jira-webhook-setup"] });
    } finally {
      setRegenerating(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Ticket className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Jira Webhook</h3>
              <p className="text-xs text-muted-foreground">Admin configuration required</p>
            </div>
          </div>
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Only organization admins can configure the Jira webhook. Contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Jira Webhook</h3>
            <p className="text-xs text-muted-foreground">
              {data?.org_name ? `${data.org_name} · ` : ""}Auto-mitigate threats when Jira tickets close
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            {error?.message || "Unable to load webhook setup. Make sure you're part of an organization."}
          </p>
        </div>
      ) : data ? (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Copy this URL into your Jira webhook settings. When a linked ticket moves to Done,
            the threat auto-mitigates with a full audit trail.
          </p>

          {/* Webhook URL */}
          <div className="mb-3">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border font-mono text-xs break-all">
                {data.webhook_url}
              </code>
              <button
                onClick={() => copy(data.webhook_url, "url")}
                className="shrink-0 p-2 rounded-lg border border-border hover:bg-accent"
                title="Copy URL"
              >
                {copied === "url" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Steps */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 mb-3">
            <p className="text-xs font-semibold mb-2">Setup steps in Jira:</p>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://support.atlassian.com/jira-cloud/docs/manage-webhooks/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-0.5 hover:underline"
                >
                  Jira → Settings → System → Webhooks <ExternalLink className="w-3 h-3 inline" />
                </a>
              </li>
              <li>Click "Create a webhook"</li>
              <li>Paste the Webhook URL above</li>
              <li>
                Under "Events", select <strong>Issue: updated</strong>
              </li>
              <li>
                JQL (optional): <code className="font-mono">project = "TP"</code> to limit to your project
              </li>
              <li>Save — linked threats auto-mitigate when tickets close.</li>
            </ol>
          </div>

          {/* Token + regenerate */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">Token:</span>
              <code className="px-2 py-1 rounded bg-muted border border-border font-mono text-xs truncate">
                {(data.token || "").slice(0, 14)}…
              </code>
              <button
                onClick={() => copy(data.token, "token")}
                className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground"
                title="Copy token"
              >
                {copied === "token" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={regenerate}
              disabled={regenerating}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
            >
              {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Regenerate
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}