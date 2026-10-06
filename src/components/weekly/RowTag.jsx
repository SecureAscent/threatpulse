import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const TAG_CONFIG = {
  "": {
    label: "—",
    rowClass: "",
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground/60",
  },
  talking_point: {
    label: "Talking Point",
    rowClass: "bg-amber-500/10",
    badgeClass: "bg-amber-500/25 text-amber-500 dark:text-amber-400 border-amber-500/40",
    dotClass: "bg-amber-400",
  },
  not_applicable: {
    label: "N/A",
    rowClass: "bg-muted/50",
    badgeClass: "bg-muted text-muted-foreground border-border",
    dotClass: "bg-muted-foreground/70",
  },
  old: {
    label: "Old",
    rowClass: "bg-slate-500/10",
    badgeClass: "bg-slate-500/25 text-slate-500 dark:text-slate-400 border-slate-500/40",
    dotClass: "bg-slate-400",
  },
  new: {
    label: "New",
    rowClass: "bg-blue-500/10",
    badgeClass: "bg-blue-500/25 text-blue-600 dark:text-blue-400 border-blue-500/40",
    dotClass: "bg-blue-400",
  },
  critical: {
    label: "Critical",
    rowClass: "bg-red-500/10",
    badgeClass: "bg-red-500/25 text-red-500 dark:text-red-400 border-red-500/40",
    dotClass: "bg-red-400",
  },
  high: {
    label: "High",
    rowClass: "bg-orange-500/10",
    badgeClass: "bg-orange-500/25 text-orange-600 dark:text-orange-400 border-orange-500/40",
    dotClass: "bg-orange-400",
  },
};

export default function RowTag({ value, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const config = TAG_CONFIG[value || ""] || TAG_CONFIG[""];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-semibold border rounded px-1.5 py-0.5 cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
          config.badgeClass,
          loading && "opacity-50"
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dotClass)} />
        <span>{config.label}</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 min-w-[130px] rounded-lg border border-border bg-popover shadow-lg z-30 py-0.5">
          {Object.entries(TAG_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className={cn(
                "flex items-center gap-1.5 w-full px-2 py-1 text-[10px] font-semibold text-left hover:bg-accent/50 transition-colors",
                key === (value || "") && "bg-accent/30"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dotClass)} />
              <span className="text-popover-foreground">{cfg.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}