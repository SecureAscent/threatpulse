#!/usr/bin/env bash
###############################################################################
# ThreatPulse Intel — Let's Encrypt bootstrap via DuckDNS DNS-01 challenge
#
# Use this INSTEAD of `make ssl` when inbound port 80 is not reachable from the
# internet (home connections, CGNAT, ISPs that block port 80). It proves domain
# ownership by publishing a TXT record through the DuckDNS API — no open ports.
#
# Flow:
#   1. read DOMAIN / CERTBOT_EMAIL / DUCKDNS_TOKEN / DUCKDNS_SUBDOMAIN from .env.prod
#   2. inject the domain into the nginx server block (__DOMAIN__ token)
#   3. request a STAGING certificate first (avoids Let's Encrypt rate limits)
#   4. prompt to switch to a PRODUCTION certificate
#
# Re-running is safe: if a real certificate already exists it is left alone.
###############################################################################
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

COMPOSE="docker compose -f docker-compose.prod.yml"
ENV_FILE=".env.prod"
NGINX_CONF="nginx/conf.d/threatpulse.conf"
SCRIPTS_DIR="$(pwd)/scripts"

# ── Load config ─────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Run 'make setup' and edit it first." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; . "./$ENV_FILE"; set +a

: "${DOMAIN:?DOMAIN must be set in .env.prod (e.g. chaugen.duckdns.org)}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set in .env.prod}"
: "${DUCKDNS_TOKEN:?DUCKDNS_TOKEN must be set in .env.prod (from your DuckDNS account page)}"
: "${DUCKDNS_SUBDOMAIN:?DUCKDNS_SUBDOMAIN must be set in .env.prod (the part before .duckdns.org)}"

RSA_KEY_SIZE=4096
CERT_PATH="certbot/conf/live/$DOMAIN"

echo "==> Domain:            $DOMAIN"
echo "==> Email:             $CERTBOT_EMAIL"
echo "==> DuckDNS subdomain: $DUCKDNS_SUBDOMAIN"
echo "==> Challenge:         DNS-01 (no inbound ports required)"

# Sanity check: DOMAIN should be <subdomain>.duckdns.org
case "$DOMAIN" in
  "${DUCKDNS_SUBDOMAIN}.duckdns.org") : ;;
  *) echo "WARNING: DOMAIN ($DOMAIN) does not look like ${DUCKDNS_SUBDOMAIN}.duckdns.org — continuing anyway." ;;
esac

# ── Inject the real domain into the nginx server block ───────────────────────
if grep -q "__DOMAIN__" "$NGINX_CONF"; then
  echo "==> Writing domain into $NGINX_CONF"
  sed -i.bak "s/__DOMAIN__/$DOMAIN/g" "$NGINX_CONF" && rm -f "${NGINX_CONF}.bak"
else
  echo "==> nginx conf already configured for a domain (no __DOMAIN__ token)."
fi

# ── Skip if a real certificate is already present ────────────────────────────
if [ -d "$CERT_PATH" ]; then
  echo "==> Existing certificate found at $CERT_PATH — nothing to do."
  echo "    (Delete that directory to force re-issuance.)"
  exit 0
fi

# ── Recommended TLS params + webroot dirs ────────────────────────────────────
mkdir -p certbot/conf certbot/www
if [ ! -e "certbot/conf/options-ssl-nginx.conf" ] || [ ! -e "certbot/conf/ssl-dhparams.pem" ]; then
  echo "==> Fetching recommended TLS parameters"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > certbot/conf/options-ssl-nginx.conf || true
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > certbot/conf/ssl-dhparams.pem || true
fi

# Make sure the hooks are executable (they are mounted read-only into certbot).
chmod +x scripts/duckdns-auth-hook.sh scripts/duckdns-cleanup-hook.sh

# Helper: run certbot with the DuckDNS hooks. $1 = extra flags (e.g. --staging)
run_certbot() {
  local extra="$1"
  # shellcheck disable=SC2086
  $COMPOSE run --rm --no-deps \
    -e DUCKDNS_TOKEN="$DUCKDNS_TOKEN" \
    -e DUCKDNS_SUBDOMAIN="$DUCKDNS_SUBDOMAIN" \
    -v "$SCRIPTS_DIR:/scripts:ro" \
    --entrypoint certbot certbot \
    certonly \
      --manual \
      --preferred-challenges dns \
      --manual-auth-hook /scripts/duckdns-auth-hook.sh \
      --manual-cleanup-hook /scripts/duckdns-cleanup-hook.sh \
      --non-interactive \
      --agree-tos --no-eff-email \
      --email "$CERTBOT_EMAIL" \
      --rsa-key-size "$RSA_KEY_SIZE" \
      --force-renewal \
      -d "$DOMAIN" \
      $extra
}

# ── 1. STAGING certificate (avoids hitting production rate limits) ───────────
echo ""
echo "==> Requesting a STAGING certificate for $DOMAIN via DuckDNS DNS-01"
run_certbot "--staging"

echo ""
echo "-----------------------------------------------------------------------"
echo " Staging certificate obtained successfully via DNS-01."
echo " (Staging certs are UNTRUSTED — browsers will warn. That's expected.)"
echo "-----------------------------------------------------------------------"
read -r -p "Switch to a PRODUCTION (trusted) certificate now? [y/N] " ANSWER

if [ "${ANSWER:-N}" != "y" ] && [ "${ANSWER:-N}" != "Y" ]; then
  echo "==> Keeping staging certificate. Re-run this script when ready."
  exit 0
fi

# ── 2. Replace staging with a PRODUCTION certificate ─────────────────────────
echo "==> Deleting staging certificate"
$COMPOSE run --rm --no-deps --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "==> Requesting PRODUCTION certificate for $DOMAIN via DuckDNS DNS-01"
run_certbot ""

echo ""
echo "======================================================================="
echo " SUCCESS — a trusted certificate for $DOMAIN is now installed."
echo ""
echo " Next step:  make up"
echo " Then browse to:  https://$DOMAIN"
echo ""
echo " NOTE: automatic renewal via the certbot container uses the webroot"
echo "       (HTTP) method and will NOT work while port 80 is blocked."
echo "       To renew on this DNS-01 setup, re-run:  make ssl-duckdns"
echo "       (Tip: add it to cron every ~60 days.)"
echo "======================================================================="
