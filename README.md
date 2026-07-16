<div align="center">

# 🛡️ ThreatPulse Intel

**Open-source threat intelligence platform for healthcare cybersecurity teams**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](docker-compose.prod.yml)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)

</div>

---

ThreatPulse Intel aggregates, normalizes, and triages threat intelligence into a single dashboard. It ships as a **complete, production-ready Docker stack** — Next.js app, PostgreSQL, an automated intelligence **collector worker**, and an Nginx + Let's Encrypt reverse proxy — that a sysadmin can deploy anywhere Docker runs.

## ✨ What you get

- **Automated intelligence collection** — a background worker ingests CISA KEV, NVD CVEs, and 11 security RSS feeds every 15 minutes (configurable).
- **Multi-user RBAC** — `SUPERADMIN → ADMIN → ANALYST`, with organization-scoped data isolation.
- **HTTPS out of the box** — Nginx TLS termination with automatic Let's Encrypt certificates and renewal.
- **One-command ops** — a `Makefile` wraps setup, SSL, backups, admin creation, and more.

## ✅ Prerequisites

- **Docker 24+** and **Docker Compose v2** (`docker compose`, not `docker-compose`)
- A **domain name** with an `A`/`AAAA` record pointing at the server's public IP (required for SSL)
- Ports **80** and **443** open to the internet

> No Node.js or PostgreSQL install needed on the host — everything runs in containers.

## 🚀 Quick start (5 steps)

```bash
# 1. Clone
git clone https://github.com/EyesMindOpen/threatpulse.git
cd threatpulse

# 2. Create and edit the environment file
make setup                # copies .env.prod.example -> .env.prod
nano .env.prod            # set DOMAIN, NEXTAUTH_URL, NEXTAUTH_SECRET, POSTGRES_PASSWORD, DATABASE_URL, CERTBOT_EMAIL
                          # generate a secret with:  openssl rand -base64 32

# 3. Obtain SSL certificates (staging first, then prompts for production)
make ssl

# 4. Launch the full stack
make up

# 5. Create your first SUPERADMIN
make create-admin
```

Then browse to `https://yourdomain.com` and log in. Follow logs with `make logs`.

