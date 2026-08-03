// Maps a threat's type & severity to relevant controls across NIST CSF,
// ISO/IEC 27001:2022, and PCI DSS v4. Each entry: [controlId, controlName].

const BY_TYPE = {
  Vulnerability: {
    nist: [
      ["DE.CM-8", "Vulnerability scanning"],
      ["PR.IP-12", "Vulnerability remediation"],
      ["ID.RA-1", "Asset vulnerabilities identified"],
    ],
    iso: [
      ["A.8.8", "Management of technical vulnerabilities"],
      ["A.8.9", "Configuration management"],
    ],
    pci: [
      ["6.3.3", "Patch critical security vulnerabilities"],
      ["11.3.1", "Internal vulnerability scans"],
    ],
  },
  Ransomware: {
    nist: [
      ["PR.IP-1", "Baseline configurations"],
      ["DE.CM-1", "Network monitoring"],
      ["RC.RP-1", "Recovery plan executed"],
      ["PR.DS-11", "Backups protected"],
    ],
    iso: [
      ["A.8.7", "Protection against malware"],
      ["A.5.24", "Incident management planning"],
      ["A.8.13", "Information backup"],
    ],
    pci: [
      ["5.2.1", "Malware solutions deployed"],
      ["12.10.1", "Incident response plan"],
    ],
  },
  Malware: {
    nist: [
      ["DE.CM-1", "Network monitoring"],
      ["DE.E-3", "Malware detection"],
      ["PR.IP-1", "Baseline configurations"],
    ],
    iso: [
      ["A.8.7", "Protection against malware"],
      ["A.8.16", "Monitoring activities"],
    ],
    pci: [
      ["5.2.1", "Malware mechanisms"],
      ["5.4.1", "Malware detection & eradication"],
    ],
  },
  Breach: {
    nist: [
      ["RS.CO-2", "Incident reporting"],
      ["RC.RP-1", "Recovery plan"],
      ["DE.AE-2", "Detectable events analyzed"],
    ],
    iso: [
      ["A.5.24", "Incident management planning"],
      ["A.5.26", "Escalation of information security incidents"],
      ["A.8.16", "Monitoring activities"],
    ],
    pci: [
      ["12.10.1", "Incident response plan"],
      ["10.7.1", "Audit log retention"],
    ],
  },
  Campaign: {
    nist: [
      ["DE.AE-2", "Detectable events analyzed"],
      ["DE.CM-1", "Network monitoring"],
      ["PR.PT-1", "Audit logs"],
    ],
    iso: [
      ["A.5.7", "Threat intelligence"],
      ["A.8.16", "Monitoring activities"],
    ],
    pci: [
      ["12.10.5", "Threat intel & monitoring"],
      ["10.7.1", "Audit log retention"],
    ],
  },
  Advisory: {
    nist: [
      ["ID.RA-2", "Threat information received"],
      ["PR.IP-12", "Vulnerability remediation"],
    ],
    iso: [
      ["A.5.7", "Threat intelligence"],
      ["A.8.8", "Management of technical vulnerabilities"],
    ],
    pci: [
      ["6.3.3", "Vulnerability remediation"],
      ["12.10.5", "Threat intel"],
    ],
  },
  Other: {
    nist: [
      ["DE.AE-2", "Detectable events analyzed"],
      ["RS.CO-2", "Incident reporting"],
    ],
    iso: [
      ["A.5.24", "Incident management planning"],
      ["A.8.16", "Monitoring activities"],
    ],
    pci: [
      ["12.10.1", "Incident response plan"],
    ],
  },
};

const SEVERITY_EXTRA = {
  Critical: {
    nist: [["RS.AN-1", "Forensics & impact analysis"]],
    iso: [["A.5.25", "Assessment & decision on incidents"]],
    pci: [["12.10.4", "Incident response forensics"]],
  },
  High: {
    nist: [["DE.AE-3", "Incident declared"]],
    iso: [["A.5.26", "Escalation of incidents"]],
    pci: [["12.10.2", "Incident response activations"]],
  },
};

export function mapThreatToControls(threat) {
  const base = BY_TYPE[threat?.type] || BY_TYPE.Other;
  const extra = SEVERITY_EXTRA[threat?.severity] || {};
  return {
    nist: [...(base.nist || []), ...(extra.nist || [])],
    iso: [...(base.iso || []), ...(extra.iso || [])],
    pci: [...(base.pci || []), ...(extra.pci || [])],
  };
}

// Aggregate control coverage across many threats → { nist: { "DE.CM-1": count }, ... }
export function aggregateControls(threats) {
  const acc = { nist: {}, iso: {}, pci: {} };
  (threats || []).forEach((t) => {
    const m = mapThreatToControls(t);
    Object.keys(acc).forEach((fw) => {
      (m[fw] || []).forEach(([id]) => {
        acc[fw][id] = (acc[fw][id] || 0) + 1;
      });
    });
  });
  return acc;
}