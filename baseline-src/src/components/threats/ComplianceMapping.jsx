import React from "react";
import { mapThreatToControls } from "@/lib/complianceMap";
import { ShieldCheck, FileText, Lock } from "lucide-react";

const FRAMEWORKS = [
  { key: "nist", label: "NIST CSF", icon: ShieldCheck, color: "text-blue-500" },
  { key: "iso", label: "ISO 27001", icon: FileText, color: "text-violet-500" },
  { key: "pci", label: "PCI DSS", icon: Lock, color: "text-amber-500" },
];

export default function ComplianceMapping({ threat }) {
  const map = mapThreatToControls(threat);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Compliance Mapping</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Suggested controls by framework</p>
      <div className="space-y-4">
        {FRAMEWORKS.map((fw) => {
          const Icon = fw.icon;
          const items = map[fw.key] || [];
          return (
            <div key={fw.key}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${fw.color}`} />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{fw.label}</span>
              </div>
              <ul className="space-y-1">
                {items.map(([id, name]) => (
                  <li key={id} className="flex items-start gap-2 text-xs">
                    <span className="font-mono font-medium text-foreground shrink-0">{id}</span>
                    <span className="text-muted-foreground">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}