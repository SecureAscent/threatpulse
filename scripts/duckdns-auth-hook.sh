#!/bin/sh
###############################################################################
# ThreatPulse Intel — Certbot DNS-01 auth hook for DuckDNS
#
# Certbot calls this script during a `--manual --preferred-challenges dns`
# run and provides:
#   $CERTBOT_DOMAIN      the domain being validated
#   $CERTBOT_VALIDATION  the TXT value that must be published
#
# We publish it as the DuckDNS TXT record. DuckDNS automatically serves this
# value at _acme-challenge.<subdomain>.duckdns.org, which is exactly what
# Let's Encrypt queries.
#
# Requires (from environment, injected by init-letsencrypt-duckdns.sh):
#   DUCKDNS_TOKEN, DUCKDNS_SUBDOMAIN
#
# Uses busybox `wget` so it works inside the certbot/certbot alpine image
# without installing anything.
###############################################################################
set -eu

: "${DUCKDNS_TOKEN:?DUCKDNS_TOKEN not set}"
: "${DUCKDNS_SUBDOMAIN:?DUCKDNS_SUBDOMAIN not set}"
: "${CERTBOT_VALIDATION:?CERTBOT_VALIDATION not set (is certbot invoking this hook?)}"

echo "[duckdns-auth] Publishing TXT challenge for ${DUCKDNS_SUBDOMAIN}.duckdns.org"

RESPONSE=$(wget -qO- "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&txt=${CERTBOT_VALIDATION}" 2>/dev/null || true)

echo "[duckdns-auth] DuckDNS response: '${RESPONSE}'"

if [ "$RESPONSE" != "OK" ]; then
  echo "[duckdns-auth] ERROR: DuckDNS did not return OK." >&2
  echo "[duckdns-auth] Check DUCKDNS_TOKEN and DUCKDNS_SUBDOMAIN in .env.prod." >&2
  exit 1
fi

# Give DuckDNS + public resolvers time to propagate the new TXT record before
# Let's Encrypt queries it. 45s is comfortably safe for DuckDNS.
echo "[duckdns-auth] Waiting 45s for DNS propagation..."
sleep 45
echo "[duckdns-auth] Done."
