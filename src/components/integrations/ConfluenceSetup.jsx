import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  FileText,
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
} from "lucide-react";

const emptyForm = { display_name: "", base_url: "", email: "", api_token: "" };

export default function ConfluenceSetup() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [testStatus, setTestStatus] = useState({}); // { [id]: { loading, result, error } }

  // Auth gate
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

  // Load this user's connections (RLS scopes to owner)
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["confluence-connections"],
    queryFn: async () => {
      const res = await base44.entities.ConfluenceConnection.filter({}, "-created_date", 50);
      return res;
    },
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["confluence-connections"] });

  // Create / update mutation
  const saveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) {
        return base44.entities.ConfluenceConnection.update(id, data);
      }
      return base44.entities.ConfluenceConnection.create(data);
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ConfluenceConnection.delete(id),
    onSuccess: invalidate,
  });

  // Toggle enable/disable
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }) => base44.entities.ConfluenceConnection.update(id, { enabled }),
    onSuccess: invalidate,
  });

  // Test connection via backend function
  const handleTest = async (conn) => {
    setTestStatus((s) => ({ ...s, [conn.id]: { loading: true } }));
    try {
      const res = await base44.functions.invoke("testConfluenceConnection", {
        base_url: conn.base_url,
        email: conn.email,
        api_token: conn.api_token,
      });
      const data = res.data || {};
      const ok = data.status === "success";
      setTestStatus((s) => ({
        ...s,
        [conn.id]: { loading: false, result: ok ? "success" : "failed", error: ok ? "" : data.error || "Test failed" },
      }));
      // Persist test result on the record
      await base44.entities.ConfluenceConnection.update(conn.id, {
        last_tested_date: new Date().toISOString(),
        last_test_status: ok ? "success" : "failed",
        last_error: ok ? "" : data.error || "Test failed",
        confluence_user_key: ok ? data.user_key : conn.confluence_user_key,
      });
      invalidate();
    } catch (err) {
      setTestStatus((s) => ({
        ...s,
        [conn.id]: { loading: false, result: "failed", error: err.message || "Request failed" },
      }));
    }
  };

  // Test from the add/edit form (before saving)
  const handleTestForm = async () => {
    if (!form.base_url || !form.email || !form.api_token) {
      setFormError("Enter base URL, email, and API token to test.");
      return;
    }
    setFormError("");
    setTestStatus((s) => ({ ...s, __form: { loading: true } }));
    try {
      const res = await base44.functions.invoke("testConfluenceConnection", {
        base_url: form.base_url,
        email: form.email,
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.base_url.trim() || !form.email.trim() || !form.api_token.trim()) {
      setFormError("Base URL, email, and API token are required.");
      return;
    }
    saveMutation.mutate({ id: editingId, data: { ...form, base_url: form.base_url.trim().replace(/\/$/, "") } });
  };

  const startEdit = (conn) => {
    setEditingId(conn.id);
    setForm({
      display_name: conn.display_name || "",
      base_url: conn.base_url || "",
      email: conn.email || "",
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

  // Not logged in
  if (authChecked && !user) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Header connected={false} />
        <p className="text-sm text-muted-foreground mb-4">
          Sign in to manage your Confluence connection.
        </p>
        <button
          onClick={() => base44.auth.redirectToLogin()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-input text-sm font-medium hover:bg-accent transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

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
        Connect your own Confluence instance (Cloud or Server / Data Center). Credentials are stored per-user and
        only you can access them. Disable a connection to pause sync without losing your settings.
      </p>

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
                placeholder="e.g. Engineering Wiki"
                className={inputCls}
              />
            </Field>
            <Field label="Base URL">
              <input
                value={form.base_url}
                onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                placeholder="https://your-team.atlassian.net"
                className={inputCls}
                required
              />
            </Field>
            <Field label="Email / Username">
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@company.com"
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

          {/* Form test result */}
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
              href="https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/"
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              How to get an API token <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </form>
      )}

      {/* Connection list */}
      {connections.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No Confluence connection configured yet.</p>
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
                    <h4 className="font-medium text-sm truncate">
                      {conn.display_name || conn.base_url}
                    </h4>
                    <EnabledBadge enabled={conn.enabled} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{conn.base_url}</p>
                  <p className="text-xs text-muted-foreground">{conn.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <IconBtn
                    onClick={() => handleTest(conn)}
                    disabled={ts.loading}
                    title="Test connection"
                  >
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
                    onClick={() => {
                      if (confirm("Remove this Confluence connection?")) deleteMutation.mutate(conn.id);
                    }}
                    title="Delete"
                    danger
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconBtn>
                </div>
              </div>

              {/* Test result */}
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
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold">Confluence</h3>
        <p className="text-xs text-muted-foreground">
          {connected ? "Connected" : "Not connected"}
        </p>
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