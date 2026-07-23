// Static mapping of threat characteristics -> compliance framework controls.
// Used to auto-tag threats and compute coverage/gap reports without any
// external dependency.

export type Framework = 'NIST_CSF' | 'ISO_27001' | 'SOC2' | 'PCI_DSS' | 'CISA_KEV';

export interface ControlMapping {
  framework: Framework;
  controlId: string;
  controlName: string;
}

export const FRAMEWORK_LABELS: Record<string, string> = {
  NIST_CSF: 'NIST CSF',
  ISO_27001: 'ISO 27001',
  SOC2: 'SOC 2',
  PCI_DSS: 'PCI-DSS',
  CISA_KEV: 'CISA KEV',
};

// Primary frameworks shown as coverage cards (CISA_KEV is a supplemental tag).
export const PRIMARY_FRAMEWORKS: Framework[] = ['NIST_CSF', 'ISO_27001', 'SOC2', 'PCI_DSS'];

// The full universe of controls we can map to per framework. Coverage % is
// measured against these totals so a "gap" is a control with zero mapped threats.
export const CONTROL_CATALOG: ControlMapping[] = [
  // NIST CSF
  { framework: 'NIST_CSF', controlId: 'ID.RA-1', controlName: 'Asset vulnerabilities are identified and documented' },
  { framework: 'NIST_CSF', controlId: 'DE.CM-4', controlName: 'Malicious code is detected' },
  { framework: 'NIST_CSF', controlId: 'DE.AE-2', controlName: 'Detected events are analyzed' },
  { framework: 'NIST_CSF', controlId: 'RS.MI-1', controlName: 'Incidents are contained' },
  { framework: 'NIST_CSF', controlId: 'RS.RP-1', controlName: 'Response plan is executed during or after an incident' },
  // ISO 27001
  { framework: 'ISO_27001', controlId: 'A.12.6.1', controlName: 'Management of technical vulnerabilities' },
  { framework: 'ISO_27001', controlId: 'A.16.1.4', controlName: 'Assessment of and decision on information security events' },
  { framework: 'ISO_27001', controlId: 'A.16.1.5', controlName: 'Response to information security incidents' },
  // SOC 2
  { framework: 'SOC2', controlId: 'CC3.2', controlName: 'Identifies and analyzes risks to objectives' },
  { framework: 'SOC2', controlId: 'CC7.1', controlName: 'Detects and monitors for new vulnerabilities' },
  { framework: 'SOC2', controlId: 'CC7.3', controlName: 'Evaluates security events and responds' },
  // PCI-DSS
  { framework: 'PCI_DSS', controlId: '6.3.3', controlName: 'Security vulnerabilities are patched' },
  { framework: 'PCI_DSS', controlId: '11.3.2', controlName: 'External vulnerability scans are performed' },
  // CISA KEV
  { framework: 'CISA_KEV', controlId: 'KEV-001', controlName: 'Known exploited vulnerability remediation' },
];

const CONTROL_NAME_LOOKUP: Record<string, string> = CONTROL_CATALOG.reduce((acc, c) => {
  acc[`${c.framework}:${c.controlId}`] = c.controlName;
  return acc;
}, {} as Record<string, string>);

function control(framework: Framework, controlId: string): ControlMapping {
  return { framework, controlId, controlName: CONTROL_NAME_LOOKUP[`${framework}:${controlId}`] ?? controlId };
}

export interface ThreatForMapping {
  severity: string;
  isKev: boolean;
  mitreAttackIds: string[];
}

// Returns the set of controls a given threat maps to, deduplicated.
export function getComplianceMappings(threat: ThreatForMapping): ControlMapping[] {
  const out: ControlMapping[] = [];
  const seen = new Set<string>();
  const add = (framework: Framework, controlId: string) => {
    const key = `${framework}:${controlId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(control(framework, controlId));
  };

  const sev = (threat.severity || '').toUpperCase();

  if (sev === 'CRITICAL') {
    add('NIST_CSF', 'RS.MI-1');
    add('ISO_27001', 'A.16.1.5');
    add('SOC2', 'CC7.3');
    add('PCI_DSS', '6.3.3');
  } else if (sev === 'HIGH') {
    add('NIST_CSF', 'DE.CM-4');
    add('ISO_27001', 'A.12.6.1');
    add('SOC2', 'CC7.1');
    add('PCI_DSS', '11.3.2');
  } else if (sev === 'MEDIUM') {
    add('NIST_CSF', 'ID.RA-1');
    add('ISO_27001', 'A.12.6.1');
    add('SOC2', 'CC3.2');
  } else {
    // LOW / unknown — still map to baseline vulnerability identification.
    add('NIST_CSF', 'ID.RA-1');
    add('SOC2', 'CC3.2');
  }

  if (threat.isKev) {
    add('NIST_CSF', 'RS.RP-1');
    add('CISA_KEV', 'KEV-001');
  }

  if (Array.isArray(threat.mitreAttackIds) && threat.mitreAttackIds.length > 0) {
    add('NIST_CSF', 'DE.AE-2');
    add('ISO_27001', 'A.16.1.4');
  }

  return out;
}
