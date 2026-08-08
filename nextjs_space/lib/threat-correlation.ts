// Threat correlation engine: links threats by shared CVEs, affected products,
// MITRE ATT&CK techniques, and campaign overlap. Builds correlation graph,
// finds clusters (connected components), and summarizes shared attributes.

import type { ThreatLike } from './risk-analytics';

const STRENGTH_RANK: Record<string, number> = { strong: 3, medium: 2, weak: 1 };

export interface SharedAttribute {
  type: 'cve' | 'product' | 'technique' | 'campaign';
  value: string;
  strength: 'strong' | 'medium' | 'weak';
  count?: number;
}

export interface CorrelationEdge {
  source: string;
  target: string;
  strength: 'strong' | 'medium' | 'weak';
  shared: SharedAttribute[];
}

export interface ThreatCluster {
  threats: ThreatLike[];
  threatIds: Set<string>;
  edges: CorrelationEdge[];
}

function parseProducts(t: ThreatLike): string[] {
  const raw = t.affectedAssets || '';
  return raw.split(/[,;|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function techniqueIds(t: ThreatLike): string[] {
  return (t.mitreAttackIds || []).filter(Boolean);
}

function computeSharedAttributes(a: ThreatLike, b: ThreatLike): SharedAttribute[] {
  const shared: SharedAttribute[] = [];

  if (a.threatId && b.threatId && a.threatId === b.threatId) {
    shared.push({ type: 'cve', value: a.threatId, strength: 'strong' });
  }

  const productsA = new Set(parseProducts(a));
  const productsB = new Set(parseProducts(b));
  const sharedProducts = [...productsA].filter((p) => productsB.has(p));
  if (sharedProducts.length > 0) {
    shared.push({
      type: 'product',
      value: sharedProducts.join(', '),
      strength: sharedProducts.length > 1 ? 'strong' : 'medium',
      count: sharedProducts.length,
    });
  }

  const techsA = new Set(techniqueIds(a));
  const techsB = new Set(techniqueIds(b));
  const sharedTechs = [...techsA].filter((t) => techsB.has(t));
  if (sharedTechs.length > 0) {
    shared.push({ type: 'technique', value: sharedTechs.join(', '), strength: 'medium', count: sharedTechs.length });
  }

  if (a.type === b.type && a.type !== 'OTHER' && a.source && a.source === b.source) {
    shared.push({ type: 'campaign', value: `${a.type} from ${a.source}`, strength: 'weak' });
  }

  return shared;
}

export function buildCorrelationGraph(threats: ThreatLike[]): CorrelationEdge[] {
  const edges: CorrelationEdge[] = [];
  for (let i = 0; i < threats.length; i++) {
    for (let j = i + 1; j < threats.length; j++) {
      const shared = computeSharedAttributes(threats[i], threats[j]);
      if (shared.length > 0) {
        const maxStrength = shared.reduce(
          (max, s) => (STRENGTH_RANK[s.strength] > STRENGTH_RANK[max] ? s.strength : max),
          shared[0].strength
        );
        edges.push({ source: threats[i].id, target: threats[j].id, strength: maxStrength, shared });
      }
    }
  }
  return edges;
}

export function findClusters(threats: ThreatLike[], edges: CorrelationEdge[]): ThreatCluster[] {
  const parent: Record<string, string> = {};
  threats.forEach((t) => { parent[t.id] = t.id; });

  function find(id: string): string {
    if (parent[id] !== id) parent[id] = find(parent[id]);
    return parent[id];
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  edges.forEach((e) => union(e.source, e.target));

  const groups: Record<string, { threats: ThreatLike[]; threatIds: Set<string> }> = {};
  threats.forEach((t) => {
    const root = find(t.id);
    if (!groups[root]) groups[root] = { threats: [], threatIds: new Set() };
    groups[root].threats.push(t);
    groups[root].threatIds.add(t.id);
  });

  const clusters = Object.values(groups).filter((g) => g.threats.length > 1);
  return clusters.map((cluster) => {
    const clusterEdges = edges.filter(
      (e) => cluster.threatIds.has(e.source) && cluster.threatIds.has(e.target)
    );
    return { ...cluster, edges: clusterEdges };
  });
}

export interface ClusterSummary {
  label: string;
  maxStrength: 'strong' | 'medium' | 'weak';
  sharedCves: string[];
  sharedProducts: string[];
  sharedTechniques: { label: string; count: number }[];
  sharedCampaigns: string[];
  edgeCount: number;
}

export function summarizeCluster(cluster: ThreatCluster): ClusterSummary {
  const { threats, edges } = cluster;

  const cveFreq: Record<string, number> = {};
  const productFreq: Record<string, number> = {};
  const techFreq: Record<string, number> = {};
  const campaignFreq: Record<string, number> = {};

  edges.forEach((e) => {
    e.shared.forEach((s) => {
      if (s.type === 'cve') cveFreq[s.value] = (cveFreq[s.value] || 0) + 1;
      else if (s.type === 'product') productFreq[s.value] = (productFreq[s.value] || 0) + 1;
      else if (s.type === 'technique') techFreq[s.value] = (techFreq[s.value] || 0) + 1;
      else if (s.type === 'campaign') campaignFreq[s.value] = (campaignFreq[s.value] || 0) + 1;
    });
  });

  const allTechs: Record<string, number> = {};
  threats.forEach((t) => {
    (t.mitreAttackIds || []).forEach((id) => {
      allTechs[id] = (allTechs[id] || 0) + 1;
    });
  });
  const sharedTechniques = Object.entries(allTechs)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ label: key, count }));

  const maxStrength = edges.reduce(
    (max, e) => (STRENGTH_RANK[e.strength] > STRENGTH_RANK[max] ? e.strength : max),
    edges[0]?.strength || 'weak'
  );

  const sharedCves = Object.keys(cveFreq).sort((a, b) => cveFreq[b] - cveFreq[a]);

  let label: string;
  if (sharedCves.length > 0) {
    label = `${sharedCves[0]} cluster`;
  } else {
    const topProducts = Object.entries(productFreq).sort((a, b) => b[1] - a[1]);
    if (topProducts.length > 0) {
      label = `${topProducts[0][0]} cluster`;
    } else if (sharedTechniques.length > 0) {
      label = `${sharedTechniques[0].label} cluster`;
    } else {
      const types = threats.map((t) => t.type).filter((t) => t && t !== 'OTHER');
      label = types[0] ? `${types[0]} cluster` : 'Threat cluster';
    }
  }

  return {
    label,
    maxStrength: maxStrength as 'strong' | 'medium' | 'weak',
    sharedCves,
    sharedProducts: Object.entries(productFreq).sort((a, b) => b[1] - a[1]).map(([p]) => p),
    sharedTechniques,
    sharedCampaigns: Object.keys(campaignFreq),
    edgeCount: edges.length,
  };
}
