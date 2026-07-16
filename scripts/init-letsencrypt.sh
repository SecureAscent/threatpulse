#!/usr/bin/env bash
###############################################################################
# ThreatPulse Intel — Let's Encrypt bootstrap
#
# Standard certbot + nginx first-run pattern:
#   1. read DOMAIN / CERTBOT_EMAIL from .env.prod
#   2. inject the domain into the nginx server block (__DOMAIN__ token)
#   3. create a temporary self-signed cert so nginx can start on :443
#   4. bring up nginx, delete the dummy cert
#   5. request a STAGING certificate first (avoids Let's Encrypt rate limits)
#   6. prompt to switch to a PRODUCTION certificate
#
# Re-running is safe: if a real certificate already exists it is left alone.
###############################################################################
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

COMPOSE="docker compose -f docker-compose.prod.yml"
ENV_FILE=".env.prod"
NGINX_CONF="nginx/conf.d/threatpulse.conf"

# ── Load config ─────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Run 'make setup' and edit it first." >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a; . "./$ENV_FILE"; set +a

: "${DOMAIN:?DOMAIN must be set in .env.prod (e.g. threatpulse.example.com)}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL must be set in .env.prod}"

RSA_KEY_SIZE=4096
CERT_PATH="certbot/conf/live/$DOMAIN"

echo "==> Domain:  $DOMAIN"
echo "==> Email:   $CERTBOT_EMAIL"

# ── Inject the real domain into the nginx server block ───────────────────────
if grep -q "__DOMAIN__" "$NGINX_CONF"; then
  echo "==> Writing domain into $NGINX_CONF"
  sed -i.bak "s/__DOMAIN__/$DOMAIN/g" "$NGINX_CONF" && rm -f "${NGINX_CONF}.bak"
else
  echo "==> nginx conf already configured for a domain (no __DOMAIN__ token)."
fi

# ── Skip if a real certificate is already present ────────────────────────────
if [ -d "$CERT_PATH" ] && [ ! -f "$CERT_PATH/.dummy" ]; then
  echo "==> Existing certificate found at $CERT_PATH — nothing to do."
  echo "    (Delete that directory to force re-issuance.)"
  exit 0
fi

# ── Download recommended TLS params ──────────────────────────────────────────
mkdir -p certbot/conf certbot/www
if [ ! -e "certbot/conf/options-ssl-nginx.conf" ] || [ ! -e "certbot/conf/ssl-dhparams.pem" ]; then
  echo "==> Fetching recommended TLS parameters"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > certbot/conf/options-ssl-nginx.conf || true
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > certbot/conf/ssl-dhparams.pem || true
fi

# ── 1. Dummy certificate so nginx can boot on :443 ───────────────────────────
echo "==> Creating dummy certificate for $DOMAIN"
mkdir -p "$CERT_PATH"
$COMPOSE run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '/etc/letsencrypt/live/$DOMAIN/privkey.pem' \
    -out '/etc/letsencrypt/live/$DOMAIN/fullchain.pem' \
    -subj '/CN=localhost'" certbot
# chain.pem is referenced by ssl_trusted_certificate; reuse fullchain for the dummy.
cp "$CERT_PATH/fullchain.pem" "$CERT_PATH/chain.pem"
touch "$CERT_PATH/.dummy"

echo "==> Starting nginx"
$COMPOSE up -d nginx

# ── 2. Remove dummy certificate ──────────────────────────────────────────────
echo "==> Deleting dummy certificate"
$COMPOSE run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

# ── 3. STAGING certificate (avoids hitting production rate limits) ───────────
echo "==> Requesting a STAGING certificate for $DOMAIN"
$COMPOSE run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --staging \
    --email $CERTBOT_EMAIL \
    -d $DOMAIN \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos --no-eff-email --force-renewal" certbot

echo "==> Reloading nginx with staging certificate"
$COMPOSE exec nginx nginx -s reload || $COMPOSE up -d nginx

echo ""
echo "-----------------------------------------------------------------------"
echo " Staging certificate installed. Your browser will WARN about it —"
echo " that is expected for the Let's Encrypt staging environment."
echo "-----------------------------------------------------------------------"
read -r -p "Switch to a PRODUCTION (trusted) certificate now? [y/N] " ANSWER

if [ "${ANSWER:-N}" != "y" ] && [ "${ANSWER:-N}" != "Y" ]; then
  echo "==> Keeping staging certificate. Re-run this script when ready."
  exit 0
fi

# ── 4. Replace staging with a PRODUCTION certificate ─────────────────────────
echo "==> Deleting staging certificate"
$COMPOSE run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "==> Requesting PRODUCTION certificate for $DOMAIN"
$COMPOSE run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $CERTBOT_EMAIL \
    -d $DOMAIN \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos --no-eff-email --force-renewal" certbot

echo "==> Reloading nginx with production certificate"
$COMPOSE exec nginx nginx -s reload || $COMPOSE up -d nginx

echo ""
echo "======================================================================="
echo " SUCCESS — https://$DOMAIN is now served with a trusted certificate."
echo " Certbot will auto-renew it (see the certbot service)."
echo "======================================================================="
