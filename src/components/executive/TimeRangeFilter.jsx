import React from "react";
import { cn } from "@/lib/utils";
import { TIME_RANGES } from "@/lib/executiveData";

export default function TimeRangeFilter({ value, onChange, className }) {
  return (
    <div className={cn("inline-flex items-center rounded-lg border border-border bg-card p-0.5", className)}>
      {TIME_RANGES.map((r) => (
        <button
          key={r.hours}
          onClick={() => onChange(r.hours)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            value === r.hours
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          {r.short}
        </button>
      ))}
    </div>
  );
}