# Praktische Anleitung: Echten JWT für Tests holen

## 🎯 Ziel

Einen **echten, signierten JWT** von CDC Gigya holen, um den neuen JWT-Auth-Flow zu testen.

---

## 🚀 Methode 1: accounts.getJWT (Empfohlen)

### Schritt 1: CDC Login

```bash
curl -X POST "https://accounts.eu1.gigya.com/accounts.login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "loginID=YOUR_EMAIL@example.com" \
  -d "password=YOUR_PASSWORD" \
  > /tmp/cdc_login.json

cat /tmp/cdc_login.json | jq .
```

**Erwartete Response:**

```json
{
  "errorCode": 0,
  "statusCode": 200,
  "UID": "abc123def456",
  "UIDSignature": "xyz789...",
  "signatureTimestamp": "1738134000",
  "sessionInfo": {
    "cookieName": "glt_4_XQnjjmLc16oS7vqA6DvIAg",
    "cookieValue": "st2.s.AcbDef123...",
    "login_token": "st2.s.AcbDef123..."
  },
  "profile": {
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com"
  }
}
```

**Wichtig:** Speichere den `login_token` aus `sessionInfo`!

---

### Schritt 2: JWT holen

```bash
# Login Token extrahieren
LOGIN_TOKEN=$(cat /tmp/cdc_login.json | jq -r '.sessionInfo.login_token')

echo "Login Token: ${LOGIN_TOKEN}"

# JWT holen
curl -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "login_token=${LOGIN_TOKEN}" \
  > /tmp/cdc_jwt.json

cat /tmp/cdc_jwt.json | jq .
```

**Erwartete Response:**

```json
{
  "errorCode": 0,
  "statusCode": 200,
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJTMjU2In0.eyJpc3MiOiJodHRwczovL2ZpZG0uZXUxLmdpZ3lhLmNvbS9vaWRjL29wL3YxLjAvNF9YUW5qam1MYzE2b1M3dnFBNkR2SUFnIiwic3ViIjoiYWJjMTIzZGVmNDU2IiwiYXVkIjoiQUJiZDY3MktveTNVIiwiZXhwIjoxNzM4MjIwMDAwLCJpYXQiOjE3MzgxMzQwMDAsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IFVzZXIifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk..."
}
```

**DAS ist dein echter JWT!** ✅

---

### Schritt 3: JWT extrahieren und testen

```bash
# JWT extrahieren
JWT_TOKEN=$(cat /tmp/cdc_jwt.json | jq -r '.id_token')

echo "JWT Token: ${JWT_TOKEN}"

# JWT-Inhalt dekodieren (zur Verifikation)
echo "${JWT_TOKEN}" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .

# Jetzt mit echtem JWT testen!
export JWT_TOKEN="${JWT_TOKEN}"

# Test-Script ausführen
bash jwt-auth-test-commands.sh
```

---

## 🔄 Methode 2: One-Liner Script

```bash
#!/bin/bash

# Konfiguration
CDC_API_KEY="4_XQnjjmLc16oS7vqA6DvIAg"
CDC_EMAIL="YOUR_EMAIL@example.com"
CDC_PASSWORD="YOUR_PASSWORD"

echo "=== CDC Login ==="

# Login
LOGIN_RESPONSE=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.login" \
  -d "apiKey=${CDC_API_KEY}" \
  -d "loginID=${CDC_EMAIL}" \
  -d "password=${CDC_PASSWORD}")

echo "${LOGIN_RESPONSE}" | jq .

# Prüfe Fehler
ERROR_CODE=$(echo "${LOGIN_RESPONSE}" | jq -r '.errorCode')
if [ "${ERROR_CODE}" != "0" ]; then
    echo "Login failed!"
    exit 1
fi

# Login Token extrahieren
LOGIN_TOKEN=$(echo "${LOGIN_RESPONSE}" | jq -r '.sessionInfo.login_token')
echo ""
echo "Login Token: ${LOGIN_TOKEN}"
echo ""

echo "=== JWT holen ==="

# JWT holen
JWT_RESPONSE=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -d "apiKey=${CDC_API_KEY}" \
  -d "login_token=${LOGIN_TOKEN}")

echo "${JWT_RESPONSE}" | jq .

# Prüfe Fehler
ERROR_CODE=$(echo "${JWT_RESPONSE}" | jq -r '.errorCode')
if [ "${ERROR_CODE}" != "0" ]; then
    echo "JWT request failed!"
    exit 1
fi

# JWT extrahieren
JWT_TOKEN=$(echo "${JWT_RESPONSE}" | jq -r '.id_token')
echo ""
echo "=========================================="
echo "JWT Token:"
echo "${JWT_TOKEN}"
echo "=========================================="
echo ""

# JWT dekodieren
echo "JWT Payload:"
echo "${JWT_TOKEN}" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
echo ""

# Export für weitere Verwendung
export JWT_TOKEN="${JWT_TOKEN}"

echo "JWT Token wurde in \$JWT_TOKEN gespeichert"
echo ""
echo "Jetzt kannst du testen mit:"
echo "  bash jwt-auth-test-commands.sh"
```

**Speichern als `get-jwt.sh` und ausführen:**

```bash
chmod +x get-jwt.sh
./get-jwt.sh
```

---

