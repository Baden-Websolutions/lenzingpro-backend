# JWT Auth Flow - curl Test-Befehle

## 🚀 Schnellstart

### Automatisches Test-Script

```bash
# JWT Token setzen (WICHTIG: Echten JWT verwenden!)
export JWT_TOKEN="YOUR_REAL_JWT_TOKEN_HERE"

# Test-Script ausführen
bash jwt-auth-test-commands.sh
```

**Das Script testet automatisch:**

1. ✅ Health Check

1. ✅ Session Check (vor Login)

1. ✅ Login mit JWT

1. ✅ Session Check (nach Login)

1. ✅ Protected Endpoint - Profile

1. ✅ Protected Endpoint - Commerce Token

1. ✅ Logout

1. ✅ Session Check (nach Logout)

---

## 📋 Manuelle curl-Befehle

### Setup

```bash
# Backend URL
export API_BASE_URL="https://api.mtna-lp.dev/occ"

# Cookie-Datei
export COOKIE_FILE="/tmp/jwt-auth-cookies.txt"

# JWT Token (ERSETZE MIT ECHTEM TOKEN! )
export JWT_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2ZpZG0uZXUxLmdpZ3lhLmNvbS9vaWRjL29wL3YxLjAvNF9YUW5qam1MYzE2b1M3dnFBNkR2SUFnIiwic3ViIjoidGVzdC11c2VyIiwiYXVkIjoiQUJiZDY3MktveTNVIiwiZXhwIjo5OTk5OTk5OTk5fQ.SIGNATURE"
```

---

### Test 1: Health Check

```bash
curl -s "${API_BASE_URL}/health" | jq .
```

**Erwartete Response (HTTP 200):**

```json
{
  "status": "ok",
  "timestamp": "2024-01-29T12:00:00.000Z"
}
```

---

### Test 2: Session Check (vor Login)

```bash
curl -s "${API_BASE_URL}/jwt-auth/session" | jq .
```

**Erwartete Response (HTTP 200):**

```json
{
  "authenticated": false,
  "message": "No JWT session found"
}
```

---

### Test 3: Login mit JWT

```bash
curl -X POST "${API_BASE_URL}/jwt-auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"jwt\":\"${JWT_TOKEN}\"}" \
  -c "${COOKIE_FILE}" \
  -v
```

**Erwartete Response (HTTP 200):**

```json
{
  "success": true,
  "sessionId": "abc123...",
  "user": {
    "userId": "test-user-123",
    "email": "test@example.com",
    "name": "Test User"
  }
}
```

**Response-Header enthält:**

```
Set-Cookie: jwt_session_id=abc123...; Path=/; HttpOnly; Secure; SameSite=Lax
```

**Mögliche Fehler:**

**HTTP 400 - Bad Request:**

```json
{
  "success": false,
  "error": "missing_jwt",
  "message": "JWT token is required"
}
```

**HTTP 401 - Unauthorized:**

```json
{
  "success": false,
  "error": "invalid_jwt",
  "message": "JWT validation failed: invalid signature"
}
```

**HTTP 500 - Server Error:**

```json
{
  "success": false,
  "error": "token_exchange_failed",
  "message": "Failed to exchange JWT for commerce token"
}
```

---

### Test 4: Session Check (nach Login)

```bash
curl -s "${API_BASE_URL}/jwt-auth/session" \
  -b "${COOKIE_FILE}" | jq .
```

**Erwartete Response (HTTP 200):**

```json
{
  "authenticated": true,
  "user": {
    "userId": "test-user-123",
    "email": "test@example.com",
    "name": "Test User"
  }
}
```

---

### Test 5: Protected Endpoint - Profile

```bash
curl -s "${API_BASE_URL}/jwt-protected/profile" \
  -b "${COOKIE_FILE}" | jq .
```

**Erwartete Response (HTTP 200):**

```json
{
  "userId": "test-user-123",
  "email": "test@example.com",
  "name": "Test User",
  "sessionId": "abc123...",
  "createdAt": "2024-01-29T12:00:00.000Z"
}
```

