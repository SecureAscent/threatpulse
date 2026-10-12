import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Boxes,
  Loader2,
  Plus,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  X,
  DownloadCloud,
} from "lucide-react";

const emptyForm = { display_name: "", base_url: "", api_token: "" };

export default function CybellumSetup() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [testStatus, setTestStatus] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (authed) {
        try {
          const me = await base44.auth.me();
          setUser(me);
        } catch { /* ignore */ }
      }
      setAuthChecked(true);
    });
  }, []);

  const orgId = user?.data?.organization_id;

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["cybellum-connections"],
    queryFn: async () => {
      const res = await base44.entities.CybellumConnection.filter({}, "-created_date", 50);
      return res;
    },
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["cybellum-connections"] });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) return base44.entities.CybellumConnection.update(id, data);
      return base44.entities.CybellumConnection.create(data);
    },
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setFormError("");
    },
    onError: (err) => setFormError(err.message || "Failed to save connection"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CybellumConnection.delete(id),
    onSuccess: invalidate,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }) => base44.entities.CybellumConnection.update(id, { enabled }),
    onSuccess: invalidate,
  });

  const handleTest = async (conn) => {
    setTestStatus((s) => ({ ...s, [conn.id]: { loading: true } }));
    try {
      const res = await base44.functions.invoke("testCybellumConnection", {
        base_url: conn.base_url,
        api_token: conn.api_token,
      });
      const data = res.data || {};
      const ok = data.status === "success";
      setTestStatus((s) => ({
        ...s,
        [conn.id]: { loading: false, result: ok ? "success" : "failed", error: ok ? "" : data.error || "Test failed" },
      }));
      await base44.entities.CybellumConnection.update(conn.id, {
        last_tested_date: new Date().toISOString(),
        last_test_status: ok ? "success" : "failed",
        last_error: ok ? "" : data.error || "Test failed",
        cybellum_user_key: ok ? data.user_key : conn.cybellum_user_key,
      });
      invalidate();
    } catch (err) {
      setTestStatus((s) => ({
        ...s,
        [conn.id]: { loading: false, result: "failed", error: err.message || "Request failed" },
      }));
    }
  };

  const handleTestForm = async () => {
    if (!form.base_url || !form.api_token) {
      setFormError("Enter base URL and API token to test.");
      return;
    }
    setFormError("");
    setTestStatus((s) => ({ ...s, __form: { loading: true } }));
    try {
      const res = await base44.functions.invoke("testCybellumConnection", {
        base_url: form.base_url,
        api_token: form.api_token,
      });
      const data = res.data || {};
      const ok = data.status === "success";
      setTestStatus((s) => ({
        ...s,
        __form: { loading: false, result: ok ? "success" : "failed", error: ok ? "" : data.error || "Test failed" },
      }));
    } catch (err) {
      setTestStatus((s) => ({
        ...s,
        __form: { loading: false, result: "failed", error: err.message || "Request failed" },
      }));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("syncCybellum", {});
      setSyncResult(res.data || { error: "No response" });
      invalidate();
    } catch (err) {
      setSyncResult({ error: err.message || "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.base_url.trim() || !form.api_token.trim()) {
      setFormError("Base URL and API token are required.");
      return;
    }
    if (!orgId) {
      setFormError("You must belong to an organization before adding a Cybellum connection.");
      return;
    }
    saveMutation.mutate({
      id: editingId,
      data: { ...form, base_url: form.base_url.trim().replace(/\/$/, ""), organization_id: orgId },
    });
  };

  const startEdit = (conn) => {
    setEditingId(conn.id);
    setForm({
      display_name: conn.display_name || "",
      base_url: conn.base_url || "",
      api_token: conn.api_token || "",
    });
    setShowForm(true);
    setFormError("");
    setTestStatus((s) => ({ ...s, __form: undefined }));
  };

  const startAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setFormError("");
    setTestStatus((s) => ({ ...s, __form: undefined }));
  };

  if (!authChecked || isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Header connected={false} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Header connected={false} />
        <p className="text-sm text-muted-foreground mb-4">Sign in to manage your Cybellum connection.</p>
        <button
          onClick={() => base44.auth.redirectToLogin()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-input text-sm font-medium hover:bg-accent transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <Header connected={connections.length > 0} />
        {!showForm && (
          <button
            onClick={startAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> Add Connection
          </button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Connect your organization's Cybellum tenant. Each tenant stores its own API token (per-tenant, not shared).
        Sync pulls products into the portfolio, SBOM components into the SBOM/CMDB, and CVE findings into the threat feed.
      </p>

      {!orgId && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 mb-4">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            You aren't assigned to an organization yet. Ask your admin to add you to an organization before connecting Cybellum.
          </p>
        </div>
      )}

      {/* Sync control */}
      {connections.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={handleSync}
            disabled={syncing || !connections.some((c) => c.enabled)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
            Sync now
          </button>
          {syncResult && (
            <span className={`text-xs ${syncResult.error ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"} flex items-center gap-1`}>
              {syncResult.error ? (
                <><XCircle className="w-3.5 h-3.5" /> {syncResult.error}</>
              ) : (
                <><CheckCircle2 className="w-3.5 h-3.5" /> {syncResult.summary || "Sync complete"}</>
              )}
            </span>
          )}
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-secondary/30 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">{editingId ? "Edit connection" : "New connection"}</h4>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); setFormError(""); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Display name (optional)">
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="e.g. Acme Cybellum"
                className={inputCls}
              />
            </Field>
            <Field label="Base URL">
              <input
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder="https://your-tenant.cybellum.com"
                className={inputCls}
                required
              />
            </Field>
            <Field label="API Token">
              <input
                type="password"
                value={form.api_token}
                onChange={(e) => setForm({ ...form, api_token: e.target.value })}
                placeholder="••••••••••••••••"
                className={inputCls}
                required
              />
            </Field>
          </div>

          {testStatus.__form && (
            <div className="mt-3">
              <TestBadge status={testStatus.__form} />
            </div>
          )}

          {formError && <p className="text-xs text-destructive mt-3">{formError}</p>}

          <div className="flex items-center gap-2 mt-4">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editingId ? "Update" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleTestForm}
              disabled={testStatus.__form?.loading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-input text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {testStatus.__form?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Test
            </button>
            <a
              href="https://cybellum.com/platform/"
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cybellum platform <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </form>
      )}

      {/* Connection list */}
      {connections.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Boxes className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No Cybellum connection configured yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {connections.map((conn) => {
          const ts = testStatus[conn.id] || {};
          const testResult = ts.result || (conn.last_test_status === "success" ? "success" : conn.last_test_status === "failed" ? "failed" : null);
          const testError = ts.error || conn.last_error || "";
          return (
            <div key={conn.id} className="rounded-lg border border-border bg-secondary/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">{conn.display_name || conn.base_url}</h4>
                    <EnabledBadge enabled={conn.enabled} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{conn.base_url}</p>
                  {conn.last_sync_summary && (
                    <p className="text-xs text-muted-foreground mt-0.5">{conn.last_sync_summary}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <IconBtn onClick={() => handleTest(conn)} disabled={ts.loading} title="Test connection">
                    {ts.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </IconBtn>
                  <IconBtn onClick={() => startEdit(conn)} title="Edit">
                    <Pencil className="w-4 h-4" />
                  </IconBtn>
                  <IconBtn
                    onClick={() => toggleMutation.mutate({ id: conn.id, enabled: !conn.enabled })}
                    title={conn.enabled ? "Disable" : "Enable"}
                  >
                    {conn.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </IconBtn>
                  <IconBtn
                    onClick={() => { if (confirm("Remove this Cybellum connection?")) deleteMutation.mutate(conn.id); }}
                    title="Delete"
                    danger
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconBtn>
                </div>
              </div>

              {testResult && (
                <div className="mt-2.5">
                  <TestBadge
                    status={{ result: testResult, error: testError, loading: false }}
                    lastTested={conn.last_tested_date}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ───

function Header({ connected }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Boxes className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold">Cybellum</h3>
        <p className="text-xs text-muted-foreground">{connected ? "Connected" : "Not connected"}</p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function EnabledBadge({ enabled }) {
  return enabled ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /> Enabled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
      <PowerOff className="w-3 h-3" /> Disabled
    </span>
  );
}

function TestBadge({ status, lastTested }) {
  if (status.loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing…
      </span>
    );
  }
  if (status.result === "success") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" /> Connection verified
        {lastTested && <span className="text-muted-foreground">· {new Date(lastTested).toLocaleDateString()}</span>}
      </span>
    );
  }
  if (status.result === "failed") {
    return (
      <span className="inline-flex items-start gap-1.5 text-xs text-destructive">
        <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>{status.error || "Test failed"}</span>
      </span>
    );
  }
  return null;
}

function IconBtn({ children, onClick, disabled, title, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md border border-transparent hover:bg-accent transition-colors disabled:opacity-50 ${
        danger ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";