import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function ToggleBadge({ active, onClick, loading, activeClass, inactiveClass, activeLabel, inactiveLabel }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors whitespace-nowrap",
        active ? activeClass : inactiveClass,
        loading && "opacity-50 cursor-wait"
      )}
    >
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : active ? activeLabel : inactiveLabel}
    </button>
  );
}

export function InlineText({ value, onSave, loading, placeholder = "Click to add…", multiline = false, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const commit = () => {
    setEditing(false);
    if (draft !== (value || "")) onSave(draft);
  };
  const cancel = () => {
    setDraft(value || "");
    setEditing(false);
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
            if (e.key === "Escape") cancel();
          }}
          className="w-full bg-background border border-primary rounded px-1.5 py-1 text-xs min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-primary"
        />
      );
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
        className="w-full bg-background border border-primary rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value || ""); setEditing(true); }}
      className={cn(
        "cursor-pointer hover:bg-accent/60 rounded px-1.5 py-0.5 text-xs block min-h-[18px] transition-colors",
        !value && "text-muted-foreground/60 italic",
        loading && "opacity-50",
        className
      )}
    >
      {value || placeholder}
    </span>
  );
}