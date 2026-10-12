// Threat correlation engine: links threats by shared CVEs, affected products,
// MITRE ATT&CK techniques, and threat-actor overlap. Builds correlation graph,
// finds clusters (connected components), and summarizes shared attributes.

const STRENGTH_RANK = { strong: 3, medium: 2, weak: 1 };

// Parse attack_techniques JSON string → array of {id, name, tactic}
export function parseTechniques(threat) {
  if (!threat.attack_techniques) return [];
  try {
    const parsed = typeof threat.attack_techniques === "string"
      ? JSON.parse(threat.attack_techniques)
      : threat.attack_techniques;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function techniqueIds(threat) {
  return parseTechniques(threat).map((t) => t.id).filter(Boolean);
}

function techniqueLabels(threat) {
  return parseTechniques(threat)
    .map((t) => `${t.id} · ${t.name}`)
    .filter(Boolean);
}

function parseProducts(threat) {
  const raw = threat.affected_products || "";
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// Compute shared attributes between two threats.
function computeSharedAttributes(a, b) {
  const shared = [];

  // Shared CVE — strongest signal
  if (a.cve_id && b.cve_id && a.cve_id === b.cve_id) {
    shared.push({ type: "cve", value: a.cve_id, strength: "strong" });
  }

  // Shared affected products
  const productsA = new Set(parseProducts(a));
  const productsB = new Set(parseProducts(b));
  const sharedProducts = [...productsA].filter((p) => productsB.has(p));
  if (sharedProducts.length > 0) {
    shared.push({
      type: "product",
      value: sharedProducts.join(", "),
      strength: sharedProducts.length > 1 ? "strong" : "medium",
      count: sharedProducts.length,
    });
  }

  // Shared MITRE ATT&CK techniques
  const techsA = new Set(techniqueIds(a));
  const techsB = new Set(techniqueIds(b));
  const sharedTechs = [...techsA].filter((t) => techsB.has(t));
  if (sharedTechs.length > 0) {
    shared.push({
      type: "technique",
      value: sharedTechs.join(", "),
      strength: "medium",
      count: sharedTechs.length,
    });
  }

  // Same threat type + same source (campaign-level correlation)
  if (a.type === b.type && a.type !== "Other" && a.source && a.source === b.source) {
    shared.push({
      type: "campaign",
      value: `${a.type} from ${a.source}`,
      strength: "weak",
    });
  }

  return shared;
}

// Build correlation graph: edges between threats with shared attributes.
export function buildCorrelationGraph(threats) {
  const edges = [];
  for (let i = 0; i < threats.length; i++) {
    for (let j = i + 1; j < threats.length; j++) {
      const shared = computeSharedAttributes(threats[i], threats[j]);
      if (shared.length > 0) {
        const maxStrength = shared.reduce(
          (max, s) => (STRENGTH_RANK[s.strength] > STRENGTH_RANK[max] ? s.strength : max),
          shared[0].strength
        );
        edges.push({
          source: threats[i].id,
          target: threats[j].id,
          strength: maxStrength,
          shared,
        });
      }
    }
  }
  return edges;
}

// Find connected components (clusters) using union-find.
export function findClusters(threats, edges) {
  const parent = {};
  threats.forEach((t) => { parent[t.id] = t.id; });

  function find(id) {
    if (parent[id] !== id) parent[id] = find(parent[id]);
    return parent[id];
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  edges.forEach((e) => union(e.source, e.target));

  const groups = {};
  threats.forEach((t) => {
    const root = find(t.id);
    if (!groups[root]) groups[root] = { threats: [], threatIds: new Set() };
    groups[root].threats.push(t);
    groups[root].threatIds.add(t.id);
  });

  // Only return clusters with 2+ threats
  const clusters = Object.values(groups).filter((g) => g.threats.length > 1);

  // Attach edges within each cluster
  return clusters.map((cluster) => {
    const clusterEdges = edges.filter(
      (e) => cluster.threatIds.has(e.source) && cluster.threatIds.has(e.target)
    );
    return { ...cluster, edges: clusterEdges };
  });
}

// Summarize shared attributes across a cluster (attributes appearing in 2+ threats).
export function summarizeCluster(cluster) {
  const { threats, edges } = cluster;

  // Collect all shared attributes from edges
  const cveFreq = {};
  const productFreq = {};
  const techFreq = {};
  const campaignFreq = {};

  edges.forEach((e) => {
    e.shared.forEach((s) => {
      if (s.type === "cve") cveFreq[s.value] = (cveFreq[s.value] || 0) + 1;
      else if (s.type === "product") productFreq[s.value] = (productFreq[s.value] || 0) + 1;
      else if (s.type === "technique") techFreq[s.value] = (techFreq[s.value] || 0) + 1;
      else if (s.type === "campaign") campaignFreq[s.value] = (campaignFreq[s.value] || 0) + 1;
    });
  });

  // Also collect all techniques across cluster threats for display
  const allTechs = {};
  threats.forEach((t) => {
    parseTechniques(t).forEach((tech) => {
      const key = `${tech.id} · ${tech.name}`;
      allTechs[key] = (allTechs[key] || 0) + 1;
    });
  });
  const sharedTechniques = Object.entries(allTechs)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ label: key, count }));

  // Determine max correlation strength in cluster
  const maxStrength = edges.reduce(
    (max, e) => (STRENGTH_RANK[e.strength] > STRENGTH_RANK[max] ? e.strength : max),
    edges[0]?.strength || "weak"
  );

  // Generate cluster label from most significant shared attribute
  const sharedCves = Object.keys(cveFreq);
  let label;
  if (sharedCves.length > 0) {
    label = `${sharedCves[0]} cluster`;
  } else {
    const topProducts = Object.entries(productFreq).sort((a, b) => b[1] - a[1]);
    if (topProducts.length > 0) {
      label = `${topProducts[0][0]} cluster`;
    } else if (sharedTechniques.length > 0) {
      label = `${sharedTechniques[0].label.split(" · ")[1] || sharedTechniques[0].label} cluster`;
    } else {
      const types = threats.map((t) => t.type).filter((t) => t && t !== "Other");
      label = types[0] ? `${types[0]} cluster` : "Threat cluster";
    }
  }

  return {
    label,
    maxStrength,
    sharedCves: sharedCves.sort((a, b) => cveFreq[b] - cveFreq[a]),
    sharedProducts: Object.entries(productFreq)
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p),
    sharedTechniques,
    sharedCampaigns: Object.keys(campaignFreq),
    edgeCount: edges.length,
  };
}

