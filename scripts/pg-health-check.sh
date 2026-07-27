#!/bin/bash
# ThreatPulse PostgreSQL Health Check & Early Warning System
# Run via cron: */5 * * * * /path/to/pg-health-check.sh

set -e

# Configuration
DB_CONTAINER="threatpulse-postgres"
DB_NAME="threatpulse"
DB_USER="threatpulse"
ALERT_THRESHOLD_DEAD_TUPLES=10000        # warn if > 10k dead tuples
ALERT_THRESHOLD_BLOAT_RATIO=0.30         # warn if > 30% bloat
ALERT_THRESHOLD_LONG_TXN=300             # warn if txn > 5 mins
ALERT_THRESHOLD_XMIN_AGE=1000000         # warn if xmin age > 1M
LOG_FILE="/var/log/threatpulse/pg-health.log"
ALERT_FILE="/tmp/pg-alert.txt"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

alert() {
    echo "[ALERT] $1" | tee -a "$ALERT_FILE"
    log "$1"
}

exec_sql() {
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "$1"
}

# Clear previous alerts
> "$ALERT_FILE"

log "=== PostgreSQL Health Check Started ==="

# 1. Check for long-running transactions
log "Checking for long-running transactions..."
LONG_TXN=$(exec_sql "
SELECT count(*) FROM pg_stat_activity
WHERE state = 'active' 
  AND query NOT LIKE 'autovacuum%'
  AND extract(epoch FROM (now() - query_start)) > $ALERT_THRESHOLD_LONG_TXN;
")

if [ "$LONG_TXN" -gt 0 ]; then
    alert "Found $LONG_TXN long-running transaction(s) (> ${ALERT_THRESHOLD_LONG_TXN}s)"
    exec_sql "
SELECT pid, duration, query FROM (
  SELECT pid, extract(epoch FROM (now() - query_start))::int AS duration, query
  FROM pg_stat_activity
  WHERE state = 'active' AND extract(epoch FROM (now() - query_start)) > $ALERT_THRESHOLD_LONG_TXN
) t ORDER BY duration DESC;" | tee -a "$ALERT_FILE"
fi

# 2. Check for idle transactions holding locks
log "Checking for idle transactions holding locks..."
IDLE_LOCKS=$(exec_sql "
SELECT count(*) FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND extract(epoch FROM (now() - state_change)) > 60;
")

if [ "$IDLE_LOCKS" -gt 0 ]; then
    alert "Found $IDLE_LOCKS idle transaction(s) holding locks for > 60s"
    exec_sql "
SELECT pid, idle_duration, query FROM (
  SELECT pid, extract(epoch FROM (now() - state_change))::int AS idle_duration, query
  FROM pg_stat_activity
  WHERE state = 'idle in transaction'
) t ORDER BY idle_duration DESC LIMIT 5;" | tee -a "$ALERT_FILE"
fi

# 3. Check table bloat and dead tuples
log "Checking table bloat and dead tuples..."
exec_sql "
SELECT schemaname, tablename, 
       n_dead_tup AS dead_tuples,
       n_live_tup AS live_tuples,
       round(100 * n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY n_dead_tup DESC;" > /tmp/bloat_report.txt

while IFS='|' read -r schema table dead_tup live_tup ratio; do
    schema=$(echo "$schema" | xargs)
    table=$(echo "$table" | xargs)
    dead_tup=$(echo "$dead_tup" | xargs)
    ratio=$(echo "$ratio" | xargs)
    
    if [ -z "$schema" ]; then continue; fi
    if [ "$schema" = "schemaname" ]; then continue; fi
    
    if [ "$dead_tup" -gt "$ALERT_THRESHOLD_DEAD_TUPLES" ]; then
        alert "Table $schema.$table has $dead_tup dead tuples (${ratio}% bloat) — run VACUUM"
    fi
done < /tmp/bloat_report.txt

log "Bloat report:"
cat /tmp/bloat_report.txt | tee -a "$LOG_FILE"

# 4. Check autovacuum activity
log "Checking autovacuum status..."
AUTOVAC=$(exec_sql "SELECT count(*) FROM pg_stat_activity WHERE query LIKE 'autovacuum%';")
if [ "$AUTOVAC" -eq 0 ]; then
    log "Autovacuum is idle (ok)"
else
    log "Autovacuum is running on $AUTOVAC table(s)"
    exec_sql "
SELECT datname, relname, phase, heap_blks_scanned, heap_blks_vacuumed
FROM pg_stat_progress_vacuum;" | tee -a "$LOG_FILE"
fi

# 5. Check transaction wraparound risk
log "Checking transaction ID wraparound risk..."
TXID_AGE=$(exec_sql "SELECT max(age(datfrozenxid)) FROM pg_database WHERE datname='$DB_NAME';")
TXID_AGE_NUM=$(echo "$TXID_AGE" | grep -oE '[0-9]+' | head -1)

if [ "$TXID_AGE_NUM" -gt "$ALERT_THRESHOLD_XMIN_AGE" ]; then
    alert "Transaction ID age is $TXID_AGE (approaching wraparound threshold) — run VACUUM FREEZE"
fi

log "Current xmin age: $TXID_AGE"

# 6. Check index bloat
log "Checking index health..."
exec_sql "
SELECT schemaname, tablename, indexname, 
       round(pg_relation_size(indexrelid)::numeric / 1024 / 1024, 2) AS size_mb
FROM pg_indexes 
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
ORDER BY pg_relation_size(indexrelid) DESC LIMIT 5;" | tee -a "$LOG_FILE"

# 7. Connection count warning
log "Checking connection count..."
CONN_COUNT=$(exec_sql "SELECT count(*) FROM pg_stat_activity WHERE datname='$DB_NAME';")
CONN_LIMIT=$(exec_sql "SELECT setting FROM pg_settings WHERE name='max_connections';")
CONN_RATIO=$(echo "scale=2; $CONN_COUNT * 100 / $CONN_LIMIT" | bc)

log "Active connections: $CONN_COUNT / $CONN_LIMIT (${CONN_RATIO}%)"

if (( $(echo "$CONN_RATIO > 80" | bc -l) )); then
    alert "Connection pool at ${CONN_RATIO}% capacity"
fi

# 8. Check for queries stuck in 'waiting' state
log "Checking for blocked queries..."
BLOCKED=$(exec_sql "
SELECT count(*) FROM pg_stat_activity 
WHERE wait_event IS NOT NULL AND state = 'active';
")

if [ "$BLOCKED" -gt 0 ]; then
    alert "Found $BLOCKED query(ies) waiting on locks"
    exec_sql "
SELECT pid, usename, query, wait_event, wait_event_type
FROM pg_stat_activity
WHERE wait_event IS NOT NULL AND state = 'active';" | tee -a "$ALERT_FILE"
fi

# Summary
log "=== Health Check Complete ==="

if [ -s "$ALERT_FILE" ]; then
    log "⚠️  ALERTS DETECTED - Review $ALERT_FILE"
    cat "$ALERT_FILE"
    exit 1
else
    log "✅ All systems healthy"
    exit 0
fi
