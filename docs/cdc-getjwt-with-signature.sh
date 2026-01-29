#!/bin/bash

###############################################################################
# CDC accounts.getJWT - Vollständiges Beispiel mit HMAC-Signatur
###############################################################################

# Konfiguration
CDC_API_KEY="4_XQnjjmLc16oS7vqA6DvIAg"
CDC_SECRET_KEY="${CDC_SECRET_KEY:-YOUR_CDC_SECRET_KEY}"
CDC_EMAIL="${CDC_EMAIL:-YOUR_EMAIL@example.com}"
CDC_PASSWORD="${CDC_PASSWORD:-YOUR_PASSWORD}"

# Farben
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "CDC accounts.getJWT mit HMAC-Signatur"
echo "=========================================="
echo ""

# Prüfe ob Credentials gesetzt sind
if [ "${CDC_SECRET_KEY}" = "YOUR_CDC_SECRET_KEY" ]; then
    echo -e "${RED}Fehler: CDC_SECRET_KEY nicht gesetzt!${NC}"
    echo ""
    echo "Verwendung:"
    echo "  export CDC_SECRET_KEY='your_secret_key'"
    echo "  export CDC_EMAIL='your@email.com'"
    echo "  export CDC_PASSWORD='yourpassword'"
    echo "  bash cdc-getjwt-with-signature.sh"
    echo ""
    exit 1
fi

###############################################################################
# Schritt 1: CDC Login (ohne Signatur - accounts.login benötigt keine)
###############################################################################

echo -e "${BLUE}[1/3] CDC Login${NC}"
echo "Email: ${CDC_EMAIL}"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
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
echo "Login Token: ${LOGIN_TOKEN}"
echo ""

###############################################################################
# Schritt 2: HMAC-Signatur berechnen für accounts.getJWT
###############################################################################

echo -e "${BLUE}[2/3] HMAC-Signatur berechnen${NC}"
echo ""

# Timestamp (Unix-Timestamp in Sekunden)
TIMESTAMP=$(date +%s)
NONCE=$(date +%s%N | md5sum | cut -c1-32)

echo "Timestamp: ${TIMESTAMP}"
echo "Nonce: ${NONCE}"
echo ""

# Base String erstellen (nach Gigya-Spezifikation)
# Format: httpMethod + "&" + url + "&" + sortedParams
HTTP_METHOD="POST"
URL="https://accounts.eu1.gigya.com/accounts.getJWT"

# Parameter alphabetisch sortieren
PARAMS="apiKey=${CDC_API_KEY}&login_token=${LOGIN_TOKEN}&nonce=${NONCE}&timestamp=${TIMESTAMP}"

# Base String
BASE_STRING="${HTTP_METHOD}&$(echo -n ${URL} | jq -sRr @uri)&$(echo -n ${PARAMS} | jq -sRr @uri)"

echo "Base String:"
echo "${BASE_STRING}"
echo ""

# HMAC-SHA1-Signatur berechnen
# Gigya verwendet Base64-encoded Secret Key
SECRET_KEY_BASE64=$(echo -n "${CDC_SECRET_KEY}" | base64)
SIGNATURE=$(echo -n "${BASE_STRING}" | openssl dgst -sha1 -hmac "${CDC_SECRET_KEY}" -binary | base64)

echo "Secret Key (Base64): ${SECRET_KEY_BASE64:0:20}..."
echo "Signature: ${SIGNATURE}"
echo ""

###############################################################################
# Schritt 3: accounts.getJWT mit Signatur aufrufen
###############################################################################

echo -e "${BLUE}[3/3] accounts.getJWT aufrufen${NC}"
echo ""

# Vollständiger curl-Befehl
echo "curl-Befehl:"
echo "curl -X POST \"https://accounts.eu1.gigya.com/accounts.getJWT\" \\"
echo "  -H \"Content-Type: application/x-www-form-urlencoded\" \\"
echo "  -d \"apiKey=${CDC_API_KEY}\" \\"
echo "  -d \"login_token=${LOGIN_TOKEN}\" \\"
echo "  -d \"nonce=${NONCE}\" \\"
echo "  -d \"timestamp=${TIMESTAMP}\" \\"
echo "  -d \"sig=${SIGNATURE}\""
echo ""

JWT_RESPONSE=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "apiKey=${CDC_API_KEY}" \
  -d "login_token=${LOGIN_TOKEN}" \
  -d "nonce=${NONCE}" \
  -d "timestamp=${TIMESTAMP}" \
  -d "sig=${SIGNATURE}")

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
echo ""

# JWT extrahieren
JWT_TOKEN=$(echo "${JWT_RESPONSE}" | jq -r '.id_token')

###############################################################################
# JWT dekodieren
###############################################################################

echo "=========================================="
echo "JWT Token:"
echo "=========================================="
echo "${JWT_TOKEN}"
echo ""

echo "JWT Header:"
echo "${JWT_TOKEN}" | cut -d'.' -f1 | base64 -d 2>/dev/null | jq .
echo ""

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
