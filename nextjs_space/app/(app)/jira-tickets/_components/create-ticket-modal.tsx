'use client';
import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Save, ExternalLink, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import type { ThreatItem } from '@/lib/types';

const severityToPriority: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

interface CybellumAsset {
  id: string;
  productName: string;
  productVersion?: string | null;
  packageName?: string | null;
  productOwner?: string | null;
  ownerEmail?: string | null;
}

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threat?: ThreatItem | null;      // when opened from a threat context
  threats?: ThreatItem[];          // when opened standalone (choose a threat)
  onSuccess?: () => void;
}

export default function CreateTicketModal({ open, onOpenChange, threat, threats, onSuccess }: CreateTicketModalProps) {
  const [assets, setAssets] = useState<CybellumAsset[]>([]);
  const [availableThreats, setAvailableThreats] = useState<ThreatItem[]>(threats ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({
    threatId: '',
    title: '',
    description: '',
    priority: 'Medium',
    affectedProduct: '',
    affectedPackage: '',
    productOwner: '',
    cvssScore: '',
    cveId: '',
    remediationSteps: '',
    notes: '',
    assetId: '',
  });

  const update = (field: string, value: string) => setForm((prev: any) => ({ ...(prev ?? {}), [field]: value }));

  const prefillFromThreat = useCallback((t?: ThreatItem | null) => {
    if (!t) return;
    setForm((prev: any) => ({
      ...prev,
      threatId: t.id,
      title: `[${t.threatId ?? ''}] ${t.title ?? ''}`.trim(),
      description: t.description || '',
      priority: severityToPriority[(t.severity || '').toUpperCase()] || 'Medium',
      cvssScore: t.cvssScore != null ? String(t.cvssScore) : '',
      cveId: t.type === 'CVE' ? (t.threatId ?? '') : '',
      affectedProduct: t.affectedAssets || '',
      remediationSteps: '',
    }));
  }, []);

  // Load cybellum assets + threats (if standalone) when the modal opens.
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch('/api/cybellum/assets');
        if (res.ok) {
          const data = await res.json();
          setAssets(data?.assets ?? []);
        }
      } catch { /* offline stub */ }
    })();
    if (!threat && (!threats || threats.length === 0)) {
      (async () => {
        try {
          const res = await fetch('/api/threats');
          if (res.ok) {
            const data = await res.json();
            setAvailableThreats(data?.threats ?? []);
          }
        } catch { /* ignore */ }
      })();
    } else if (threats) {
      setAvailableThreats(threats);
    }
    if (threat) prefillFromThreat(threat);
  }, [open, threat, threats, prefillFromThreat]);

  const onSelectThreat = (threatDbId: string) => {
    const t = (availableThreats ?? []).find((x) => x.id === threatDbId);
    if (t) prefillFromThreat(t);
    else update('threatId', threatDbId);
  };

  const onSelectAsset = (assetId: string) => {
    update('assetId', assetId);
    const a = (assets ?? []).find((x) => x.id === assetId);
    if (a) {
      setForm((prev: any) => ({
        ...prev,
        assetId,
        affectedProduct: a.productName + (a.productVersion ? ` ${a.productVersion}` : ''),
        affectedPackage: a.packageName || prev.affectedPackage,
        productOwner: a.productOwner || prev.productOwner,
      }));
    }
  };

  const submit = async (createInJira: boolean) => {
    if (!form.threatId) { toast.error('Please select a threat for this ticket'); return; }
    if (!form.title) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/jira-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threatId: form.threatId,
          title: form.title,
          description: form.description,
          priority: form.priority,
          affectedProduct: form.affectedProduct,
          affectedPackage: form.affectedPackage,
          productOwner: form.productOwner,
          cvssScore: form.cvssScore,
          cveId: form.cveId,
          remediationSteps: form.remediationSteps,
          notes: form.notes,
          status: 'DRAFT', // always draft — Jira integration pending
        }),
      });
      if (res.ok) {
        if (createInJira) {
          toast.success('Ticket saved as draft — will sync to Jira once the integration is enabled');
        } else {
          toast.success('Ticket saved as draft');
        }
        onOpenChange(false);
        onSuccess?.();
      } else {
        const data = await res.json();
        toast.error(data?.error ?? 'Failed to save ticket');
      }
    } catch {
      toast.error('Failed to save ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" /> Create Jira Ticket
          </DialogTitle>
          <DialogDescription>
            Pre-populated from threat intelligence. Review, attach a Cybellum asset, and save.
          </DialogDescription>
        </DialogHeader>

        {/* Jira not connected banner */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
            <span className="font-semibold">Jira integration not yet configured.</span> Tickets are saved as
            drafts and will be created in Jira automatically once the integration is enabled in
            Settings → Integrations.
          </p>
        </div>

        <div className="space-y-4 py-2">
          {/* Threat selector (standalone only) */}
          {!threat && (
            <div className="space-y-1.5">
              <Label className="text-xs">Related Threat *</Label>
              <Select value={form.threatId} onValueChange={onSelectThreat}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a threat..." /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {(availableThreats ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="font-mono text-xs">{t.threatId}</span> — {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Summary / Title *</Label>
            <Input value={form.title} onChange={(e: any) => update('title', e.target.value)} className="h-9 text-sm" placeholder="Ticket summary" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={(v: string) => update('priority', v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CVSS Score</Label>
              <Input value={form.cvssScore} onChange={(e: any) => update('cvssScore', e.target.value)} className="h-9 text-sm" placeholder="0-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CVE ID</Label>
              <Input value={form.cveId} onChange={(e: any) => update('cveId', e.target.value)} className="h-9 text-sm" placeholder="CVE-YYYY-NNNN" />
            </div>
          </div>

          {/* Cybellum asset dropdown */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              Affected Cybellum Asset
              <span className="text-[10px] text-muted-foreground font-normal">(optional — pre-fills product & owner)</span>
            </Label>
            <Select value={form.assetId} onValueChange={onSelectAsset}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={assets.length ? 'Select an asset...' : 'No Cybellum assets yet'} /></SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {(assets ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.productName}{a.productVersion ? ` ${a.productVersion}` : ''}{a.packageName ? ` · ${a.packageName}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Affected Product</Label>
              <Input value={form.affectedProduct} onChange={(e: any) => update('affectedProduct', e.target.value)} className="h-9 text-sm" placeholder="Product name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Affected Package</Label>
              <Input value={form.affectedPackage} onChange={(e: any) => update('affectedPackage', e.target.value)} className="h-9 text-sm" placeholder="e.g. openssl 1.1.1" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Product Owner</Label>
            <Input value={form.productOwner} onChange={(e: any) => update('productOwner', e.target.value)} className="h-9 text-sm" placeholder="Owner / assignee" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e: any) => update('description', e.target.value)} className="text-sm min-h-[80px]" placeholder="Ticket description" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Remediation Steps</Label>
            <Textarea value={form.remediationSteps} onChange={(e: any) => update('remediationSteps', e.target.value)} className="text-sm min-h-[60px]" placeholder="Recommended remediation" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e: any) => update('notes', e.target.value)} className="text-sm min-h-[50px]" placeholder="Internal notes" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => submit(false)} loading={submitting} className="gap-1.5">
            <Save className="w-4 h-4" /> Save as Draft
          </Button>
          <Button onClick={() => submit(true)} loading={submitting} className="gap-1.5">
            <ExternalLink className="w-4 h-4" /> Create in Jira
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
