import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SourceFilter({ sources, selected, onToggle, onToggleAll, mode, onModeChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const count = selected.size;
  const all = count === sources.length && sources.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
      >
        <Filter className="w-4 h-4" />
        <span className="hidden sm:inline">Sources</span>
        <span className="text-xs text-muted-foreground">({count}/{sources.length})</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 rounded-lg border border-border bg-popover shadow-lg z-30 max-h-80 overflow-y-auto">
          <div className="px-3 py-2 border-b border-border sticky top-0 bg-popover space-y-2">
            <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
              <button
                onClick={() => onModeChange("include")}
                className={cn("flex-1 text-xs font-medium px-2 py-1 rounded transition-colors", mode === "include" ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                Include
              </button>
              <button
                onClick={() => onModeChange("exclude")}
                className={cn("flex-1 text-xs font-medium px-2 py-1 rounded transition-colors", mode === "exclude" ? "bg-popover text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                Exclude
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button onClick={onToggleAll} className="text-xs text-primary hover:underline font-medium">
                {all ? "Deselect all" : "Select all"}
              </button>
              <span className="text-xs text-muted-foreground">{count} {mode === "exclude" ? "excluded" : "selected"}</span>
            </div>
          </div>
          {sources.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">No sources available</p>
          ) : (
            sources.map((src) => (
              <label key={src} className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent/50 cursor-pointer text-sm">
                <span
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                    selected.has(src) ? "bg-primary border-primary" : "border-input"
                  )}
                >
                  {selected.has(src) && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                <input type="checkbox" checked={selected.has(src)} onChange={() => onToggle(src)} className="sr-only" />
                <span className="truncate">{src}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}