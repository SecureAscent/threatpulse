// Standardized mandatory investigation workflow applied to every threat.
// Order is significant — steps must be completed sequentially.
export const INVESTIGATION_STEPS = [
  {
    key: "triage",
    label: "Triage & Impact Assessment",
    guidance: "Confirm severity, scope, and affected assets; validate the initial report and assign priority.",
  },
  {
    key: "root_cause",
    label: "Root Cause Analysis",
    guidance: "Identify the vulnerability, entry point, and attack vector that enabled the threat.",
  },
  {
    key: "remediation",
    label: "Remediation",
    guidance: "Apply patch, configuration change, or mitigation that resolves the threat.",
  },
  {
    key: "verification",
    label: "Verification & Closure",
    guidance: "Confirm remediation is effective and the threat is fully resolved before closing.",
  },
];