// Correlate threats with threat actors by name/alias match and shared techniques.
export function correlateWithActors(threats, actors) {
  const links = [];
  const threatMap = {};
  threats.forEach((t) => { threatMap[t.id] = t; });

  actors.forEach((actor) => {
    const names = [
      actor.name,
      ...(actor.aliases || "").split(",").map((s) => s.trim()),
    ].filter(Boolean);
    const actorTechIds = new Set(techniqueIds(actor));

    threats.forEach((threat) => {
      const text = `${threat.title || ""} ${threat.description || ""} ${threat.affected_products || ""}`.toLowerCase();
      const matchedName = names.find((n) => n && n.length > 2 && text.includes(n.toLowerCase()));
      const threatTechIds = techniqueIds(threat);
      const sharedTechs = [...actorTechIds].filter((t) => threatTechIds.includes(t));

      if (matchedName || sharedTechs.length > 0) {
        links.push({
          threatId: threat.id,
          threat,
          actorId: actor.id,
          actorName: actor.name,
          actorKind: actor.kind,
          matchedByName: !!matchedName,
          matchedName: matchedName || null,
          sharedTechniques: sharedTechs,
        });
      }
    });
  });
  return links;
}

// Get related threats for a single threat (for embedding in detail views).
export function getRelatedThreats(threatId, threats, maxResults = 8) {
  const target = threats.find((t) => t.id === threatId);
  if (!target) return [];

  const related = [];
  for (const candidate of threats) {
    if (candidate.id === threatId) continue;
    const shared = computeSharedAttributes(target, candidate);
    if (shared.length > 0) {
      const maxStrength = shared.reduce(
        (max, s) => (STRENGTH_RANK[s.strength] > STRENGTH_RANK[max] ? s.strength : max),
        shared[0].strength
      );
      related.push({ threat: candidate, strength: maxStrength, shared });
    }
  }

  return related
    .sort((a, b) => STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength])
    .slice(0, maxResults);
}