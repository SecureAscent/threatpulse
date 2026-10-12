import React, { useState } from "react";
import { Bell, Mail, AlertTriangle } from "lucide-react";

export default function SettingsNotifications() {
  const [prefs, setPrefs] = useState({
    emailCritical: true,
    emailWeekly: false,
    inApp: true,
    criticalOnly: false,
  });

  const toggle = (k) => setPrefs((p) => ({ ...p, [k]: !p[k] }));

  const rows = [
    { key: "emailCritical", label: "Email alerts for critical threats", icon: Mail },
    { key: "emailWeekly", label: "Weekly threat digest email", icon: Mail },
    { key: "inApp", label: "In-app notifications", icon: Bell },
    { key: "criticalOnly", label: "Notify only for Critical severity", icon: AlertTriangle },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        <Bell className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notification Preferences</h1>
          <p className="text-sm text-muted-foreground">Choose how and when you get alerted</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((r) => {
          const Icon = r.icon;
          const on = prefs[r.key];
          return (
            <button
              key={r.key}
              onClick={() => toggle(r.key)}
              className="w-full flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">{r.label}</span>
              </div>
              <span className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${on ? "bg-primary" : "bg-secondary"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-4" : "left-0.5"}`} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}