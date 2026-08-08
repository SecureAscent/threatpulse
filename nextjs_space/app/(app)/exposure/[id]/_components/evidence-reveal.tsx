'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, ShieldCheck, Clock } from 'lucide-react';

function maskContent(text: string | null | undefined): string {
  if (!text) return '—';
  if (text.length <= 8) return '••••';
  return text.slice(0, 4) + '•'.repeat(Math.min(text.length - 8, 24)) + text.slice(-4);
}

function relTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function EvidenceReveal({ evidence, findingId, onRevealed }: { evidence: any; findingId: string; onRevealed?: () => void }) {
  const [revealing, setRevealing] = useState(false);
  const isRevealed = evidence.revealed && (!evidence.revealExpires || new Date(evidence.revealExpires).getTime() > Date.now());

  const handleReveal = async () => {
    setRevealing(true);
    try {
      const res = await fetch(`/api/exposure/findings/${findingId}/evidence/${evidence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reveal: true }),
      });
      if (res.ok) { toast.success('Evidence revealed'); onRevealed?.(); }
      else { toast.error('Reveal failed — may require admin role'); }
    } catch { toast.error('Reveal failed'); }
    finally { setRevealing(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {isRevealed ? <Eye className="w-4 h-4 text-emerald-500 shrink-0" /> : <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium">{evidence.contentHash ? `Evidence #${evidence.contentHash.slice(0, 8)}` : 'Evidence'}</p>
            <p className="text-xs text-muted-foreground truncate">{evidence.capturedDate && `Captured ${relTime(evidence.capturedDate)}`}{evidence.termsClass && ` · ${evidence.termsClass}`}</p>
          </div>
        </div>
        {isRevealed ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium shrink-0"><ShieldCheck className="w-3.5 h-3.5" /> Revealed</span>
        ) : (
          <Button onClick={handleReveal} disabled={revealing} size="sm" variant="outline" className="gap-1.5 text-xs">{revealing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Reveal</Button>
        )}
      </div>
      <div className="rounded-md bg-muted/40 p-3">
        <p className={`text-sm font-mono leading-relaxed break-words ${isRevealed ? 'text-foreground' : 'text-muted-foreground'}`}>{isRevealed ? (evidence.contentExcerpt || 'No content available') : maskContent(evidence.contentExcerpt)}</p>
      </div>
      {isRevealed && evidence.revealExpires && <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2"><Clock className="w-3 h-3" /> Reveal expires {relTime(evidence.revealExpires)}</p>}
      {evidence.revealAudit && (
        <details className="mt-2"><summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Reveal audit log</summary><pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap font-mono">{evidence.revealAudit}</pre></details>
      )}
    </div>
  );
}