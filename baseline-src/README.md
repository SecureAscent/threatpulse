# Baseline — Current SaaS State (source snapshot)

> Snapshot of the Base44 SaaS builder source for ThreatPulse, as of 2026-08-03.
> This is the baseline definition the self-hosted Docker stack ports against.

## Layout
- `docs/` — entities & RLS, functions/pages/workflows, intelligence-domain architecture, data-classification, backend contract.
- `src/App.jsx`, `src/main.jsx`, `src/index.css` — router, entry, design tokens.
- root config — `package.json`, `tailwind.config.js`, `vite.config.js`, `index.html`, `postcss.config.js`, `jsconfig.json`, `components.json`, `eslint.config.js`, `.gitignore`.
- `base44/config.jsonc`, `base44/connectors/` — platform config + OAuth connector declarations.
- `base44/entities/` — all 13 entity JSON schemas (data + RLS contract).
- `base44/functions/` — all 10 backend function sources.
- `base44/workflows/` — the 2 automation workflows.

## Notes for self-hosted port
- Source is React 18 + Vite + Tailwind + shadcn/ui on the Base44 BaaS. Adapt framework/runtime to the Docker stack; preserve the **contracts** (entity schemas, RLS, function I/O, route map).
- `baseline-src/` is isolated — merging this PR does not touch any existing file in the repo root.
- UI component layer (`src/components/**`, `src/pages/**`, `src/lib/**`, `src/hooks/**`) is intentionally deferred to a follow-up commit on this same PR to keep review manageable.