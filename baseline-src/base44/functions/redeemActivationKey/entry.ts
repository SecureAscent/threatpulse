import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const code = (body?.code || '').trim();
    if (!code) return Response.json({ error: 'Activation key is required' }, { status: 400 });

    const keys = await base44.asServiceRole.entities.ActivationKey.filter({ code });
    if (!keys.length) return Response.json({ error: 'Invalid activation key' }, { status: 404 });

    const key = keys[0];
    if (key.status === 'redeemed') {
      return Response.json({ error: 'This activation key has already been redeemed' }, { status: 409 });
    }

    await base44.asServiceRole.entities.ActivationKey.update(key.id, {
      status: 'redeemed',
      redeemed_by_id: user.id,
      redeemed_by_email: user.email,
      redeemed_date: new Date().toISOString(),
    });

    return Response.json({ success: true, tier: key.tier });
  } catch (error) {
    return Response.json({ error: error.message || 'Redemption failed' }, { status: 500 });
  }
}