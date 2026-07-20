# CI troubleshooting

## Verified failure

The application validation job previously stopped at dependency installation. Collector validation and shell-script syntax validation passed, but Prisma validation, tenancy tests, type-checking, and the application build were skipped.

## Root cause

The application uses a Yarn Berry lockfile and Docker explicitly installs Yarn 4.9.2. CI previously enabled Corepack without pinning Yarn and used Node 20, allowing the runner-selected Yarn version to differ from the repository lockfile and Docker build toolchain.

## Remediation applied

- `nextjs_space/package.json` declares `"packageManager": "yarn@4.9.2"`.
- CI uses Node.js 22, matching the application Docker image.
- CI explicitly runs `corepack prepare yarn@4.9.2 --activate`.
- CI prints the Yarn version before installation.
- CI runs for pushes to `release/tenancy-platform-v1` as well as pull requests.

## Required validation sequence

From a clean checkout:

```bash
cd nextjs_space
corepack enable
corepack prepare yarn@4.9.2 --activate
yarn --version
yarn install --immutable
yarn prisma validate --schema=./prisma/schema.prisma
yarn db:generate
yarn test:tenancy
yarn tsc --noEmit
yarn build
```

Collector validation:

```bash
cd collector
npm ci
npm run typecheck
npm run build
```

A release gate remains open until the GitHub Actions run for the latest release-branch head completes successfully.
