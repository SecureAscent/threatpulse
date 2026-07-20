'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Package, Shield, AlertTriangle, Plus, Search, X, Pencil, Trash2, Link2, Database,
} from 'lucide-react';
import { FadeIn, SlideIn } from '@/components/ui/animate';
import { toast } from 'sonner';
import { assetRiskBadgeClass } from '@/lib/risk-score';
import AddAssetModal, { type AssetForEdit } from './add-asset-modal';

interface CybellumAsset {
  id: string;
  cybellumId?: string | null;
  productName: string;
  productVersion?: string | null;
  packageName?: string | null;
  packageVersion?: string | null;
  productOwner?: string | null;
  ownerEmail?: string | null;
  department?: string | null;
  riskScore?: number | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  _count?: { threatLinks: number };
}

export default function ProductPortfolioContent() {
  const [assets, setAssets] = useState<CybellumAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AssetForEdit | null>(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('');

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cybellum/assets');
      if (res.ok) {
        const data = await res.json();
        setAssets(data?.assets ?? []);
      }
    } catch (err) {
      console.error('Fetch assets error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const filtered = useMemo(() => {
    return (assets ?? []).filter((a) => {
      if (search) {
        const q = search.toLowerCase();
        const hay = `${a.productName} ${a.packageName ?? ''} ${a.department ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (ownerFilter && !((a.productOwner ?? '').toLowerCase().includes(ownerFilter.toLowerCase()))) return false;
      const rs = a.riskScore ?? 0;
      if (riskFilter === 'high' && rs < 7) return false;
      if (riskFilter === 'medium' && (rs < 4 || rs >= 7)) return false;
      if (riskFilter === 'low' && rs >= 4) return false;
      return true;
    });
  }, [assets, search, riskFilter, ownerFilter]);

  const stats = useMemo(() => {
    const total = assets.length;
    const highRisk = assets.filter((a) => (a.riskScore ?? 0) >= 7).length;
    const scored = assets.filter((a) => a.riskScore != null);
    const avg = scored.length ? scored.reduce((s, a) => s + (a.riskScore ?? 0), 0) / scored.length : 0;
    const linked = assets.reduce((s, a) => s + (a._count?.threatLinks ?? 0), 0);
    return { total, highRisk, avg, linked };
  }, [assets]);

  const deleteAsset = async (id: string) => {
    try {
      const res = await fetch(`/api/cybellum/assets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Asset deleted');
        fetchAssets();
      } else {
        toast.error('Failed to delete asset');
      }
    } catch {
      toast.error('Failed to delete asset');
    }
  };

  const openEdit = (a: CybellumAsset) => {
    setEditing({
      id: a.id, productName: a.productName, productVersion: a.productVersion,
      packageName: a.packageName, packageVersion: a.packageVersion,
      productOwner: a.productOwner, ownerEmail: a.ownerEmail,
      department: a.department, riskScore: a.riskScore,
    });
    setAddOpen(true);
  };

  const openAdd = () => { setEditing(null); setAddOpen(true); };

  const hasFilters = search || riskFilter !== 'all' || ownerFilter;

  const statCards = [
    { label: 'Total Products', value: String(stats.total), icon: Package, color: 'text-primary' },
    { label: 'High Risk (≥7)', value: String(stats.highRisk), icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Avg Risk Score', value: stats.avg.toFixed(1), icon: Shield, color: 'text-orange-500' },
    { label: 'Threat Links', value: String(stats.linked), icon: Link2, color: 'text-blue-500' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto">
      <FadeIn>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Product Portfolio</h1>
              <p className="text-sm text-muted-foreground">Cybellum-connected products and SBOM risk overview</p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openAdd}><Plus className="w-3.5 h-3.5" /> Add Product</Button>
        </div>
      </FadeIn>

      {/* Cybellum not connected banner */}
      <FadeIn delay={0.03}>
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <Database className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-amber-600 dark:text-amber-400">Cybellum not yet connected.</span>{' '}
            <span className="text-amber-600/90 dark:text-amber-400/90">
              Assets below are manually entered. Connect Cybellum in Settings → Integrations to auto-sync your
              full product catalog and SBOM data.
            </span>
          </div>
        </div>
      </FadeIn>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <SlideIn key={card.label} from="bottom" delay={i * 0.05}>
            <Card className="border-border/50">
              <CardContent className="pt-4 pb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-display font-bold mt-1">{card.value}</p>
                </div>
                <card.icon className={`w-7 h-7 ${card.color} opacity-70`} />
              </CardContent>
            </Card>
          </SlideIn>
        ))}
      </div>

      {/* Filters */}
      <FadeIn delay={0.08}>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search products, packages..." value={search} onChange={(e: any) => setSearch(e.target.value)} className="pl-10 h-9" />
              </div>
              <Input placeholder="Product owner" value={ownerFilter} onChange={(e: any) => setOwnerFilter(e.target.value)} className="h-9 w-[180px]" />
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Risk Level" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="high">High (≥7)</SelectItem>
                  <SelectItem value="medium">Medium (4–7)</SelectItem>
                  <SelectItem value="low">Low (&lt;4)</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setRiskFilter('all'); setOwnerFilter(''); }} className="gap-1 text-xs">
                  <X className="w-3 h-3" /> Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Table */}
      <FadeIn delay={0.1}>
        <Card className="border-border/50">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-6">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No products configured</p>
                <p className="text-sm text-muted-foreground mt-1">Add a product manually, or connect Cybellum to import your catalog</p>
                <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={openAdd}><Plus className="w-4 h-4" /> Add Product</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-[160px]">Package</TableHead>
                      <TableHead className="w-[140px]">Owner</TableHead>
                      <TableHead className="w-[130px]">Department</TableHead>
                      <TableHead className="w-[100px]">Risk</TableHead>
                      <TableHead className="w-[110px]">Linked Threats</TableHead>
                      <TableHead className="w-[90px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => (
                      <TableRow key={a.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="font-medium text-sm">{a.productName}</div>
                          {a.productVersion && <div className="text-xs text-muted-foreground font-mono">v{a.productVersion}</div>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.packageName ? (
                            <span className="font-mono">{a.packageName}{a.packageVersion ? ` ${a.packageVersion}` : ''}</span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>{a.productOwner || '—'}</div>
                          {a.ownerEmail && <div className="text-muted-foreground">{a.ownerEmail}</div>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.department || '—'}</TableCell>
                        <TableCell>
                          {a.riskScore != null ? (
                            <Badge variant="outline" className={`text-[10px] font-mono ${assetRiskBadgeClass(a.riskScore)}`}>{a.riskScore.toFixed(1)}</Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] gap-1 bg-blue-500/10 text-blue-500 border-blue-500/20">
                            <Link2 className="w-3 h-3" /> {a._count?.threatLinks ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => deleteAsset(a.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-right mt-2">{filtered.length} product{filtered.length !== 1 ? 's' : ''} shown</p>
      </FadeIn>

      <AddAssetModal open={addOpen} onOpenChange={setAddOpen} asset={editing} onSuccess={fetchAssets} />
    </div>
  );
}
