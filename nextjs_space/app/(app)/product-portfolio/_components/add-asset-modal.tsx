'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package } from 'lucide-react';
import { toast } from 'sonner';

export interface AssetForEdit {
  id?: string;
  productName?: string;
  productVersion?: string | null;
  packageName?: string | null;
  packageVersion?: string | null;
  productOwner?: string | null;
  ownerEmail?: string | null;
  department?: string | null;
  riskScore?: number | null;
}

interface AddAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: AssetForEdit | null; // when editing
  onSuccess?: () => void;
}

const emptyForm = {
  productName: '', productVersion: '', packageName: '', packageVersion: '',
  productOwner: '', ownerEmail: '', department: '', riskScore: '',
};

export default function AddAssetModal({ open, onOpenChange, asset, onSuccess }: AddAssetModalProps) {
  const [form, setForm] = useState<any>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!asset?.id;

  useEffect(() => {
    if (open) {
      if (asset) {
        setForm({
          productName: asset.productName || '',
          productVersion: asset.productVersion || '',
          packageName: asset.packageName || '',
          packageVersion: asset.packageVersion || '',
          productOwner: asset.productOwner || '',
          ownerEmail: asset.ownerEmail || '',
          department: asset.department || '',
          riskScore: asset.riskScore != null ? String(asset.riskScore) : '',
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, asset]);

  const update = (field: string, value: string) => setForm((prev: any) => ({ ...(prev ?? {}), [field]: value }));

  const submit = async () => {
    if (!form.productName) { toast.error('Product name is required'); return; }
    setSubmitting(true);
    try {
      const url = isEdit ? `/api/cybellum/assets/${asset!.id}` : '/api/cybellum/assets';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(isEdit ? 'Asset updated' : 'Asset added');
        onOpenChange(false);
        onSuccess?.();
      } else {
        const data = await res.json();
        toast.error(data?.error ?? 'Failed to save asset');
      }
    } catch {
      toast.error('Failed to save asset');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> {isEdit ? 'Edit Asset' : 'Add Product / Asset'}
          </DialogTitle>
          <DialogDescription>
            Manually enter a product or package. This will sync with Cybellum once the integration is enabled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Product Name *</Label>
              <Input value={form.productName} onChange={(e: any) => update('productName', e.target.value)} className="h-9 text-sm" placeholder="e.g. Gateway ECU" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Product Version</Label>
              <Input value={form.productVersion} onChange={(e: any) => update('productVersion', e.target.value)} className="h-9 text-sm" placeholder="e.g. 2.4.1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Package Name</Label>
              <Input value={form.packageName} onChange={(e: any) => update('packageName', e.target.value)} className="h-9 text-sm" placeholder="e.g. openssl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Package Version</Label>
              <Input value={form.packageVersion} onChange={(e: any) => update('packageVersion', e.target.value)} className="h-9 text-sm" placeholder="e.g. 1.1.1k" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Product Owner</Label>
              <Input value={form.productOwner} onChange={(e: any) => update('productOwner', e.target.value)} className="h-9 text-sm" placeholder="Owner name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Owner Email</Label>
              <Input value={form.ownerEmail} onChange={(e: any) => update('ownerEmail', e.target.value)} className="h-9 text-sm" placeholder="owner@company.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Input value={form.department} onChange={(e: any) => update('department', e.target.value)} className="h-9 text-sm" placeholder="e.g. Powertrain" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Risk Score (0-10)</Label>
              <Input value={form.riskScore} onChange={(e: any) => update('riskScore', e.target.value)} className="h-9 text-sm" placeholder="e.g. 7.5" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={submitting}>{isEdit ? 'Save Changes' : 'Add Asset'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
