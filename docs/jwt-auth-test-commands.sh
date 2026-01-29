#!/bin/bash

###############################################################################
# JWT Auth Flow - Test Commands für Droplet Backend
# Backend URL: https://api.mtna-lp.dev/occ
###############################################################################

# Farben für Output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Konfiguration
API_BASE_URL="https://api.mtna-lp.dev/occ"
COOKIE_FILE="/tmp/jwt-auth-cookies.txt"

# JWT Token (MUSS ERSETZT WERDEN!)
JWT_TOKEN="${JWT_TOKEN:-eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJTMjU2In0.eyJpc3MiOiJodHRwczovL2ZpZG0uZXUxLmdpZ3lhLmNvbS9vaWRjL29wL3YxLjAvNF9YUW5qam1MYzE2b1M3dnFBNkR2SUFnIiwic3ViIjoidGVzdC11c2VyLTEyMyIsImF1ZCI6IkFCYmQ2NzJLb3kzVSIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjoxNzM4MTM0MDAwLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIn0.SIGNATURE_PLACEHOLDER}"

echo "=========================================="
echo "JWT Auth Flow - Test Suite"
echo "=========================================="
echo ""
echo "Backend: ${API_BASE_URL}"
echo "Cookie File: ${COOKIE_FILE}"
echo ""

###############################################################################
# Test 1: Health Check
###############################################################################

echo -e "${BLUE}[Test 1/8] Health Check${NC}"
echo "GET ${API_BASE_URL}/health"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE_URL}/health")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Health Check OK (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Health Check Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

echo ""
echo "---"
echo ""

###############################################################################
# Test 2: Session Check (vor Login)
###############################################################################

echo -e "${BLUE}[Test 2/8] Session Check (vor Login)${NC}"
echo "GET ${API_BASE_URL}/jwt-auth/session"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE_URL}/jwt-auth/session")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Session Check OK (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    
    # Prüfe ob authenticated = false
    AUTH=$(echo "$BODY" | jq -r '.authenticated' 2>/dev/null)
    if [ "$AUTH" = "false" ]; then
        echo -e "${GREEN}✓ Nicht authentifiziert (erwartet)${NC}"
    else
        echo -e "${YELLOW}⚠ Unexpected authentication state${NC}"
    fi
else
    echo -e "${RED}✗ Session Check Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

echo ""
echo "---"
echo ""

###############################################################################
# Test 3: Login mit JWT
###############################################################################

echo -e "${BLUE}[Test 3/8] Login mit JWT${NC}"
echo "POST ${API_BASE_URL}/jwt-auth/login"
echo ""

if [ "$JWT_TOKEN" = "YOUR_JWT_TOKEN_HERE" ] || [[ "$JWT_TOKEN" == *"SIGNATURE_PLACEHOLDER"* ]]; then
    echo -e "${YELLOW}⚠ WARNING: Du verwendest einen Platzhalter-JWT!${NC}"
    echo -e "${YELLOW}⚠ Setze einen echten JWT mit: export JWT_TOKEN='your_real_jwt'${NC}"
    echo ""
