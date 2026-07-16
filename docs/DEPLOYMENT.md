# Deployment Guide

This guide walks through deploying the full ThreatPulse Intel production stack on a fresh Linux server.

## 1. Server prerequisites

- A Linux host (Ubuntu 22.04+ / Debian 12 recommended) with **2 vCPU / 4 GB RAM** or better.
- **Docker 24+** and **Docker Compose v2**:
  ```bash
  curl -fsSL https://get.docker.com | sh
  docker compose version   # must print v2.x
  ```
- A **domain name** with an `A` (and optionally `AAAA`) record pointing at the server's public IP.
- Firewall allowing inbound **80** and **443**:
  ```bash
  sudo ufw allow 80,443/tcp
  ```

## 2. Clone and configure

```bash
git clone https://github.com/EyesMindOpen/threatpulse.git
cd threatpulse
make setup            # creates .env.prod
```

Edit `.env.prod` and set every value:

| Variable | Notes |
|----------|-------|
| `DOMAIN` | Bare domain, e.g. `threatpulse.example.com` |
| `NEXTAUTH_URL` | `https://threatpulse.example.com` (must match `DOMAIN`) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | Strong password |
| `DATABASE_URL` | Must embed the SAME password |
| `CERTBOT_EMAIL` | Your email for expiry notices |
| `NVD_API_KEY` | Optional; increases NVD rate limits |

> ⚠️ `DATABASE_URL` password and `POSTGRES_PASSWORD` **must match**.

## 3. SSL certificates

```bash
make ssl
```

The `init-letsencrypt.sh` script:
1. Writes your `DOMAIN` into `nginx/conf.d/threatpulse.conf` (replacing the `__DOMAIN__` token).
2. Creates a temporary self-signed cert so Nginx can boot on `:443`.
3. Starts Nginx and requests a **staging** Let's Encrypt certificate (avoids rate limits).
4. Prompts you to switch to a **production** (trusted) certificate.

If validation fails, verify DNS and that ports 80/443 are reachable from the internet.

## 4. Launch

```bash
make up          # builds images and starts postgres, app, collector, nginx, certbot
make logs        # watch startup
make status      # container health
```

On first boot the `app` container:
- waits for Postgres,
- runs `prisma db push` to create tables,
- seeds demo data **only if the users table is empty**.

## 5. Create your admin user

```bash
make create-admin
# or non-interactively:
EMAIL=you@example.com PASSWORD='strongpass' ORG_NAME='Your Org' make create-admin
```

This creates a `SUPERADMIN`. Log in at `https://yourdomain.com`, then disable/delete the seeded demo accounts.

## 6. Certificate renewal

The `certbot` service renews automatically twice daily; Nginx reloads every 6 hours to pick up new certs. No action needed.

## Updating to a new release

```bash
make update      # git pull + rebuild + restart + prune
```

## Uninstall / reset

```bash
make down                                    # stop
docker compose -f docker-compose.prod.yml down -v   # stop AND delete the database volume
```
