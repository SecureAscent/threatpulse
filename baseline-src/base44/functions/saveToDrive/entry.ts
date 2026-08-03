import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const filename = (body && body.filename) || 'ThreatPulse-Port-Guide.md';
    const content = (body && body.content) || '';
    const mimeType = (body && body.mimeType) || 'text/markdown';
    const parentId = (body && body.parentId) || '';

    if (!content) {
      return Response.json({ error: 'No content provided' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
    if (!accessToken) {
      return Response.json({ error: 'Google Drive not connected' }, { status: 401 });
    }

    const meta = { name: filename, mimeType };
    if (parentId) meta.parents = [parentId];

    const boundary = 'tp-' + Math.random().toString(16).slice(2);
    const metadataPart =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(meta) + '\r\n';
    const contentPart =
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n` +
      content + '\r\n' +
      `--${boundary}--\r\n`;

    const multipart =
      metadataPart + contentPart;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipart
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `Drive upload failed: ${res.status} ${errText}` }, { status: 502 });
    }

    const file = await res.json();
    return Response.json({ ok: true, file });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}