**HTTP 401 - Unauthorized:**

```json
{
  "error": "Unauthorized",
  "message": "No JWT session found"
}
```

---

### Test 6: Protected Endpoint - Commerce Token

```bash
curl -s "${API_BASE_URL}/jwt-protected/commerce-token" \
  -b "${COOKIE_FILE}" | jq .
```

**Erwartete Response (HTTP 200):**

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-29T13:00:00.000Z"
}
```

**HTTP 401 - Unauthorized:**

```json
{
  "error": "Unauthorized",
  "message": "No JWT session found"
}
```

**HTTP 500 - Server Error:**

```json
{
  "error": "Token exchange failed",
  "message": "Failed to exchange JWT for commerce token"
}
```

---

### Test 7: Logout

```bash
curl -X POST "${API_BASE_URL}/jwt-auth/logout" \
  -b "${COOKIE_FILE}" | jq .
```

**Erwartete Response (HTTP 200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### Test 8: Session Check (nach Logout)

```bash
curl -s "${API_BASE_URL}/jwt-auth/session" \
  -b "${COOKIE_FILE}" | jq .
```

**Erwartete Response (HTTP 200):**

```json
{
  "authenticated": false,
  "message": "No JWT session found"
}
```

---

### Cleanup

```bash
rm -f "${COOKIE_FILE}"
```

---

## 🎯 One-Liner: Kompletter Flow

```bash
export API_BASE_URL="https://api.mtna-lp.dev/occ" && \
export COOKIE_FILE="/tmp/jwt-cookies.txt" && \
export JWT_TOKEN="YOUR_JWT_TOKEN_HERE" && \
echo "=== Health Check ===" && \
curl -s "${API_BASE_URL}/health" | jq . && \
echo -e "\n=== Login ===" && \
curl -s -X POST "${API_BASE_URL}/jwt-auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"jwt\":\"${JWT_TOKEN}\"}" \
  -c "${COOKIE_FILE}" | jq . && \
echo -e "\n=== Session Check ===" && \
curl -s "${API_BASE_URL}/jwt-auth/session" \
  -b "${COOKIE_FILE}" | jq . && \
echo -e "\n=== Profile ===" && \
curl -s "${API_BASE_URL}/jwt-protected/profile" \
  -b "${COOKIE_FILE}" | jq . && \
echo -e "\n=== Commerce Token ===" && \
curl -s "${API_BASE_URL}/jwt-protected/commerce-token" \
  -b "${COOKIE_FILE}" | jq . && \
echo -e "\n=== Logout ===" && \
curl -s -X POST "${API_BASE_URL}/jwt-auth/logout" \
  -b "${COOKIE_FILE}" | jq . && \
echo -e "\n=== Verify Logout ===" && \
curl -s "${API_BASE_URL}/jwt-auth/session" \
  -b "${COOKIE_FILE}" | jq . && \
rm -f "${COOKIE_FILE}"
```

---

## 🔍 Debugging

### Verbose Output

```bash
curl -v -X POST "${API_BASE_URL}/jwt-auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"jwt\":\"${JWT_TOKEN}\"}" \
  -c "${COOKIE_FILE}"
```

### Cookie-Datei inspizieren

```bash
cat "${COOKIE_FILE}"
```

**Erwarteter Inhalt:**

```
api.mtna-lp.dev	FALSE	/	TRUE	1738220000	jwt_session_id	abc123...
```

### Backend-Logs prüfen

```bash
# Auf dem Droplet
pm2 logs lenzingpro-backend

# JWT-spezifische Logs
pm2 logs lenzingpro-backend | grep -i jwt
```

---

## ⚠️ Wichtige Hinweise

### JWT Token ersetzen

Der Platzhalter-JWT im Script ist **nicht gültig**. Du musst ihn durch einen echten JWT ersetzen.

**Wo bekommst du einen echten JWT?**

#### Option 1: Von deinem CDC (Customer Data Cloud )

1. Gehe zu: `https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg/authorize?client_id=ABbd672Koy3U&response_type=code&scope=openid profile email&redirect_uri=http://localhost/`

