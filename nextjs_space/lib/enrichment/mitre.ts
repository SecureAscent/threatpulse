/**
 * MITRE ATT&CK tagging — Intelligence engine (Track A)
 *
 * Infers likely MITRE ATT&CK technique IDs from a threat's free-text fields
 * using a static keyword → technique map. No external API is required; the
 * mapping below covers the techniques we most commonly observe across CISA
 * KEV, NVD and security-news feeds.
 */

export interface MitreTechnique {
  id: string; // e.g. "T1190"
  name: string; // e.g. "Exploit Public-Facing Application"
  tactic: string; // primary ATT&CK tactic
}

/** Static catalog of the techniques we can infer, keyed by technique id. */
export const MITRE_TECHNIQUES: Record<string, MitreTechnique> = {
  T1190: { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access' },
  T1133: { id: 'T1133', name: 'External Remote Services', tactic: 'Initial Access' },
  T1566: { id: 'T1566', name: 'Phishing', tactic: 'Initial Access' },
  T1078: { id: 'T1078', name: 'Valid Accounts', tactic: 'Initial Access' },
  T1195: { id: 'T1195', name: 'Supply Chain Compromise', tactic: 'Initial Access' },
  T1059: { id: 'T1059', name: 'Command and Scripting Interpreter', tactic: 'Execution' },
  T1203: { id: 'T1203', name: 'Exploitation for Client Execution', tactic: 'Execution' },
  T1068: { id: 'T1068', name: 'Exploitation for Privilege Escalation', tactic: 'Privilege Escalation' },
  T1055: { id: 'T1055', name: 'Process Injection', tactic: 'Privilege Escalation' },
  T1210: { id: 'T1210', name: 'Exploitation of Remote Services', tactic: 'Lateral Movement' },
  T1021: { id: 'T1021', name: 'Remote Services', tactic: 'Lateral Movement' },
  T1486: { id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'Impact' },
  T1499: { id: 'T1499', name: 'Endpoint Denial of Service', tactic: 'Impact' },
  T1498: { id: 'T1498', name: 'Network Denial of Service', tactic: 'Impact' },
  T1005: { id: 'T1005', name: 'Data from Local System', tactic: 'Collection' },
  T1041: { id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration' },
  T1071: { id: 'T1071', name: 'Application Layer Protocol', tactic: 'Command and Control' },
  T1505: { id: 'T1505', name: 'Server Software Component', tactic: 'Persistence' },
  T1136: { id: 'T1136', name: 'Create Account', tactic: 'Persistence' },
  T1211: { id: 'T1211', name: 'Exploitation for Defense Evasion', tactic: 'Defense Evasion' },
  T1552: { id: 'T1552', name: 'Unsecured Credentials', tactic: 'Credential Access' },
  T1110: { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access' },
};

/**
 * Keyword → technique id rules. Each rule fires when ANY of its keywords are
 * found (case-insensitive, substring) in the combined threat text.
 */
const KEYWORD_RULES: { techniqueId: string; keywords: string[] }[] = [
  { techniqueId: 'T1486', keywords: ['ransomware', 'ransom', 'encrypt files', 'lockbit', 'blackcat', 'alphv', 'file encryption'] },
  { techniqueId: 'T1566', keywords: ['phishing', 'spear phishing', 'spear-phishing', 'phish', 'malicious email', 'credential harvest'] },
  { techniqueId: 'T1190', keywords: ['rce', 'remote code execution', 'exploit public', 'public-facing', 'unauthenticated', 'web shell exploit', 'sql injection', 'sqli', 'deserialization', 'file upload vulnerability'] },
  { techniqueId: 'T1068', keywords: ['privilege escalation', 'privilege-escalation', 'elevation of privilege', 'eop', 'local privilege', 'escalate privileges'] },
  { techniqueId: 'T1021', keywords: ['lateral movement', 'rdp', 'smb', 'psexec', 'remote desktop', 'wmi'] },
  { techniqueId: 'T1210', keywords: ['exploitation of remote', 'wormable', 'remote service exploit', 'smb exploit'] },
  { techniqueId: 'T1059', keywords: ['powershell', 'command injection', 'shell command', 'bash script', 'cmd.exe', 'scripting'] },
  { techniqueId: 'T1203', keywords: ['client execution', 'malicious document', 'macro', 'drive-by', 'browser exploit'] },
  { techniqueId: 'T1078', keywords: ['valid accounts', 'stolen credentials', 'compromised credentials', 'account takeover'] },
  { techniqueId: 'T1110', keywords: ['brute force', 'brute-force', 'password spray', 'credential stuffing'] },
  { techniqueId: 'T1552', keywords: ['hardcoded credentials', 'exposed credentials', 'unsecured credentials', 'leaked secret', 'api key leak'] },
  { techniqueId: 'T1195', keywords: ['supply chain', 'supply-chain', 'compromised dependency', 'malicious package', 'npm package', 'pypi package'] },
  { techniqueId: 'T1133', keywords: ['vpn', 'external remote', 'remote access service', 'citrix', 'gateway'] },
  { techniqueId: 'T1498', keywords: ['ddos', 'distributed denial', 'network denial'] },
  { techniqueId: 'T1499', keywords: ['denial of service', 'dos vulnerability', 'crash', 'resource exhaustion'] },
  { techniqueId: 'T1505', keywords: ['web shell', 'webshell', 'server component', 'malicious plugin', 'iis module'] },
  { techniqueId: 'T1055', keywords: ['process injection', 'dll injection', 'code injection'] },
  { techniqueId: 'T1071', keywords: ['command and control', 'c2 ', 'c2\t', 'beacon', 'cobalt strike'] },
  { techniqueId: 'T1041', keywords: ['data exfiltration', 'exfiltrate', 'data theft', 'stolen data'] },
  { techniqueId: 'T1136', keywords: ['create account', 'rogue account', 'backdoor account'] },
  { techniqueId: 'T1211', keywords: ['defense evasion', 'bypass authentication', 'auth bypass', 'security bypass', 'waf bypass'] },
];

export interface MitreInferenceInput {
  type?: string | null;
  title?: string | null;
  description?: string | null;
  mitreTactic?: string | null;
  mitreTechnique?: string | null;
}

/**
 * Infer MITRE ATT&CK technique IDs for a threat. Returns a de-duplicated,
 * sorted array of technique ids (e.g. ["T1190", "T1486"]). Empty when nothing
 * matches.
 */
export function inferMitreAttackIds(threat: MitreInferenceInput): string[] {
  const haystack = [
    threat.type,
    threat.title,
    threat.description,
    threat.mitreTactic,
    threat.mitreTechnique,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack.trim()) return [];

  const found = new Set<string>();

  // 1) Direct technique-id mention (e.g. text literally contains "T1190")
  const directMatches = haystack.match(/\bt\d{4}\b/gi) ?? [];
  for (const m of directMatches) {
    const id = m.toUpperCase();
    if (MITRE_TECHNIQUES[id]) found.add(id);
  }

  // 2) Keyword rules
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      found.add(rule.techniqueId);
    }
  }

  return Array.from(found).sort();
}

/** Resolve technique ids to their catalog entries (unknown ids are skipped). */
export function describeMitreIds(ids: string[]): MitreTechnique[] {
  return ids
    .map((id) => MITRE_TECHNIQUES[id])
    .filter((t): t is MitreTechnique => Boolean(t));
}
