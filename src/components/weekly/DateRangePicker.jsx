import React, { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function toDate(s) {
  if (!s) return undefined;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? undefined : d;
}

function toStr(d) {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DateRangePicker({ value, onChange, className }) {
  const [open, setOpen] = useState(false);
  const selected = {
    from: toDate(value.start),
    to: toDate(value.end),
  };

  const handleSelect = (range) => {
    if (!range) {
      onChange({ start: "", end: "" });
      return;
    }
    const next = { start: toStr(range.from), end: toStr(range.to) };
    onChange(next);
    if (range.from && range.to) setOpen(false);
  };

  const label =
    value.start || value.end
      ? `${value.start ? format(toDate(value.start), "MMM d, yyyy") : "Start"} → ${value.end ? format(toDate(value.end), "MMM d, yyyy") : "Today"}`
      : "Pick a date range";

  return (
    <div className={cn("inline-flex items-center", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-accent transition-colors"
          >
            <CalendarIcon className="w-4 h-4 text-muted-foreground" />
            <span className={cn(value.start || value.end ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={selected}
            onSelect={handleSelect}
            numberOfMonths={2}
            initialFocus
          />
          {(value.start || value.end) && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={() => {
                  onChange({ start: "", end: "" });
                  setOpen(false);
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5"
              >
                Clear dates
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}