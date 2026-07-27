'use client';
import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AnalystRef } from '@/lib/types';

let cachedAnalysts: AnalystRef[] | null = null;
let inflight: Promise<AnalystRef[]> | null = null;

/** Fetch (and cache) the org analyst roster used for assignment dropdowns. */
export async function fetchAnalysts(force = false): Promise<AnalystRef[]> {
  if (cachedAnalysts && !force) return cachedAnalysts;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch('/api/org/analysts');
      if (!res.ok) return [];
      const data = await res.json();
      cachedAnalysts = data?.analysts ?? [];
      return cachedAnalysts as AnalystRef[];
    } catch {
      return [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useAnalysts(): AnalystRef[] {
  const [analysts, setAnalysts] = useState<AnalystRef[]>(cachedAnalysts ?? []);
  useEffect(() => {
    let mounted = true;
    fetchAnalysts().then((list) => {
      if (mounted) setAnalysts(list);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return analysts;
}

export function analystLabel(a: AnalystRef | null | undefined): string {
  if (!a) return 'Unassigned';
  return a.name || a.email || 'Unknown';
}

export function analystInitials(a: AnalystRef | null | undefined): string {
  if (!a) return '?';
  const src = a.name || a.email || '?';
  const parts = src.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const UNASSIGNED = '__unassigned__';

/** Reusable assignee dropdown. Emits null when set to "Unassigned". */
export function AnalystSelect({
  value,
  onChange,
  disabled,
  className,
  placeholder = 'Unassigned',
}: {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const analysts = useAnalysts();
  return (
    <Select
      value={value ?? UNASSIGNED}
      onValueChange={(v) => onChange(v === UNASSIGNED ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        {analysts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {analystLabel(a)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
