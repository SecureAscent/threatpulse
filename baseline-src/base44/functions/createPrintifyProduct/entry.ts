import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const API = 'https://api.printify.com/v1';

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function printify(token, path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    method: opts.method || 'GET',
    headers: authHeaders(token),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && (data.message || data.error))
      ? (data.message || JSON.stringify(data))
      : `Printify error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function getShop(token, shopId) {
  const shops = await printify(token, '/shops.json');
  if (!shops || !shops.length) throw new Error('No Printify shops found. Connect a shop to your Shopify store in Printify first.');
  if (shopId) {
    const match = shops.find((s) => String(s.id) === String(shopId));
    if (match) return match;
  }
  const tp = shops.find((s) => /threatpulse/i.test(s.title || ''));
  return tp || shops[0];
}

function variantLabel(v) {
  const parts = [v.color, v.size].filter(Boolean);
  if (parts.length) return parts.join(' / ');
  if (v.options) return Object.values(v.options).join(' / ');
  return 'Variant ' + v.id;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (user.role || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin';
    if (!isAdmin) return Response.json({ error: 'Admin access required' }, { status: 403 });

    const token = secrets.get('PRINTIFY_API_TOKEN');
    if (!token) return Response.json({ error: 'PRINTIFY_API_TOKEN secret not set' }, { status: 500 });

    let body = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const action = body.action || 'shops';

    if (action === 'shops') {
      const shops = await printify(token, '/shops.json');
      const shopsOut = (shops || []).map((s) => {
        return { id: s.id, title: s.title, sales_channel: s.sales_channel };
      });
      return Response.json({ shops: shopsOut });
    }

    if (action === 'catalog') {
      const blueprints = await printify(token, '/catalog/blueprints.json');
      const out = (blueprints || []).map((b) => {
        return { id: b.id, title: b.title, brand: b.brand, model: b.model };
      });
      return Response.json({ blueprints: out });
    }

    if (action === 'providers') {
      const bp = Number(body.blueprint_id);
      if (!bp) return Response.json({ error: 'blueprint_id required' }, { status: 400 });
      const providers = await printify(token, `/catalog/blueprints/${bp}/print_providers.json`);
      const out = (providers || []).map((p) => {
        return { id: p.id, title: p.title, location: p.location };
      });
      return Response.json({ providers: out });
    }

    if (action === 'variants') {
      const bp = Number(body.blueprint_id);
      const pp = Number(body.print_provider_id);
      if (!bp || !pp) return Response.json({ error: 'blueprint_id and print_provider_id required' }, { status: 400 });
      const data = await printify(token, `/catalog/blueprints/${bp}/print_providers/${pp}/variants.json`);
      const variants = (data && data.variants) ? data.variants : (Array.isArray(data) ? data : []);
      const positions = [];
      const seen = new Set();
      variants.forEach((v) => {
        (v.placeholders || []).forEach((ph) => {
          if (ph.position && !seen.has(ph.position)) { seen.add(ph.position); positions.push(ph.position); }
        });
      });
      const out = variants.map((v) => {
        return { id: v.id, label: variantLabel(v), cost: v.cost };
      });
      return Response.json({ variants: out, positions });
    }

    if (action === 'create') {
      const bp = Number(body.blueprint_id);
      const pp = Number(body.print_provider_id);
      const title = (body.title || '').trim();
      const description = (body.description || '').trim();
      const designUrl = (body.design_image_url || '').trim();
      const priceDollars = Number(body.price);
      if (!bp || !pp || !title || !designUrl || !priceDollars) {
        return Response.json({ error: 'blueprint_id, print_provider_id, title, design_image_url, and price are required' }, { status: 400 });
      }

      const shop = await getShop(token, body.shop_id);
      const shopId = shop.id;

      const fileName = (designUrl.split('/').pop() || 'design.png').split('?')[0];
      const upload = await printify(token, '/uploads/images.json', {
        method: 'POST',
        body: { file_name: fileName, url: designUrl },
      });
      const imageId = upload && upload.id;
      if (!imageId) throw new Error('Image upload failed: no image id returned');

      let variantIds = (Array.isArray(body.variant_ids) && body.variant_ids.length)
        ? body.variant_ids.map(Number).filter(Boolean)
        : null;
      if (!variantIds || !variantIds.length) {
        const vdata = await printify(token, `/catalog/blueprints/${bp}/print_providers/${pp}/variants.json`);
        const all = (vdata && vdata.variants) ? vdata.variants : [];
        variantIds = all.map((v) => v.id);
      }
      if (!variantIds.length) throw new Error('No variants available for this blueprint / provider');

      const priceCents = Math.round(priceDollars * 100);
      const variantsPayload = variantIds.map((id) => {
        return { id, price: priceCents, is_enabled: true };
      });
      const position = (body.placeholder || 'front').trim();

      const created = await printify(token, `/shops/${shopId}/products.json`, {
        method: 'POST',
        body: {
          title,
          description: description || title,
          blueprint_id: bp,
          print_provider_id: pp,
          variants: variantsPayload,
          print_areas: {
            default: [{ placeholder: position, image_id: String(imageId) }],
          },
        },
      });

      let publishResult = null;
      if (body.publish !== false && created && created.id) {
        try {
          publishResult = await printify(token, `/shops/${shopId}/products/${created.id}/publish.json`, {
            method: 'POST',
            body: { external: { shipping_template_id: null } },
          });
        } catch (e) {
          publishResult = { error: e.message };
        }
      }

      const productOut = created && created.id ? {
        id: created.id,
        title: created.title,
        status: created.status,
        variants: (created.variants || []).length,
        image: (created.images && created.images[0]) || null,
      } : created;

      return Response.json({
        status: 'success',
        shop_id: shopId,
        product: productOut,
        published: body.publish !== false,
        publish_result: publishResult,
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}