1. Authentifiziere dich

1. Tausche den Code gegen Token

1. Verwende den `id_token`

#### Option 2: Für schnelle Tests (jwt.io )

1. Gehe zu [https://jwt.io](https://jwt.io)

1. Erstelle einen JWT mit:
  - **Header:** `{"alg":"RS256","typ":"JWT"}`
  - **Payload:** `{"iss":"https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg","sub":"test-user","aud":"ABbd672Koy3U","exp":9999999999}`

1. **Hinweis:** Dieser wird die Signatur-Validierung nicht bestehen, es sei denn, du hast den Private Key

### Cookie-Handling

- **`-c ${COOKIE_FILE}`** beim Login → Cookies speichern

- **`-b ${COOKIE_FILE}`** bei nachfolgenden Requests → Cookies senden

- Cookies sind **HttpOnly** und können nicht von JavaScript gelesen werden

- Cookies sind **Secure** (nur HTTPS in Production )

### CORS

Wenn du von einem Browser aus testest (z.B. mit fetch), stelle sicher:

```javascript
fetch('https://api.mtna-lp.dev/occ/jwt-auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Wichtig!
  body: JSON.stringify({ jwt: 'YOUR_JWT' } )
})
```

---

## 📊 Erwartete Ergebnisse

### Erfolgreicher Flow

```
✓ Health Check OK (HTTP 200)
✓ Session Check OK - nicht authentifiziert (HTTP 200)
✓ Login erfolgreich (HTTP 200)
✓ Session Check OK - authentifiziert (HTTP 200)
✓ Profile abgerufen (HTTP 200)
✓ Commerce Token abgerufen (HTTP 200)
✓ Logout erfolgreich (HTTP 200)
✓ Session Check OK - nicht authentifiziert (HTTP 200)
```

### Fehlgeschlagener Login

```
✓ Health Check OK (HTTP 200)
✓ Session Check OK - nicht authentifiziert (HTTP 200)
✗ Login fehlgeschlagen - JWT ungültig (HTTP 401)
```

**Mögliche Ursachen:**

- JWT-Signatur ist ungültig

- JWT ist abgelaufen (`exp` Claim)

- Falscher Issuer (`iss` Claim)

- Falsche Audience (`aud` Claim)

- JWKS-Validierung fehlgeschlagen

---

## 🛠️ Troubleshooting

### Problem: "JWT validation failed: invalid signature"

**Lösung:**

1. Prüfe JWT mit jwt.io

1. Prüfe Backend-Konfiguration (`.env`)

1. Prüfe Backend-Logs: `pm2 logs lenzingpro-backend | grep "JWT validation"`

### Problem: "Token exchange failed"

**Ursachen:**

- Commerce-Cloud-Credentials falsch

- JWT-Bearer Grant nicht aktiviert

- Network-Fehler

**Lösung:**

1. Prüfe Commerce-Credentials in `.env`

1. Prüfe Backend-Logs: `pm2 logs lenzingpro-backend | grep "token exchange"`

### Problem: "No JWT session found"

**Ursachen:**

- Cookie wurde nicht gesetzt

- Cookie ist abgelaufen

- Cookie wird nicht gesendet

**Lösung:**

1. Prüfe Cookie-Datei: `cat ${COOKIE_FILE}`

1. Verwende `-v` Flag bei curl für verbose output

1. Prüfe ob `-b ${COOKIE_FILE}` verwendet wird

---

## ✅ Zusammenfassung

**Automatisches Testing:**

```bash
export JWT_TOKEN="YOUR_REAL_JWT"
bash jwt-auth-test-commands.sh
```

**Manuelles Testing:**

- Kopiere die curl-Befehle aus diesem Dokument

- Ersetze `${JWT_TOKEN}` mit deinem echten JWT

- Führe die Befehle nacheinander aus

**Debugging:**

- Verwende `-v` Flag für verbose output

- Prüfe Backend-Logs mit `pm2 logs`

- Inspiziere Cookie-Datei

**Alles bereit zum Testen!** 🚀

