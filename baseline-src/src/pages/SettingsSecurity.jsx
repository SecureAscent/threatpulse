import React from "react";
import { useAuth } from "@/lib/AuthContext";
import { ShieldCheck, KeyRound, Smartphone } from "lucide-react";

export default function SettingsSecurity() {
  const { user } = useAuth();

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Security</h1>
          <p className="text-sm text-muted-foreground">Account and access security</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Password</p>
              <p className="text-xs text-muted-foreground">Signed in as {user?.email || "—"}</p>
            </div>
          </div>
          <a href="/forgot-password" className="text-sm text-primary hover:underline">Reset</a>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Two-factor authentication</p>
              <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground border border-border rounded px-2 py-1">Not configured</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Role</p>
              <p className="text-xs text-muted-foreground">Determines your access level</p>
            </div>
          </div>
          <span className="text-xs font-medium border border-border rounded px-2 py-1 capitalize">{user?.role || "user"}</span>
        </div>
      </div>
    </div>
  );
}