fi

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/jwt-auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"jwt\":\"${JWT_TOKEN}\"}" \
  -c "${COOKIE_FILE}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Login erfolgreich (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    
    # Cookie prüfen
    if [ -f "${COOKIE_FILE}" ]; then
        echo -e "${GREEN}✓ Cookie gespeichert${NC}"
        echo "Cookie-Inhalt:"
        cat "${COOKIE_FILE}"
    fi
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}✗ Login fehlgeschlagen - JWT ungültig (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${YELLOW}Mögliche Ursachen:${NC}"
    echo "- JWT-Signatur ungültig"
    echo "- JWT abgelaufen (exp Claim)"
    echo "- Falscher Issuer/Audience"
    echo "- JWKS-Validierung fehlgeschlagen"
elif [ "$HTTP_CODE" = "400" ]; then
    echo -e "${RED}✗ Login fehlgeschlagen - Bad Request (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Login fehlgeschlagen (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

echo ""
echo "---"
echo ""

###############################################################################
# Test 4: Session Check (nach Login)
###############################################################################

echo -e "${BLUE}[Test 4/8] Session Check (nach Login)${NC}"
echo "GET ${API_BASE_URL}/jwt-auth/session"
echo ""

if [ ! -f "${COOKIE_FILE}" ]; then
    echo -e "${YELLOW}⚠ Kein Cookie vorhanden - Login war nicht erfolgreich${NC}"
    echo "Überspringe restliche Tests..."
    exit 1
fi

RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE_URL}/jwt-auth/session" \
  -b "${COOKIE_FILE}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Session Check OK (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    
    # Prüfe ob authenticated = true
    AUTH=$(echo "$BODY" | jq -r '.authenticated' 2>/dev/null)
    if [ "$AUTH" = "true" ]; then
        echo -e "${GREEN}✓ Authentifiziert (erwartet)${NC}"
    else
        echo -e "${RED}✗ Nicht authentifiziert (unerwartet)${NC}"
    fi
else
    echo -e "${RED}✗ Session Check Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

echo ""
echo "---"
echo ""

###############################################################################
# Test 5: Protected Endpoint - Profile
###############################################################################

echo -e "${BLUE}[Test 5/8] Protected Endpoint - Profile${NC}"
echo "GET ${API_BASE_URL}/jwt-protected/profile"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE_URL}/jwt-protected/profile" \
  -b "${COOKIE_FILE}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Profile abgerufen (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}✗ Unauthorized (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Request Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

echo ""
echo "---"
echo ""

###############################################################################
# Test 6: Protected Endpoint - Commerce Token
###############################################################################

echo -e "${BLUE}[Test 6/8] Protected Endpoint - Commerce Token${NC}"
echo "GET ${API_BASE_URL}/jwt-protected/commerce-token"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE_URL}/jwt-protected/commerce-token" \
  -b "${COOKIE_FILE}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Commerce Token abgerufen (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}✗ Unauthorized (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
elif [ "$HTTP_CODE" = "500" ]; then
    echo -e "${RED}✗ Server Error - Token Exchange fehlgeschlagen (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${YELLOW}Mögliche Ursachen:${NC}"
    echo "- Commerce Cloud Credentials falsch"
    echo "- JWT-Bearer Grant nicht aktiviert"
    echo "- Network-Fehler"
else
    echo -e "${RED}✗ Request Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

echo ""
echo "---"
echo ""

###############################################################################
# Test 7: Logout
###############################################################################

echo -e "${BLUE}[Test 7/8] Logout${NC}"
echo "POST ${API_BASE_URL}/jwt-auth/logout"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/jwt-auth/logout" \
  -b "${COOKIE_FILE}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Logout erfolgreich (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Logout fehlgeschlagen (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

echo ""
echo "---"
echo ""

###############################################################################
# Test 8: Session Check (nach Logout)
###############################################################################

echo -e "${BLUE}[Test 8/8] Session Check (nach Logout)${NC}"
echo "GET ${API_BASE_URL}/jwt-auth/session"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE_URL}/jwt-auth/session" \
  -b "${COOKIE_FILE}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Session Check OK (HTTP $HTTP_CODE)${NC}"
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    
    # Prüfe ob authenticated = false
    AUTH=$(echo "$BODY" | jq -r '.authenticated' 2>/dev/null)
    if [ "$AUTH" = "false" ]; then
        echo -e "${GREEN}✓ Nicht authentifiziert (erwartet nach Logout)${NC}"
    else
        echo -e "${RED}✗ Noch authentifiziert (unerwartet)${NC}"
    fi
else
    echo -e "${RED}✗ Session Check Failed (HTTP $HTTP_CODE)${NC}"
    echo "$BODY"
fi

echo ""
echo "---"
echo ""

###############################################################################
# Cleanup
###############################################################################

echo -e "${BLUE}Cleanup${NC}"
rm -f "${COOKIE_FILE}"
echo "✓ Cookie-Datei gelöscht"
echo ""

echo "=========================================="
echo "Test Suite abgeschlossen"
echo "=========================================="
