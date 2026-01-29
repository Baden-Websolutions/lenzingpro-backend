#!/bin/bash

###############################################################################
# Get Real JWT from CDC Gigya
###############################################################################

# Konfiguration
CDC_API_KEY="4_XQnjjmLc16oS7vqA6DvIAg"
CDC_EMAIL="${CDC_EMAIL:-YOUR_EMAIL@example.com}"
CDC_PASSWORD="${CDC_PASSWORD:-YOUR_PASSWORD}"

# Farben
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "Get Real JWT from CDC Gigya"
echo "=========================================="
echo ""

# Prüfe ob Email/Password gesetzt sind
if [ "${CDC_EMAIL}" = "YOUR_EMAIL@example.com" ]; then
    echo -e "${RED}Fehler: CDC_EMAIL nicht gesetzt!${NC}"
    echo ""
    echo "Verwendung:"
    echo "  export CDC_EMAIL='your@email.com'"
    echo "  export CDC_PASSWORD='yourpassword'"
    echo "  bash get-jwt.sh"
    echo ""
    exit 1
fi

if [ "${CDC_PASSWORD}" = "YOUR_PASSWORD" ]; then
    echo -e "${RED}Fehler: CDC_PASSWORD nicht gesetzt!${NC}"
    echo ""
    echo "Verwendung:"
    echo "  export CDC_EMAIL='your@email.com'"
    echo "  export CDC_PASSWORD='yourpassword'"
    echo "  bash get-jwt.sh"
    echo ""
    exit 1
fi

###############################################################################
# Schritt 1: CDC Login
###############################################################################

echo -e "${BLUE}[1/3] CDC Login${NC}"
echo "Email: ${CDC_EMAIL}"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.login" \
  -d "apiKey=${CDC_API_KEY}" \
  -d "loginID=${CDC_EMAIL}" \
  -d "password=${CDC_PASSWORD}")

# Prüfe Fehler
ERROR_CODE=$(echo "${LOGIN_RESPONSE}" | jq -r '.errorCode')
if [ "${ERROR_CODE}" != "0" ]; then
    echo -e "${RED}✗ Login fehlgeschlagen (errorCode: ${ERROR_CODE})${NC}"
    echo ""
    ERROR_MESSAGE=$(echo "${LOGIN_RESPONSE}" | jq -r '.errorMessage')
    echo "Error: ${ERROR_MESSAGE}"
    echo ""
    echo "Response:"
    echo "${LOGIN_RESPONSE}" | jq .
    exit 1
fi

echo -e "${GREEN}✓ Login erfolgreich${NC}"

# Login Token extrahieren
LOGIN_TOKEN=$(echo "${LOGIN_RESPONSE}" | jq -r '.sessionInfo.login_token')
UID=$(echo "${LOGIN_RESPONSE}" | jq -r '.UID')

echo "UID: ${UID}"
echo "Login Token: ${LOGIN_TOKEN:0:20}..."
echo ""

###############################################################################
# Schritt 2: JWT holen
###############################################################################

echo -e "${BLUE}[2/3] JWT holen${NC}"
echo ""

JWT_RESPONSE=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -d "apiKey=${CDC_API_KEY}" \
  -d "login_token=${LOGIN_TOKEN}")

# Prüfe Fehler
ERROR_CODE=$(echo "${JWT_RESPONSE}" | jq -r '.errorCode')
if [ "${ERROR_CODE}" != "0" ]; then
    echo -e "${RED}✗ JWT request fehlgeschlagen (errorCode: ${ERROR_CODE})${NC}"
    echo ""
    ERROR_MESSAGE=$(echo "${JWT_RESPONSE}" | jq -r '.errorMessage')
    echo "Error: ${ERROR_MESSAGE}"
    echo ""
    echo "Response:"
    echo "${JWT_RESPONSE}" | jq .
    exit 1
fi

echo -e "${GREEN}✓ JWT erfolgreich geholt${NC}"

# JWT extrahieren
JWT_TOKEN=$(echo "${JWT_RESPONSE}" | jq -r '.id_token')

echo ""

###############################################################################
# Schritt 3: JWT dekodieren und anzeigen
###############################################################################

echo -e "${BLUE}[3/3] JWT dekodieren${NC}"
echo ""

# JWT Header
echo "JWT Header:"
echo "${JWT_TOKEN}" | cut -d'.' -f1 | base64 -d 2>/dev/null | jq .
echo ""

# JWT Payload
echo "JWT Payload:"
JWT_PAYLOAD=$(echo "${JWT_TOKEN}" | cut -d'.' -f2 | base64 -d 2>/dev/null)
echo "${JWT_PAYLOAD}" | jq .
echo ""

# Expiration prüfen
EXP=$(echo "${JWT_PAYLOAD}" | jq -r '.exp')
NOW=$(date +%s)
REMAINING=$((EXP - NOW))

if [ ${REMAINING} -gt 0 ]; then
    MINUTES=$((REMAINING / 60))
    echo -e "${GREEN}✓ JWT gültig für weitere ${MINUTES} Minuten${NC}"
else
    echo -e "${RED}✗ JWT ist abgelaufen!${NC}"
fi

echo ""

###############################################################################
# Ergebnis
###############################################################################

echo "=========================================="
echo -e "${GREEN}JWT Token erfolgreich geholt!${NC}"
echo "=========================================="
echo ""
echo "${JWT_TOKEN}"
echo ""
echo "=========================================="
echo ""

# Export für weitere Verwendung
export JWT_TOKEN="${JWT_TOKEN}"

echo "JWT Token wurde in \$JWT_TOKEN gespeichert"
echo ""
echo "Jetzt kannst du testen mit:"
echo "  export JWT_TOKEN=\"${JWT_TOKEN}\""
echo "  bash jwt-auth-test-commands.sh"
echo ""
echo "Oder direkt:"
echo "  curl -X POST https://api.mtna-lp.dev/occ/jwt-auth/login \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"jwt\":\"${JWT_TOKEN}\"}' \\"
echo "    -v"
echo ""
