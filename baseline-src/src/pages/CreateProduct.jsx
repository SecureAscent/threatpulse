import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Image } from "@/components/ui/image";
import {
  Package,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  ImageIcon,
  ArrowLeft,
  ExternalLink,
  Shirt,
  Store,
  Layers,
} from "lucide-react";

export default function CreateProduct() {
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [publish, setPublish] = useState(true);
  const [placeholder, setPlaceholder] = useState("front");

  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState("");
  const [blueprints, setBlueprints] = useState([]);
  const [blueprintId, setBlueprintId] = useState("");
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState("");
  const [variants, setVariants] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState([]);

  const [designUrl, setDesignUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    setCatalogLoading(true);
    Promise.all([
      base44.functions.invoke("createPrintifyProduct", { action: "shops" }),
      base44.functions.invoke("createPrintifyProduct", { action: "catalog" }),
    ])
      .then(([s, c]) => {
        const sh = s.data.shops || [];
        setShops(sh);
        const tp = sh.find((x) => /threatpulse/i.test(x.title || ""));
        setShopId(tp ? String(tp.id) : (sh[0] ? String(sh[0].id) : ""));
        setBlueprints(c.data.blueprints || []);
      })
      .catch((e) => setCatalogError(e.response?.data?.error || e.message || "Failed to load catalog"))
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    if (!blueprintId) return;
    setProviders([]);
    setProviderId("");
    setVariants([]);
    setSelectedVariants([]);
    base44.functions.invoke("createPrintifyProduct", { action: "providers", blueprint_id: Number(blueprintId) })
      .then((r) => setProviders(r.data.providers || []))
      .catch((e) => setCatalogError(e.response?.data?.error || e.message));
  }, [blueprintId]);

  useEffect(() => {
    if (!blueprintId || !providerId) return;
    setVariants([]);
    setSelectedVariants([]);
    base44.functions.invoke("createPrintifyProduct", { action: "variants", blueprint_id: Number(blueprintId), print_provider_id: Number(providerId) })
      .then((r) => {
        const vs = r.data.variants || [];
        setVariants(vs);
        setPositions(r.data.positions || []);
        setSelectedVariants(vs.map((v) => v.id));
      })
      .catch((e) => setCatalogError(e.response?.data?.error || e.message));
  }, [blueprintId, providerId]);

  useEffect(() => {
    if (positions.length && (!placeholder || !positions.includes(placeholder))) {
      setPlaceholder(positions.includes("front") ? "front" : positions[0]);
    }
  }, [positions]);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    setError("");
    try {
    const res = await base44.integrations.Core.UploadFile({ file: f });
    setDesignUrl(res.file_url);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const toggleVariant = (id) => {
    setSelectedVariants((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const selectAllVariants = () => setSelectedVariants(variants.map((v) => v.id));
  const selectNoVariants = () => setSelectedVariants([]);

  const canCreate = title && designUrl && price && blueprintId && providerId && selectedVariants.length;

  const create = async () => {
    if (!canCreate) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await base44.functions.invoke("createPrintifyProduct", {
        action: "create",
        shop_id: shopId ? Number(shopId) : undefined,
        blueprint_id: Number(blueprintId),
        print_provider_id: Number(providerId),
        title,
        description,
        price: Number(price),
        design_image_url: designUrl,
        variant_ids: selectedVariants,
        placeholder,
        publish,
      });
      setResult(res.data);
      toast({ title: "Product created in Printify" });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const shop = shops[0];

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Admin
        </Link>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" /> Create Product
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Build a product in Printify and publish it to your connected Shopify store.
        </p>
      </div>

      {catalogError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 mb-6 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" /> {catalogError}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Product details */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Shirt className="w-4 h-4 text-primary" /> Product Details</h3>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ThreatPulse Logo Tee" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring" />
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Premium tri-blend tee featuring the ThreatPulse pulse mark." className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring resize-y" />
          <label className="block text-xs font-medium text-muted-foreground mb-1">Retail price (USD)</label>
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="28.00" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="rounded border-input" />
            Publish to Shopify after creating
          </label>
        </div>

        {/* Catalog */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Catalog</h3>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Printify shop (publishes to Shopify)</label>
          <select value={shopId} onChange={(e) => setShopId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring">
            {shops.map((s) => (<option key={s.id} value={s.id}>{s.title}</option>))}
          </select>
          {catalogLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading Printify catalog…</div>
          ) : (
            <>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Blueprint (product type)</label>
              <select value={blueprintId} onChange={(e) => setBlueprintId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select a blueprint…</option>
                {blueprints.map((b) => (
                  <option key={b.id} value={b.id}>{b.brand ? `${b.brand} — ` : ""}{b.title}</option>
                ))}
              </select>

              <label className="block text-xs font-medium text-muted-foreground mb-1">Print provider</label>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} disabled={!blueprintId} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                <option value="">Select a provider…</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}{p.location ? ` (${p.location})` : ""}</option>
                ))}
              </select>

              {positions.length > 0 && (
                <>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Design position</label>
                  <select value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring">
                    {positions.map((p) => (<option key={p} value={p}>{p}</option>))}
                  </select>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Variants */}
      {variants.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Variants ({selectedVariants.length}/{variants.length} selected)</h3>
            <div className="flex gap-2">
              <button onClick={selectAllVariants} className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent transition-colors">Select all</button>
              <button onClick={selectNoVariants} className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent transition-colors">Clear</button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {variants.map((v) => (
              <label key={v.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent/50 cursor-pointer">
                <input type="checkbox" checked={selectedVariants.includes(v.id)} onChange={() => toggleVariant(v.id)} className="rounded border-input" />
                <span className="truncate">{v.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Design */}
      <div className="rounded-xl border border-border bg-card p-5 mt-6">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" /> Design Artwork</h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Upload design file</label>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-input text-sm font-medium hover:bg-accent transition-colors cursor-pointer">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading…" : "Choose file"}
                <input type="file" accept="image/*" onChange={onFile} className="hidden" disabled={uploading} />
              </label>
            </div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 mt-3">…or design image URL</label>
            <input value={designUrl} onChange={(e) => setDesignUrl(e.target.value)} placeholder="https://…/threatpulse-design.png" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-xs text-muted-foreground mt-2">Image must be publicly accessible (Printify downloads it).</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 flex items-center justify-center min-h-32 overflow-hidden">
            {designUrl ? (
              <Image src={designUrl} alt="Design preview" className="w-full h-40" fittingType="fit" />
            ) : (
              <span className="text-xs text-muted-foreground">Design preview</span>
            )}
          </div>
        </div>
      </div>

      {/* Create */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={create}
          disabled={!canCreate || busy}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
          {busy ? "Creating…" : "Create Product"}
        </button>
        {!canCreate && <span className="text-xs text-muted-foreground">Fill title, blueprint, provider, price, design, and at least one variant.</span>}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 mt-4 text-sm text-red-500">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold text-sm">Product created</h3>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Printify ID</dt><dd className="font-mono">{result.product?.id ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Title</dt><dd>{result.product?.title ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Status</dt><dd>{result.product?.status ?? "draft"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Variants</dt><dd>{result.product?.variants ?? "—"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Shop</dt><dd>{result.shop_id}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Published</dt><dd>{result.published ? "Yes" : "No"}</dd></div>
          </dl>
          {result.publish_result?.error && (
            <p className="text-xs text-amber-500 mt-3">Publish note: {result.publish_result.error} (product saved as draft in Printify.)</p>
          )}
          <div className="flex gap-3 mt-4">
            <a href="https://threatpulse.myshopify.com/admin/products" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              View in Shopify <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a href="https://printify.com/app/products" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
              View in Printify <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}