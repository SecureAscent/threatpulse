/**
 * Seed Acme products, LINK them to the real threats currently in the feed, and
 * tag every threat for compliance — so Blast Radius, Compliance and Executive
 * Brief are all populated with coherent data.
 *
 * Idempotent: re-running clears the Acme products (cascading their threat links)
 * and re-creates everything from the current threat feed.
 *
 * Run inside the app container:
 *   docker cp nextjs_space/scripts/seed-acme-linked.ts threatpulse-app:/app/prisma-tools/scripts/seed-acme-linked.ts
 *   docker exec threatpulse-app sh -c "cd /app/prisma-tools && NODE_PATH=/app/prisma-tools/node_modules npx tsx scripts/seed-acme-linked.ts"
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LINKED_BY = 'seed@acme.com';

// ── Compliance mapping (kept in sync with lib/compliance-mappings.ts) ────────
type Framework = 'NIST_CSF' | 'ISO_27001' | 'SOC2' | 'PCI_DSS' | 'CISA_KEV';
const CONTROL_CATALOG: { framework: Framework; controlId: string; controlName: string }[] = [
  { framework: 'NIST_CSF', controlId: 'ID.RA-1', controlName: 'Asset vulnerabilities are identified and documented' },
  { framework: 'NIST_CSF', controlId: 'DE.CM-4', controlName: 'Malicious code is detected' },
  { framework: 'NIST_CSF', controlId: 'DE.AE-2', controlName: 'Detected events are analyzed' },
  { framework: 'NIST_CSF', controlId: 'RS.MI-1', controlName: 'Incidents are contained' },
  { framework: 'NIST_CSF', controlId: 'RS.RP-1', controlName: 'Response plan is executed during or after an incident' },
  { framework: 'ISO_27001', controlId: 'A.12.6.1', controlName: 'Management of technical vulnerabilities' },
  { framework: 'ISO_27001', controlId: 'A.16.1.4', controlName: 'Assessment of and decision on information security events' },
  { framework: 'ISO_27001', controlId: 'A.16.1.5', controlName: 'Response to information security incidents' },
  { framework: 'SOC2', controlId: 'CC3.2', controlName: 'Identifies and analyzes risks to objectives' },
  { framework: 'SOC2', controlId: 'CC7.1', controlName: 'Detects and monitors for new vulnerabilities' },
  { framework: 'SOC2', controlId: 'CC7.3', controlName: 'Evaluates security events and responds' },
  { framework: 'PCI_DSS', controlId: '6.3.3', controlName: 'Security vulnerabilities are patched' },
  { framework: 'PCI_DSS', controlId: '11.3.2', controlName: 'External vulnerability scans are performed' },
  { framework: 'CISA_KEV', controlId: 'KEV-001', controlName: 'Known exploited vulnerability remediation' },
];
const NAME_LOOKUP: Record<string, string> = CONTROL_CATALOG.reduce((a, c) => {
  a[`${c.framework}:${c.controlId}`] = c.controlName;
  return a;
}, {} as Record<string, string>);

function getComplianceMappings(t: { severity: string; isKev: boolean; mitreAttackIds: string[] }) {
  const out: { framework: Framework; controlId: string; controlName: string }[] = [];
  const seen = new Set<string>();
  const add = (framework: Framework, controlId: string) => {
    const key = `${framework}:${controlId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ framework, controlId, controlName: NAME_LOOKUP[key] ?? controlId });
  };
  const sev = (t.severity || '').toUpperCase();
  if (sev === 'CRITICAL') { add('NIST_CSF', 'RS.MI-1'); add('ISO_27001', 'A.16.1.5'); add('SOC2', 'CC7.3'); add('PCI_DSS', '6.3.3'); }
  else if (sev === 'HIGH') { add('NIST_CSF', 'DE.CM-4'); add('ISO_27001', 'A.12.6.1'); add('SOC2', 'CC7.1'); add('PCI_DSS', '11.3.2'); }
  else if (sev === 'MEDIUM') { add('NIST_CSF', 'ID.RA-1'); add('ISO_27001', 'A.12.6.1'); add('SOC2', 'CC3.2'); }
  else { add('NIST_CSF', 'ID.RA-1'); add('SOC2', 'CC3.2'); }
  if (t.isKev) { add('NIST_CSF', 'RS.RP-1'); add('CISA_KEV', 'KEV-001'); }
  if (Array.isArray(t.mitreAttackIds) && t.mitreAttackIds.length > 0) { add('NIST_CSF', 'DE.AE-2'); add('ISO_27001', 'A.16.1.4'); }
  return out;
}

// ── Acme products ────────────────────────────────────────────────────────────
const acmeProducts = [
  { productName: 'Acme Web Portal',            productVersion: '3.2.1', packageName: 'acme-portal',      packageVersion: '3.2.1', productOwner: 'Sarah Chen',       ownerEmail: 'sarah.chen@acme.com',       department: 'Engineering' },
  { productName: 'Acme Mobile App',            productVersion: '2.8.0', packageName: 'acme-mobile-ios',  packageVersion: '2.8.0', productOwner: 'Michael Torres',   ownerEmail: 'michael.torres@acme.com',   department: 'Mobile' },
  { productName: 'Acme API Gateway',           productVersion: '5.1.3', packageName: 'acme-api-gateway', packageVersion: '5.1.3', productOwner: 'Jennifer Wu',      ownerEmail: 'jennifer.wu@acme.com',      department: 'Platform' },
  { productName: 'Acme Analytics Engine',      productVersion: '1.4.2', packageName: 'acme-analytics',   packageVersion: '1.4.2', productOwner: 'David Park',       ownerEmail: 'david.park@acme.com',       department: 'Data Science' },
  { productName: 'Acme Payment Processor',     productVersion: '4.0.1', packageName: 'acme-payments',    packageVersion: '4.0.1', productOwner: 'Lisa Anderson',    ownerEmail: 'lisa.anderson@acme.com',    department: 'Finance' },
  { productName: 'Acme CRM System',            productVersion: '2.3.0', packageName: 'acme-crm',         packageVersion: '2.3.0', productOwner: 'Robert Kim',       ownerEmail: 'robert.kim@acme.com',       department: 'Sales' },
  { productName: 'Acme Reporting Dashboard',   productVersion: '1.9.5', packageName: 'acme-dashboard',   packageVersion: '1.9.5', productOwner: 'Emily Rodriguez',  ownerEmail: 'emily.rodriguez@acme.com',  department: 'Analytics' },
  { productName: 'Acme Authentication Service',productVersion: '3.5.2', packageName: 'acme-auth',        packageVersion: '3.5.2', productOwner: 'James Wilson',     ownerEmail: 'james.wilson@acme.com',     department: 'Security' },
];

function threatWeight(t: { riskScore: number | null; cvssScore: number | null; isKev: boolean; severity: string }) {
  const base = t.riskScore ?? t.cvssScore ?? (t.severity === 'CRITICAL' ? 9 : t.severity === 'HIGH' ? 7 : t.severity === 'MEDIUM' ? 5 : 3);
  return base + (t.isKev ? 2 : 0);
}

async function main() {
  console.log('🔧 Seeding Acme products + threat links + compliance tags...\n');

  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('❌ No organization found. Create an org / SUPERADMIN first.');
    process.exit(1);
  }
  console.log(`Organization: ${org.name} (${org.id})`);

  // 1) Reset any previous Acme products (cascades their ThreatAssetLinks).
  const del = await prisma.cybellumAsset.deleteMany({ where: { organizationId: org.id, productName: { startsWith: 'Acme' } } });
  if (del.count) console.log(`Removed ${del.count} existing Acme products (and their links)`);

  // 2) Create the Acme products.
  const created = [] as { id: string; productName: string; department: string | null }[];
  for (const p of acmeProducts) {
    const a = await prisma.cybellumAsset.create({ data: { ...p, organizationId: org.id } });
    created.push({ id: a.id, productName: a.productName, department: a.department });
  }
  console.log(`Created ${created.length} Acme products`);

  // 3) Pull the real threats in the feed, strongest first.
  const threats = await prisma.threat.findMany({
    where: { organizationId: org.id },
    select: { id: true, threatId: true, title: true, severity: true, isKev: true, riskScore: true, cvssScore: true, mitreAttackIds: true },
  });
  if (threats.length === 0) {
    console.warn('\n⚠️  No threats in the feed yet — products created but nothing to link.');
    console.warn('   Let the collector run (or upload a CSV) then re-run this script.');
    return;
  }
  threats.sort((a, b) => threatWeight(b) - threatWeight(a));
  console.log(`Found ${threats.length} threats in the feed`);

  // 4) Link threats to products. Hotter threats fan out to more products so the
  //    Blast Radius shows clear high-exposure hubs. Cap links per product.
  const MAX_PER_PRODUCT = 8;
  const perProductCount = new Map<string, number>(created.map((c) => [c.id, 0]));
  const linkSet = new Set<string>();
  const linksToCreate: { threatId: string; assetId: string }[] = [];

  threats.forEach((t, idx) => {
    const w = threatWeight(t);
    // top ~20% of threats hit 3 products, next tier 2, rest 1.
    const fanout = w >= 9 ? 3 : w >= 6 ? 2 : 1;
    // Spread starting point around the product ring so links are well distributed.
    let placed = 0;
    for (let step = 0; step < created.length && placed < fanout; step++) {
      const prod = created[(idx + step) % created.length];
      if ((perProductCount.get(prod.id) ?? 0) >= MAX_PER_PRODUCT) continue;
      const key = `${t.id}:${prod.id}`;
      if (linkSet.has(key)) continue;
      linkSet.add(key);
      linksToCreate.push({ threatId: t.id, assetId: prod.id });
      perProductCount.set(prod.id, (perProductCount.get(prod.id) ?? 0) + 1);
      placed++;
    }
  });

  // Guarantee every product has at least one link (pull from the top threats).
  created.forEach((prod, i) => {
    if ((perProductCount.get(prod.id) ?? 0) === 0) {
      const t = threats[i % threats.length];
      const key = `${t.id}:${prod.id}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
        linksToCreate.push({ threatId: t.id, assetId: prod.id });
        perProductCount.set(prod.id, 1);
      }
    }
  });

  await prisma.threatAssetLink.createMany({
    data: linksToCreate.map((l) => ({ ...l, linkedBy: LINKED_BY })),
    skipDuplicates: true,
  });
  console.log(`Created ${linksToCreate.length} threat↔product links`);

  // 5) Set each product's risk score = max risk among its linked threats.
  for (const prod of created) {
    const linked = linksToCreate.filter((l) => l.assetId === prod.id).map((l) => l.threatId);
    const linkedThreats = threats.filter((t) => linked.includes(t.id));
    const maxRisk = linkedThreats.reduce((m, t) => Math.max(m, t.riskScore ?? t.cvssScore ?? 0), 0);
    await prisma.cybellumAsset.update({ where: { id: prod.id }, data: { riskScore: Math.round(maxRisk * 10) / 10 } });
  }
  console.log('Updated product risk scores from linked threats');

  // 6) Compliance: retag every threat in the org (idempotent).
  const orgThreatIds = threats.map((t) => t.id);
  await prisma.complianceTag.deleteMany({ where: { threatId: { in: orgThreatIds } } });
  const tags: { threatId: string; framework: string; controlId: string; controlName: string }[] = [];
  for (const t of threats) {
    for (const m of getComplianceMappings({ severity: t.severity, isKev: t.isKev, mitreAttackIds: t.mitreAttackIds ?? [] })) {
      tags.push({ threatId: t.id, framework: m.framework, controlId: m.controlId, controlName: m.controlName });
    }
  }
  await prisma.complianceTag.createMany({ data: tags, skipDuplicates: true });
  console.log(`Created ${tags.length} compliance tags across ${orgThreatIds.length} threats`);

  // Summary
  console.log('\n✅ Done. Dashboard-ready:');
  console.log('   • Blast Radius   — threat→product exposure graph populated');
  console.log('   • Compliance     — framework coverage populated (no manual Sync needed)');
  console.log('   • Executive Brief— top threats, affected products, findings populated');
  console.log('\nProducts and their linked-threat counts:');
  created.forEach((p) => console.log(`   • ${p.productName.padEnd(30)} ${perProductCount.get(p.id) ?? 0} threats  [${p.department}]`));
}

main()
  .catch((e) => { console.error('❌ Error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
