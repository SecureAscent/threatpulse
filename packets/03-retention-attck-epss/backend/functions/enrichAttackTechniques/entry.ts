import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// AI-assisted MITRE ATT&CK technique mapping. Given a threat's title/description/
// affected products, asks the LLM to return canonical ATT&CK technique IDs + names
// + tactics, then persists them as a compact JSON string on the threat.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch {}
    const threatId = body.threat_id || body.id;
    const actorId = body.actor_id;
    if (!threatId && !actorId) {
      return Response.json({ error: "threat_id or actor_id required" }, { status: 400 });
    }

    const isActor = !!actorId;
    const entity = isActor ? "ThreatActor" : "Threat";
    const recordId = isActor ? actorId : threatId;

    const record = await base44.asServiceRole.entities[entity].get(recordId);
    if (!record) {
      return Response.json({ error: `${entity} not found` }, { status: 404 });
    }

    const text = [
      record.title || record.name,
      record.description,
      record.summary,
      record.affected_products,
      record.malware_printable,
      record.threat_type,
      record.tags,
      record.cve_id,
    ].filter(Boolean).join("\n");

    if (!text.trim()) {
      return Response.json({ error: "Insufficient content to map techniques" }, { status: 400 });
    }

    const prompt = [
      "You are a MITRE ATT&CK mapping analyst. Given the threat intelligence below, identify the most relevant MITRE ATT&CK Enterprise techniques.",
      "Return only canonical ATT&CK technique IDs (e.g. T1566, T1486, T1190) that are genuinely implied by the threat's observed or expected behavior.",
      "If the threat is a pure vulnerability/CVE with no clear adversary behavior, return only the techniques that exploitation of it would most commonly enable (e.g. T1190 for a public-facing app vuln), or an empty list if none clearly apply.",
      "Do not invent technique IDs. Use only real ATT&CK technique IDs and their official names/tactics.",
      "",
      "THREAT INTELLIGENCE:",
      text,
    ].join("\n");

    const schema = {
      type: "object",
      properties: {
        techniques: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "ATT&CK technique ID e.g. T1566 (may include sub-technique .003)" },
              name: { type: "string", description: "Official technique name" },
              tactic: { type: "string", description: "ATT&CK tactic the technique belongs to" },
            },
            required: ["id", "name"],
          },
        },
      },
    };

    const llm = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
    });

    const raw = (llm && Array.isArray(llm.techniques)) ? llm.techniques : [];
    const valid = raw
      .filter((t) => t && typeof t.id === "string" && /^T\d{4}(\.\d{3})?$/.test(t.id))
      .map((t) => ({
        id: t.id,
        name: typeof t.name === "string" ? t.name : "",
        tactic: typeof t.tactic === "string" ? t.tactic : "",
      }))
      .slice(0, 12);

    const attack_techniques = JSON.stringify(valid);

    await base44.asServiceRole.entities[entity].update(recordId, { attack_techniques });

    return Response.json({
      status: "success",
      entity,
      id: recordId,
      techniques: valid,
      attack_techniques,
    });
  } catch (error) {
    return Response.json({ error: error?.message || "ATT&CK enrichment failed" }, { status: 500 });
  }
}