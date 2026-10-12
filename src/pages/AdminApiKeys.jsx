import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { KeySquare, ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function AdminApiKeys() {
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin" || role === "superadmin";

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium">Admins only</p>
          <p className="text-sm text-muted-foreground mt-1">You need an admin role to manage API keys.</p>
        </div>
      </div>
    );
  }

  const keys = [
    { name: "NVD_API_KEY", scope: "NVD CVE 2.0 API", configured: true },
    { name: "JIRA_API_TOKEN", scope: "Jira ticketing (future)", configured: false },
    { name: "CYBELLUM_API_KEY", scope: "Cybellum SBOM (future)", configured: false },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        <KeySquare className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground">Secrets used by backend integrations</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {keys.map((k, i) => (
          <div key={k.name} className={`flex items-center justify-between px-4 py-3 ${i ? "border-t border-border" : ""}`}>
            <div className="min-w-0">
              <p className="font-mono text-sm font-medium">{k.name}</p>
              <p className="text-xs text-muted-foreground">{k.scope}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{k.configured ? "••••••••" : "not set"}</span>
              {k.configured ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">Keys are managed securely in dashboard settings → environment variables and never exposed to the frontend.</p>
    </div>
  );
}