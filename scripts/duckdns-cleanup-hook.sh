#!/bin/sh
###############################################################################
# ThreatPulse Intel — Certbot DNS-01 cleanup hook for DuckDNS
#
# Runs after validation to clear the TXT record we published in the auth hook.
# Best-effort: never fail the certbot run just because cleanup hiccupped.
###############################################################################
set -eu

: "${DUCKDNS_TOKEN:?DUCKDNS_TOKEN not set}"
: "${DUCKDNS_SUBDOMAIN:?DUCKDNS_SUBDOMAIN not set}"

echo "[duckdns-cleanup] Clearing TXT challenge for ${DUCKDNS_SUBDOMAIN}.duckdns.org"

wget -qO- "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&txt=removed&clear=true" >/dev/null 2>&1 || true

echo "[duckdns-cleanup] Done."
