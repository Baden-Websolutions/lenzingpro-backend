#!/bin/bash

# OIDC PKCE Deployment Script
# Dieses Script deployed die OIDC PKCE Updates auf den Server

set -e

echo "=========================================="
echo "OIDC PKCE Deployment Script"
echo "=========================================="
echo ""

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Server Details
SERVER_USER="lenzing-dev"
SERVER_HOST="api.mtna-lp.dev"
BACKEND_PATH="/home/lenzing-dev/lenzingpro-v2/lenzingpro-backend"

echo -e "${YELLOW}1. Git Pull auf Server...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
cd /home/lenzing-dev/lenzingpro-v2/lenzingpro-backend
echo "Current branch: $(git branch --show-current)"
echo "Pulling latest changes..."
git pull origin main
echo "Latest commit: $(git log --oneline -1)"
EOF

echo ""
echo -e "${GREEN}✓ Git Pull erfolgreich${NC}"
echo ""

echo -e "${YELLOW}2. Dependencies installieren...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
cd /home/lenzing-dev/lenzingpro-v2/lenzingpro-backend
npm install
EOF

echo ""
echo -e "${GREEN}✓ Dependencies installiert${NC}"
echo ""

echo -e "${YELLOW}3. TypeScript kompilieren...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
cd /home/lenzing-dev/lenzingpro-v2/lenzingpro-backend
npm run build
EOF

echo ""
echo -e "${GREEN}✓ Build erfolgreich${NC}"
echo ""

echo -e "${YELLOW}4. PM2 neu starten...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << 'EOF'
cd /home/lenzing-dev/lenzingpro-v2/lenzingpro-backend
pm2 restart lenzingpro-api
sleep 2
pm2 list | grep lenzingpro-api
EOF

echo ""
echo -e "${GREEN}✓ PM2 neu gestartet${NC}"
echo ""

echo -e "${YELLOW}5. Backend testen...${NC}"
echo ""

echo "Health Check:"
curl -s https://api.mtna-lp.dev/health | jq '.'
echo ""

echo "Discovery Bundle:"
curl -s https://api.mtna-lp.dev/oidc/discovery/bundle | jq '.discovery.body.issuer'
echo ""

echo "POST /oidc (Authorization Start):"
curl -s -X POST https://api.mtna-lp.dev/oidc \
  -H "Content-Type: application/json" \
  -d '{"returnTo":"/"}' | jq '.authorizationUrl' | head -c 80
echo "..."
echo ""

echo ""
echo -e "${GREEN}=========================================="
echo "✓ Deployment erfolgreich abgeschlossen!"
echo "==========================================${NC}"
echo ""
echo "Nächste Schritte:"
echo "1. Nginx Konfiguration aktualisieren (siehe nginx-oidc-config.conf)"
echo "2. Test-Seite im Browser testen"
echo "3. PM2 Logs überwachen: pm2 logs lenzingpro-api"
echo ""
