'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, ExternalLink, KeyRound, ShieldCheck, ShieldAlert, Eye, Loader2, CheckCircle2, XCircle, Fingerprint, Clock } from 'lucide-react';
import EvidenceReveal from './evidence-reveal';

const STATUS_FLOW = [
  { value: 'new', label: 'New' },
  { value: 'validated', label: 'Validated' },
  { value: 'remediated', label: 'Remediated' },
  { value: 'false_positive', label: 'False Positive' },
];

const statusBadge: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  validated: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  false_positive: 'bg-muted text-muted-foreground border-border',
  remediated: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const sevBadge: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/20',
  HIGH: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  MEDIUM: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const kindLabel: Record<string, string> = {
  credential_leak: 'Credential Leak',
  mention: 'Mention',
  domain_exposure: 'Domain Exposure',
  identity_exposure: 'Identity Exposure',
};

function relTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ExposureFindingDetailContent() {
  const params = useParams();
  const id = params?.id as string;
  const [finding, setFinding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [validationNote, setValidationNote] = useState('');
  const [assignee, setAssignee] = useState('');

  const fetchFinding = useCallback(async () => {
    try {
      const res = await fetch(`/api/exposure/findings/${id}`);
      if (res.ok) {
        const data = await res.json();
        setFinding(data?.finding ?? null);
      }
    } catch (err) { console.error('Finding fetch error:', err); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchFinding(); }, [fetchFinding]);

  const changeStatus = async (newStatus: string) => {
    if (finding?.status === newStatus) return;
    setSavingStatus(newStatus);
    try {
      const res = await fetch(`/api/exposure/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, validationNote: validationNote.trim() || undefined }),
      });
      if (res.ok) { toast.success('Status updated'); setValidationNote(''); fetchFinding(); }
      else { toast.error('Failed to update status'); }
    } finally { setSavingStatus(null); }
  };

  const assign = async () => {
    if (!assignee.trim()) return;
    try {
      const res = await fetch(`/api/exposure/findings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: assignee.trim() }),
      });
      if (res.ok) { toast.success('Assigned'); setAssignee(''); fetchFinding(); }
    } catch {}
  };

  if (loading) return <div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (!finding) {
    return (
      <div className="p-8 max-w-2xl">
        <Link href="/exposure" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" /> Back to findings</Link>
        <Card><CardContent className="pt-10 pb-10 text-center"><ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" /><p className="text-sm text-muted-foreground">This finding could not be found.</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/exposure" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Back to findings</Link>
        <span className="text-xs font-mono text-muted-foreground">{finding.id}</span>
      </div>

      <Card className="border-border/50"><CardContent className="pt-5 pb-5 px-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge className={sevBadge[(finding.severity || '').toUpperCase()] ?? ''}>{finding.severity}</Badge>
          <Badge variant="outline" className={statusBadge[finding.status] || statusBadge.new}>{(finding.status || 'new').replace('_', ' ')}</Badge>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{kindLabel[finding.kind] || finding.kind}</span>
          {finding.sourceUrl && <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Source <ExternalLink className="w-3 h-3" /></a>}
        </div>
        <h1 className="text-xl font-bold leading-snug mb-2">{finding.title || 'Untitled Finding'}</h1>
        {finding.summary && <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{finding.summary}</p>}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-4 text-xs text-muted-foreground">
          <span>Detected {relTime(finding.createdAt)}</span>
          {finding.firstSeen && <span>First seen {relTime(finding.firstSeen)}</span>}
          {finding.lastSeen && <span>Last seen {relTime(finding.lastSeen)}</span>}
        </div>
      </CardContent></Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50"><CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center gap-2 mb-4"><KeyRound className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">Exposed Data</h3></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Affected Identity</p><p className="font-mono text-sm bg-muted/40 rounded-lg p-3">{finding.affectedIdentity || '—'}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Credential Sample</p><p className="font-mono text-sm bg-muted/40 rounded-lg p-3">{finding.credentialSample || '—'}</p></div>
              {finding.credentialHash && <div className="sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Credential Fingerprint</p><p className="font-mono text-xs bg-muted/40 rounded-lg p-3 break-all">{finding.credentialHash}</p></div>}
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 mt-4"><ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /><p className="text-xs text-amber-600 dark:text-amber-500">Sensitive data is masked by default. Use the evidence reveal action to view full content — all reveals are audit-logged.</p></div>
          </CardContent></Card>

          <Card className="border-border/50"><CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center gap-2 mb-4"><Eye className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">Evidence ({finding.evidence?.length || 0})</h3></div>
            {(!finding.evidence || finding.evidence.length === 0) ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No evidence records linked to this finding.</p>
            ) : (
              <div className="space-y-3">{finding.evidence.map((ev: any) => <EvidenceReveal key={ev.id} evidence={ev} findingId={finding.id} onRevealed={fetchFinding} />)}</div>
            )}
          </CardContent></Card>

          {finding.validationNotes && (
            <Card className="border-border/50"><CardContent className="pt-5 pb-5 px-5">
              <h3 className="font-semibold text-sm mb-3">Validation Notes</h3>
              <pre className="whitespace-pre-wrap text-sm text-foreground/90 bg-muted/40 rounded-lg p-4 font-body leading-relaxed">{finding.validationNotes}</pre>
            </CardContent></Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="border-border/50"><CardContent className="pt-5 pb-5 px-5">
            <h3 className="font-semibold text-sm mb-4">Status</h3>
            <div className="space-y-2 mb-4">
              {STATUS_FLOW.map((s) => {
                const active = finding.status === s.value;
                return (
                  <Button key={s.value} onClick={() => changeStatus(s.value)} disabled={savingStatus === s.value || active} variant="outline" className={`w-full justify-start gap-2 text-sm font-medium ${active ? 'bg-primary/10 text-primary border-primary/30' : ''}`}>
                    {savingStatus === s.value ? <Loader2 className="w-4 h-4 animate-spin" /> : active ? <CheckCircle2 className="w-4 h-4" /> : s.value === 'false_positive' ? <XCircle className="w-4 h-4 text-muted-foreground" /> : <div className="w-4 h-4 rounded-full border border-current opacity-40" />}
                    {s.label}
                  </Button>
                );
              })}
            </div>
            <Textarea value={validationNote} onChange={(e) => setValidationNote(e.target.value)} placeholder="Add a validation note (optional)…" rows={2} />
          </CardContent></Card>

          <Card className="border-border/50"><CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center gap-2 mb-3"><ShieldCheck className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">Assignment</h3></div>
            <p className="text-sm mb-3">{finding.assignedTo ? <span className="text-foreground">{finding.assignedTo}</span> : <span className="text-muted-foreground">Unassigned</span>}</p>
            <div className="flex gap-2"><Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Analyst name" /><Button onClick={assign} disabled={!assignee.trim()}>Assign</Button></div>
          </CardContent></Card>

          <Card className="border-border/50"><CardContent className="pt-5 pb-5 px-5">
            <h3 className="font-semibold text-sm mb-3">Metadata</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Confidence</dt><dd className="text-right">{finding.confidence || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Reliability</dt><dd className="text-right">{finding.reliability || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Attribution</dt><dd className="text-right">{finding.attributionStatus || '—'}</dd></div>
              {finding.fingerprint && <div className="flex items-center gap-1.5 pt-2 border-t border-border text-xs text-muted-foreground"><Fingerprint className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{finding.fingerprint.slice(0, 20)}…</span></div>}
              {finding.retentionExpires && <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="w-3.5 h-3.5 shrink-0" />Retention expires {relTime(finding.retentionExpires)}</div>}
            </dl>
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}