> **Local development** (no SSL, hot reload): `make dev` → http://localhost:3000
> Full documentation lives in the [`docs/`](docs/) folder — start with [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 🖥️ Architecture

```
                          Internet
                             │  :80 / :443
                    ┌────────▼─────────┐
                    │      nginx        │  TLS termination, HTTP→HTTPS,
                    │   (reverse proxy) │  security headers, gzip, caching
                    └────────┬─────────┘
                             │ :3000 (internal)
                    ┌────────▼─────────┐        ┌────────────────────┐
                    │       app         │        │      certbot        │
                    │  Next.js 14       │        │  Let's Encrypt SSL  │
                    │  Prisma + NextAuth│        │  auto-renewal       │
                    └────────┬─────────┘        └────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                     │
┌───────▼────────┐  ┌────────▼─────────┐          │
│    postgres     │◄─┤    collector      │          │
│  15-alpine      │  │  KEV / NVD / RSS  │  every   │
│  (internal only)│  │  worker (node)    │  15 min  │
│  pgdata volume  │  └───────────────────┘          │
└─────────────────┘                                 │
        ▲                                            │
        └──────────── all services on ──────────────┘
                    threatpulse-net (bridge)
```

| Component | Technology | Purpose |
|-----------|------------|---------|
| Proxy | Nginx (alpine) + Certbot | TLS, HTTP→HTTPS, security headers, gzip |
| Frontend/Backend | Next.js 14 (standalone), Prisma | Dashboard, REST API, auth |
| Auth | NextAuth.js v4 (credentials + JWT) | Sessions, RBAC |
| Database | PostgreSQL 15 | Threats, users, integrations |
| Collector | Node.js + axios + rss-parser + node-cron + pg | Automated feed ingestion |

## ⚙️ Environment variables

Set these in `.env.prod` (see [`.env.prod.example`](.env.prod.example)):

| Variable | Required | Default | Description |
|----------|:---:|---------|-------------|
| `POSTGRES_USER` | | `threatpulse` | Database user |
| `POSTGRES_PASSWORD` | ✅ | — | Database password (also in `DATABASE_URL`) |
| `POSTGRES_DB` | | `threatpulse` | Database name |
| `DATABASE_URL` | ✅ | — | Full Postgres URL (host = `postgres`) |
| `NEXTAUTH_URL` | ✅ | — | Public HTTPS URL of the app |
| `NEXTAUTH_SECRET` | ✅ | — | JWT signing secret (`openssl rand -base64 32`) |
| `DOMAIN` | ✅ | — | Bare domain for SSL (no scheme) |
| `CERTBOT_EMAIL` | ✅ | — | Email for Let's Encrypt notices |
| `COLLECTOR_INTERVAL_MINUTES` | | `15` | Collection frequency |
| `COLLECTOR_ORG_SLUG` | | `threatpulse-demo` | Org that collected threats attach to |
| `NVD_API_KEY` | | — | Optional NVD key for higher rate limits |
| `NEXT_PUBLIC_APP_NAME` | | `ThreatPulse Intel` | App name in the client bundle |

## 🔌 Intelligence sources (collector)

- **CISA KEV** — Known Exploited Vulnerabilities catalog (JSON)
- **NVD** — NIST CVE feed with CVSS scoring (REST API v2)
- **RSS** — US-CERT/CISA, CISA Alerts, Krebs on Security, Bleeping Computer, Dark Reading, SANS ISC, Threatpost, SecurityWeek, Recorded Future, Unit 42, Talos Intelligence

Each item is normalized into the `Threat` model and deduped by `threatId`. Analyst-set `status` (NEW / INVESTIGATING / RESOLVED) is **never** overwritten by re-collection.

## 🛠️ Make targets

| Target | Description |
|--------|-------------|
| `make setup` | Create `.env.prod` from the template |
| `make ssl` | Obtain / renew Let's Encrypt certificates |
| `make up` | Start the production stack (build + detached) |
| `make down` | Stop the stack |
| `make logs` | Follow all logs |
| `make update` | Pull, rebuild images, restart |
| `make backup-db` | Dump DB to `backups/<timestamp>.sql.gz` |
| `make restore-db` | Restore from the latest backup |
| `make shell-app` | Shell into the app container |
| `make shell-db` | Open a `psql` shell |
| `make create-admin` | Create a SUPERADMIN user |
| `make seed` | Run the seed script |
| `make status` | `docker compose ps` |
| `make dev` / `make dev-down` | Start / stop the dev stack (hot reload) |

## 🔒 RBAC roles

| Role | Capabilities |
|------|--------------|
| **SUPERADMIN** | Full platform control, cross-org, user/integration management |
| **ADMIN** | Org admin: manage users, configure integrations, SLA settings |
| **ANALYST** | View dashboard, triage threats, export advisories, search/filter |

## 🧯 Troubleshooting (quick reference)

| Symptom | Likely fix |
|---------|-----------|
| `make ssl` fails to validate domain | Confirm DNS `A` record → server IP and ports 80/443 open |
| Browser warns about the certificate | You're on the **staging** cert — re-run `make ssl` and choose production |
| App can't reach DB | Check `DATABASE_URL` password matches `POSTGRES_PASSWORD`; `make status` |
| Login redirect loop / CSRF errors | `NEXTAUTH_URL` must exactly match the browser URL (https + domain) |
| Collector inserts nothing | Ensure the app seeded an org, or set `COLLECTOR_ORG_SLUG`; see `docker compose -f docker-compose.prod.yml logs collector` |
| NVD collection slow / rate-limited | Set `NVD_API_KEY` in `.env.prod` |

More detail: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/COLLECTOR.md](docs/COLLECTOR.md) · [docs/OPERATIONS.md](docs/OPERATIONS.md)

## 📄 License

[Apache License 2.0](LICENSE) — Copyright 2024 Curtis Haugen

## 🤝 Contributing & Security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
