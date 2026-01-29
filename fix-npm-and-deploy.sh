#!/bin/bash

# NPM Fix und Deployment Script
# Behebt "Cannot read properties of null (reading 'matches')" Fehler

set -e

echo "=========================================="
echo "NPM Fix und Deployment Script"
echo "=========================================="
echo ""

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

BACKEND_PATH="/home/lenzing-dev/lenzingpro-v2/lenzingpro-backend"

echo -e "${YELLOW}1. NPM Cache bereinigen...${NC}"
cd $BACKEND_PATH
npm cache clean --force
echo -e "${GREEN}✓ NPM Cache bereinigt${NC}"
echo ""

echo -e "${YELLOW}2. node_modules und package-lock.json löschen...${NC}"
rm -rf node_modules
rm -f package-lock.json
echo -e "${GREEN}✓ Alte Dependencies entfernt${NC}"
echo ""

echo -e "${YELLOW}3. Dependencies neu installieren...${NC}"
npm install --legacy-peer-deps
echo -e "${GREEN}✓ Dependencies installiert${NC}"
echo ""

echo -e "${YELLOW}4. TypeScript kompilieren...${NC}"
npm run build
echo -e "${GREEN}✓ Build erfolgreich${NC}"
echo ""

echo -e "${YELLOW}5. PM2 neu starten...${NC}"
pm2 restart lenzingpro-api
sleep 2
pm2 list | grep lenzingpro-api
echo -e "${GREEN}✓ PM2 neu gestartet${NC}"
echo ""

echo -e "${YELLOW}6. Backend testen...${NC}"
echo ""

echo "Health Check:"
curl -s https://api.mtna-lp.dev/health | jq '.' || echo "Health endpoint nicht erreichbar"
echo ""

echo "Discovery Bundle:"
curl -s https://api.mtna-lp.dev/oidc/discovery/bundle | jq '.discovery.body.issuer' || echo "Discovery endpoint nicht erreichbar"
echo ""

echo ""
echo -e "${GREEN}=========================================="
echo "✓ Fix und Deployment erfolgreich!"
echo "==========================================${NC}"
echo ""
echo "PM2 Logs anzeigen:"
echo "pm2 logs lenzingpro-api --lines 50"
echo ""
