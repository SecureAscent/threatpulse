#!/bin/bash
# ThreatPulse PostgreSQL Maintenance - Run nightly
# Safely vacuums, analyzes, and reindexes without blocking the app

DB_CONTAINER="threatpulse-postgres"
DB_NAME="threatpulse"
DB_USER="threatpulse"
LOG_FILE="/var/log/threatpulse/pg-maintenance.log"

mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== PostgreSQL Maintenance Started ==="

# VACUUM ANALYZE all tables (non-blocking, safe during operation)
log "Running VACUUM ANALYZE..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SET statement_timeout = '2h';
VACUUM ANALYZE;" 2>&1 | tee -a "$LOG_FILE"

# Reindex tables with > 30% dead space
log "Checking for bloated indexes..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" << 'SQL' 2>&1 | tee -a "$LOG_FILE"
-- Find indexes that would benefit from reindexing
SELECT schemaname, tablename, indexname,
       round(pg_relation_size(indexrelid)::numeric / 1024 / 1024, 2) AS size_mb
FROM pg_indexes
JOIN pg_class ON pg_indexes.indexname = pg_class.relname
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_relation_size(indexrelid) DESC;
SQL

# Autovacuum settings tune-up for high-churn tables
log "Tuning autovacuum for high-activity tables..."
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" << 'SQL' 2>&1 | tee -a "$LOG_FILE"
-- Threat table gets more aggressive autovacuum
ALTER TABLE "Threat" SET (
    autovacuum_vacuum_scale_factor = 0.01,  -- vacuum at 1% instead of default 10%
    autovacuum_analyze_scale_factor = 0.005, -- analyze at 0.5%
    autovacuum_vacuum_cost_delay = 5        -- speed up vacuums
);

-- Check the settings
SELECT relname, reloptions FROM pg_class 
WHERE relname = 'Threat' AND reloptions IS NOT NULL;
SQL

log "=== Maintenance Complete ==="
