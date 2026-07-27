# PostgreSQL Health & Maintenance Setup

## Scripts Created

1. **pg-health-check.sh** — Runs every 5 mins, detects:
   - Long-running transactions (> 5 min)
   - Idle transactions holding locks
   - Table bloat & dead tuple accumulation
   - Autovacuum status
   - Transaction ID wraparound risk
   - Index health
   - Connection pool saturation
   - Blocked queries

2. **pg-maintenance.sh** — Runs nightly:
   - VACUUM ANALYZE all tables
   - Tunes autovacuum for high-churn tables (Threat table)
   - Reports index bloat

## Installation

### Option A: Cron (on host machine)

```bash
# Add to crontab:
crontab -e

# Health check every 5 minutes (logs to /var/log/threatpulse/pg-health.log)
*/5 * * * * /home/ubuntu/threatpulse/scripts/pg-health-check.sh

# Maintenance nightly at 2 AM (logs to /var/log/threatpulse/pg-maintenance.log)
0 2 * * * /home/ubuntu/threatpulse/scripts/pg-maintenance.sh
```

### Option B: systemd Timer (on host machine)

Create `/etc/systemd/system/threatpulse-pg-health.timer`:
```ini
[Unit]
Description=ThreatPulse PostgreSQL Health Check
After=docker.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
```

Create `/etc/systemd/system/threatpulse-pg-health.service`:
```ini
[Unit]
Description=ThreatPulse PostgreSQL Health Check
After=docker.service

[Service]
Type=oneshot
ExecStart=/home/ubuntu/threatpulse/scripts/pg-health-check.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable threatpulse-pg-health.timer
sudo systemctl start threatpulse-pg-health.timer
```

### Option C: Docker Sidecar (within docker-compose)

Add to docker-compose.prod.yml:
```yaml
  pg-health-check:
    image: postgres:15
    depends_on:
      - postgres
    volumes:
      - ./scripts:/scripts:ro
      - /var/log/threatpulse:/var/log/threatpulse
    entrypoint: /bin/bash
    command: |
      -c "
      while true; do
        /scripts/pg-health-check.sh
        sleep 300
      done
      "
    network_mode: host
    restart: unless-stopped
```

## Monitoring

### Check health logs:
```bash
tail -f /var/log/threatpulse/pg-health.log
```

### Check for active alerts:
```bash
cat /tmp/pg-alert.txt
```

### Manual health check:
```bash
/home/ubuntu/threatpulse/scripts/pg-health-check.sh
```

### Manual maintenance:
```bash
/home/ubuntu/threatpulse/scripts/pg-maintenance.sh
```

## Alert Thresholds (adjust as needed)

In `pg-health-check.sh`:
- `ALERT_THRESHOLD_DEAD_TUPLES=10000` — alert if > 10k dead rows
- `ALERT_THRESHOLD_LONG_TXN=300` — alert if txn > 5 mins
- `ALERT_THRESHOLD_XMIN_AGE=1000000` — warn if xmin age > 1M (wraparound risk)

## What to Do When Alerts Fire

| Alert | Action |
|-------|--------|
| Long-running transaction | Kill it: `SELECT pg_terminate_backend(pid);` |
| Idle in transaction | Close client connection or kill: `SELECT pg_terminate_backend(pid);` |
| High dead tuple count | Run maintenance manually or wait for nightly script |
| High bloat ratio | REINDEX affected table during maintenance window |
| XID age high | Run `VACUUM FREEZE` immediately |
| Blocked queries | Find blocker with `pg_blocking_pids()`, kill if needed |

## Preventing Future Corruption

1. **Low autovacuum_naptime** — already tuned in maintenance script
2. **Monitor collector crashes** — check docker logs for restart loops
3. **Connection pool limits** — alert fires at 80% capacity
4. **Regular backups** — before running any TRUNCATE/FULL VACUUM
