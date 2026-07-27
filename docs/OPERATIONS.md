# Operations Runbook

Day-2 operations for a running ThreatPulse Intel stack. All commands assume the repo root and use the `Makefile` (which wraps `docker compose -f docker-compose.prod.yml`).

## Service overview

| Service | Container | Exposed | Restart |
|---------|-----------|---------|---------|
| `postgres` | `threatpulse-postgres` | internal only | unless-stopped |
| `app` | `threatpulse-app` | internal `:3000` (via nginx) | unless-stopped |
| `collector` | `threatpulse-collector` | none | unless-stopped |
| `nginx` | `threatpulse-nginx` | `:80`, `:443` | unless-stopped |
| `certbot` | `threatpulse-certbot` | none | unless-stopped |

## Everyday commands

```bash
make status            # container state + health
make logs              # follow all logs
make down && make up   # restart everything
```

Per-service logs:

```bash
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f collector
docker compose -f docker-compose.prod.yml logs -f nginx
```

## Backups

```bash
make backup-db         # -> backups/db_YYYYMMDD_HHMMSS.sql.gz
```

Automate with cron (daily at 02:30):

```cron
30 2 * * * cd /opt/threatpulse && /usr/bin/make backup-db >> /var/log/threatpulse-backup.log 2>&1
```

Restore the most recent backup:

```bash
make restore-db        # restores latest backups/db_*.sql.gz
```

> Restore replays SQL into the existing database. For a clean restore, recreate the volume first (`down -v`, `up`) then `restore-db`.

## User management

```bash
make create-admin      # create/promote a SUPERADMIN (interactive)
make shell-db          # psql: inspect users, orgs, threats
```

Example queries:

```sql
SELECT email, role FROM "User";
SELECT source, count(*) FROM "Threat" GROUP BY source ORDER BY 2 DESC;
```

## Updating

```bash
make update            # git pull + rebuild + restart + image prune
```

Rebuild a single service:

```bash
docker compose -f docker-compose.prod.yml up -d --build collector
```

## TLS certificates

- Renewal is automatic (certbot every 12h, nginx reload every 6h).
- Force a renewal check: `docker compose -f docker-compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot`.
- Re-issue from scratch: delete `certbot/conf/live/<domain>` and run `make ssl`.

## Health checks

- `app`: `HEALTHCHECK` hits `/login` (public 200 page).
- `postgres`: `pg_isready`.
- `collector`: process-presence check.

`docker ps` shows `(healthy)` once checks pass. `make status` surfaces the same.

## Common incidents

| Symptom | Action |
|---------|--------|
| App `unhealthy` | `logs -f app`; check `DATABASE_URL` / `NEXTAUTH_SECRET`; verify Postgres healthy |
| 502 from nginx | app container down or still starting; `make status`, `logs app` |
| Collector idle / 0 inserts | confirm an org exists or set `COLLECTOR_ORG_SLUG`; check `logs collector` |
| Disk filling | `docker image prune -f`; rotate `backups/` |
| Need a full reset | `docker compose -f docker-compose.prod.yml down -v` (⚠️ deletes data) then `make up` |
