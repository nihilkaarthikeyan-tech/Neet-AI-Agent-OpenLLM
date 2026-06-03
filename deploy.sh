#!/bin/bash
# ═══════════════════════════════════════════════════════════
# NEET AI — Hostinger VPS Deployment Script
# Run this script on your Hostinger VPS after SSH login
# Usage: bash deploy.sh
# ═══════════════════════════════════════════════════════════

set -e  # Stop on any error

echo "======================================"
echo "  NEET AI — Production Deployment"
echo "======================================"

# ── 1. Install Docker if not present ─────────────────────
if ! command -v docker &> /dev/null; then
  echo "[1/8] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
else
  echo "[1/8] Docker already installed — skipping"
fi

# ── 2. Install Docker Compose if not present ─────────────
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo "[2/8] Installing Docker Compose..."
  apt-get update && apt-get install -y docker-compose-plugin
else
  echo "[2/8] Docker Compose already installed — skipping"
fi

# ── 3. Check .env exists ──────────────────────────────────
echo "[3/8] Checking .env file..."
if [ ! -f ".env" ]; then
  echo ""
  echo "ERROR: .env file not found!"
  echo "Copy .env.production.example to .env and fill in all values:"
  echo "  cp .env.production.example .env"
  echo "  nano .env"
  exit 1
fi

# ── 4. Check required env vars ───────────────────────────
echo "[4/8] Validating environment variables..."
REQUIRED_VARS="JWT_SECRET POSTGRES_PASSWORD POSTGRES_USER POSTGRES_DB FRONTEND_URL BACKEND_URL LLM_API_KEY LLM_BASE_URL SMTP_USER SMTP_PASS"
MISSING=""
for VAR in $REQUIRED_VARS; do
  VALUE=$(grep "^${VAR}=" .env | cut -d'=' -f2- | tr -d '"')
  if [ -z "$VALUE" ] || echo "$VALUE" | grep -q "REPLACE\|CHANGE\|your-"; then
    MISSING="$MISSING $VAR"
  fi
done

if [ -n "$MISSING" ]; then
  echo ""
  echo "ERROR: These required variables are not set in .env:$MISSING"
  echo "Edit your .env file and fill in all values, then run this script again."
  exit 1
fi

echo "  All required variables are set."

# ── 5. Install Certbot for SSL ───────────────────────────
echo "[5/8] Checking SSL (Certbot)..."
if ! command -v certbot &> /dev/null; then
  echo "  Installing Certbot..."
  apt-get update && apt-get install -y certbot
fi

DOMAIN=$(grep "^FRONTEND_URL=" .env | cut -d'=' -f2- | tr -d '"' | sed 's|https://||' | sed 's|http://||')
CERT_PATH="/etc/letsencrypt/live/$DOMAIN"

if [ ! -d "$CERT_PATH" ]; then
  echo "  Requesting SSL certificate for $DOMAIN..."
  echo "  NOTE: Make sure your domain DNS points to this server first."
  certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "$(grep '^SMTP_USER=' .env | cut -d'=' -f2- | tr -d '"')" || {
    echo "  WARNING: SSL cert request failed. Continuing without HTTPS for now."
    echo "  Fix DNS and rerun: certbot certonly --standalone -d $DOMAIN"
  }
else
  echo "  SSL certificate already exists for $DOMAIN"
fi

# ── 6. Build and start containers ───────────────────────
echo "[6/8] Building and starting containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# ── 7. Wait for DB and run migrations ───────────────────
echo "[7/8] Waiting for database to be ready..."
sleep 10
docker exec neet_backend sh -c "npx prisma migrate deploy" || {
  echo "  Migration may have already run or DB not ready yet. Checking..."
  docker logs neet_backend --tail 20
}

# ── 8. Health check ──────────────────────────────────────
echo "[8/8] Running health check..."
sleep 5
HEALTH=$(curl -sf http://localhost:5005/health 2>/dev/null || echo "unreachable")
echo "  Backend health: $HEALTH"

echo ""
echo "======================================"
echo "  Deployment Complete!"
echo "======================================"
echo ""
echo "  Frontend: $FRONTEND_URL"
echo "  Backend:  $(grep '^BACKEND_URL=' .env | cut -d'=' -f2- | tr -d '"')"
echo "  Health:   $(grep '^BACKEND_URL=' .env | cut -d'=' -f2- | tr -d '"')/health"
echo ""
echo "  View logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "  Restart:      docker compose -f docker-compose.prod.yml restart"
echo "  Stop:         docker compose -f docker-compose.prod.yml down"
echo ""