## 🌐 Methode 3: OIDC Authorization Code Flow (Browser)

### Schritt 1: Authorization URL öffnen

Öffne diese URL im Browser:

```
https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg/authorize?client_id=ABbd672Koy3U&response_type=code&scope=openid%20profile%20email&redirect_uri=http://localhost:3000/callback&state=random123
```

### Schritt 2: Login durchführen

- Gib deine CDC-Credentials ein
- Nach Login wirst du zu `http://localhost:3000/callback?code=...` weitergeleitet

### Schritt 3: Code aus URL extrahieren

```
http://localhost:3000/callback?code=abc123def456&state=random123
                                    ^^^^^^^^^^^^
                                    Das ist der Authorization Code
```

### Schritt 4: Code gegen Token tauschen

```bash
AUTH_CODE="abc123def456"  # Aus URL

curl -X POST "https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=${AUTH_CODE}" \
  -d "client_id=ABbd672Koy3U" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=http://localhost:3000/callback" \
  | jq .
```

**Response:**

```json
{
  "access_token": "...",
  "id_token": "eyJhbGci...",  ← Das ist der JWT!
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

---

## 🔍 JWT verifizieren

### JWT dekodieren

```bash
# Header
echo "${JWT_TOKEN}" | cut -d'.' -f1 | base64 -d 2>/dev/null | jq .

# Payload
echo "${JWT_TOKEN}" | cut -d'.' -f2 | base64 -d 2>/dev/null | jq .
```

**Erwarteter Payload:**

```json
{
  "iss": "https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg",
  "sub": "abc123def456",
  "aud": "ABbd672Koy3U",
  "exp": 1738220000,
  "iat": 1738134000,
  "email": "test@example.com",
  "name": "Test User"
}
```

### JWT auf jwt.io prüfen

1. Gehe zu https://jwt.io
2. Füge deinen JWT ein
3. Prüfe:
   - ✓ Header: `{"alg":"RS256","typ":"JWT"}`
   - ✓ Payload: Issuer, Audience, Expiration
   - ✓ Signature: "Signature Verified" (wenn Public Key verfügbar)

---

## ✅ JWT testen

### Test 1: JWT-Auth-Flow testen

```bash
export JWT_TOKEN="eyJhbGci..."  # Dein echter JWT

# Test-Script ausführen
bash jwt-auth-test-commands.sh
```

### Test 2: Manueller Login-Test

```bash
curl -X POST "https://api.mtna-lp.dev/occ/jwt-auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"jwt\":\"${JWT_TOKEN}\"}" \
  -c /tmp/cookies.txt \
  -v
```

**Erwartete Response (HTTP 200):**

```json
{
  "success": true,
  "sessionId": "abc123...",
  "user": {
    "userId": "abc123def456",
    "email": "test@example.com",
    "name": "Test User"
  }
}
```

---

## ⚠️ Troubleshooting

### Problem: "Login failed" (errorCode != 0)

**Ursachen:**
- Falsche Credentials
- Account existiert nicht
- Account gesperrt

**Lösung:**
```bash
# Prüfe Error-Message
cat /tmp/cdc_login.json | jq -r '.errorMessage'
```

### Problem: "JWT request failed"

**Ursachen:**
- Login Token ungültig
- Login Token abgelaufen
- Falscher API Key

**Lösung:**
```bash
# Prüfe Login Token
echo "${LOGIN_TOKEN}"

# Prüfe Error-Message
cat /tmp/cdc_jwt.json | jq -r '.errorMessage'
```

### Problem: JWT ist abgelaufen

**Symptom:**
```json
{
  "error": "invalid_jwt",
  "message": "JWT validation failed: token expired"
}
```

**Lösung:**
- Hole einen neuen JWT (Schritt 1-2 wiederholen)
- JWTs sind typischerweise 1 Stunde gültig

### Problem: "Invalid signature"

**Symptom:**
```json
{
  "error": "invalid_jwt",
  "message": "JWT validation failed: invalid signature"
}
```

**Ursachen:**
- JWT wurde manuell bearbeitet
- JWT stammt nicht von CDC
- JWKS Public Key stimmt nicht

**Lösung:**
- Verwende einen unveränderten JWT von CDC
- Prüfe Backend-Konfiguration (`JWT_JWKS_URI`)

---

## 📊 Zusammenfassung

### Schnellste Methode: accounts.getJWT

```bash
# 1. Login
LOGIN_TOKEN=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.login" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "loginID=YOUR_EMAIL" \
  -d "password=YOUR_PASSWORD" \
  | jq -r '.sessionInfo.login_token')

# 2. JWT holen
JWT_TOKEN=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "login_token=${LOGIN_TOKEN}" \
  | jq -r '.id_token')

# 3. Testen
export JWT_TOKEN="${JWT_TOKEN}"
bash jwt-auth-test-commands.sh
```

**Das war's!** ✅

---

## 🎯 Nächste Schritte

1. **JWT holen** mit einer der Methoden oben
2. **JWT exportieren:** `export JWT_TOKEN="eyJhbGci..."`
3. **Testen:** `bash jwt-auth-test-commands.sh`
4. **Logs prüfen:** `pm2 logs lenzingpro-backend | grep -i jwt`

**Viel Erfolg beim Testen!** 🚀
