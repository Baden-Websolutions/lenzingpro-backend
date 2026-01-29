# JWT-Flow Erklärung - Bestehender vs. Neuer Flow

## 🤔 Deine Frage

> "was ist genau gemeint? wir bekommen underen token_id und signatur, machen crypto werte nach vorgabe und verifyn den token, richtig?"

**Kurze Antwort:** Nein, das sind **zwei verschiedene Flows**!

---

## 📊 Die zwei Flows im Vergleich

### Flow 1: Bestehender CDC-OIDC-Flow (auth-flow.ts)

**Was ihr AKTUELL macht:**

```
1. User → Frontend: Login-Formular (Email/Password)
2. Frontend → Backend: POST /auth/login { email, password }
3. Backend → CDC Gigya: accounts.login (REST API)
4. CDC → Backend: { UID, UIDSignature, signatureTimestamp, sessionInfo }
5. Backend → CDC: accounts.getJWT (mit login_token)
6. CDC → Backend: { id_token: "JWT..." }
7. Backend → Commerce: OAuth Token Exchange (JWT → Access Token)
8. Backend → Frontend: Session Cookie + User Info
```

**Das ist der Flow in `src/services/cdc-auth.ts`:**

```typescript
// Methode: getJWTFromSession
async getJWTFromSession(sessionToken: string): Promise<string> {
  const params = new URLSearchParams({
    apiKey: this.env.CDC_API_KEY,
    login_token: sessionToken,  // ← Das ist NICHT der JWT!
  });

  const resp = await fetch("https://accounts.eu1.gigya.com/accounts.getJWT", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const json = await resp.json();
  return json.id_token;  // ← DAS ist der JWT!
}
```

**Was du bekommst:**
- `UID`: User-ID (z.B. "abc123...")
- `UIDSignature`: HMAC-Signatur über UID + Timestamp
- `signatureTimestamp`: Unix-Timestamp
- `sessionInfo.cookieValue`: Session-Token

**Was du NICHT direkt bekommst:**
- Keinen JWT! Der JWT wird erst in Schritt 5 mit `accounts.getJWT` geholt.

---

### Flow 2: Neuer JWT-Bearer-Flow (jwt-auth-flow.ts)

**Was der NEUE Flow macht:**

```
1. User → Frontend: Hat bereits JWT (z.B. von anderem System/Lenzing-Backend)
2. Frontend → Backend: POST /jwt-auth/login { jwt: "eyJhbGci..." }
3. Backend: JWT validieren (JWKS, Signatur, Issuer, Audience)
4. Backend → Commerce: OAuth Token Exchange (JWT → Access Token)
5. Backend → Frontend: Session Cookie + User Info
```

**Das ist der Flow in `src/routes/jwt-auth-flow.ts`:**

```typescript
// Login-Endpoint
app.post("/jwt-auth/login", async (request, reply) => {
  const { jwt } = request.body;  // ← JWT kommt direkt vom Frontend!
  
  // JWT validieren
  const validation = await jwtValidator.validateToken(jwt);
  
  if (!validation.valid) {
    return reply.status(401).send({ error: "invalid_jwt" });
  }
  
  // Token-Exchange: JWT → Commerce Access Token
  const exchangeResult = await tokenExchangeService.exchangeJWT(jwt);
  
  // Session erstellen
  // ...
});
```

**Was du brauchst:**
- Einen **fertigen JWT** (z.B. `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0In0.signature`)

---

## 🔍 Der Unterschied im Detail

### Bestehender Flow: Backend holt JWT

```javascript
// Frontend sendet
POST /auth/login
{
  "email": "user@example.com",
  "password": "secret123"
}

// Backend macht intern:
// 1. CDC Login → bekommt UID + Signatur
// 2. accounts.getJWT → bekommt JWT
// 3. Token Exchange → bekommt Commerce Token
// 4. Antwortet mit Session
```

**Frontend kennt den JWT NICHT!** Der JWT wird nur intern im Backend verwendet.

---

### Neuer Flow: Frontend sendet JWT

```javascript
// Frontend sendet
POST /jwt-auth/login
{
  "jwt": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2ZpZG0uZXUxLmdpZ3lhLmNvbS9vaWRjL29wL3YxLjAvNF9YUW5qam1MYzE2b1M3dnFBNkR2SUFnIiwic3ViIjoidGVzdC11c2VyIiwiYXVkIjoiQUJiZDY3MktveTNVIiwiZXhwIjo5OTk5OTk5OTk5fQ.SIGNATURE"
}

// Backend macht:
// 1. JWT validieren (Signatur, Issuer, Audience)
// 2. Token Exchange → bekommt Commerce Token
// 3. Antwortet mit Session
```

**Frontend MUSS den JWT bereits haben!** Der JWT kommt von einem anderen System (z.B. Lenzing-Backend).

---

## 🎯 Warum "echten JWT verwenden"?

### Problem mit Platzhalter-JWT

Der Platzhalter im Test-Script:

```bash
JWT_TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2ZpZG0uZXUxLmdpZ3lhLmNvbS9vaWRjL29wL3YxLjAvNF9YUW5qam1MYzE2b1M3dnFBNkR2SUFnIiwic3ViIjoidGVzdC11c2VyIiwiYXVkIjoiQUJiZDY3MktveTNVIiwiZXhwIjo5OTk5OTk5OTk5fQ.SIGNATURE_PLACEHOLDER"
```

**Was passiert beim Testen:**

```
1. Frontend → Backend: POST /jwt-auth/login { jwt: "eyJ..." }
2. Backend: JWT validieren
   ├─ Header dekodieren: ✓ OK (RS256)
   ├─ Payload dekodieren: ✓ OK (iss, sub, aud, exp)
   ├─ JWKS Public Key holen: ✓ OK
   └─ Signatur prüfen: ✗ FEHLER! "SIGNATURE_PLACEHOLDER" ist keine gültige RS256-Signatur
3. Backend → Frontend: 401 Unauthorized { error: "invalid_jwt", message: "JWT validation failed: invalid signature" }
```

**Der Test schlägt fehl, weil:**
- Die Signatur `SIGNATURE_PLACEHOLDER` ist keine echte RS256-Signatur
- Der Backend kann die Signatur nicht mit dem Public Key verifizieren

---

## 🔐 JWT-Struktur erklärt

Ein JWT besteht aus 3 Teilen (getrennt durch `.`):

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9
.
eyJpc3MiOiJodHRwczovL2ZpZG0uZXUxLmdpZ3lhLmNvbS9vaWRjL29wL3YxLjAvNF9YUW5qam1MYzE2b1M3dnFBNkR2SUFnIiwic3ViIjoidGVzdC11c2VyIiwiYXVkIjoiQUJiZDY3MktveTNVIiwiZXhwIjo5OTk5OTk5OTk5fQ
.
SIGNATURE_PLACEHOLDER
```

### Teil 1: Header (Base64URL-encoded)

```json
{
  "alg": "RS256",
  "typ": "JWT"
}
```

### Teil 2: Payload (Base64URL-encoded)

```json
{
  "iss": "https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg",
  "sub": "test-user",
  "aud": "ABbd672Koy3U",
  "exp": 9999999999
}
```

### Teil 3: Signature (RS256)

```
SIGNATURE_PLACEHOLDER  ← Das ist KEINE gültige Signatur!
```

**Echte Signatur wäre:**

```
RSA_SHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  privateKey
)
```

**Das ergibt z.B.:**

```
dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk...
```

---

## 🛠️ Wie bekomme ich einen echten JWT?

### Option 1: Von eurem bestehenden CDC-Flow

**Schritt 1:** Login über bestehenden Flow

```bash
# 1. Login
curl -X POST https://api.mtna-lp.dev/occ/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}' \
  -c cookies.txt

# Response enthält Session-Cookie
```

**Schritt 2:** JWT aus Session holen (wenn implementiert)

```bash
# 2. JWT abrufen (hypothetischer Endpoint)
curl https://api.mtna-lp.dev/occ/auth/jwt \
  -b cookies.txt
```

**Problem:** Ihr habt vermutlich keinen Endpoint, der den JWT zurückgibt!

---

### Option 2: Direkt von CDC Gigya

**Schritt 1:** CDC Login (REST API)

```bash
curl -X POST "https://accounts.eu1.gigya.com/accounts.login" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "loginID=test@example.com" \
  -d "password=secret123"
```

**Response:**

```json
{
  "errorCode": 0,
  "sessionInfo": {
    "login_token": "st2.s.AcbDef123..."
  }
}
```

**Schritt 2:** JWT holen

```bash
curl -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "login_token=st2.s.AcbDef123..."
```

**Response:**

```json
{
  "errorCode": 0,
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJTMjU2In0.eyJpc3MiOiJodHRwczovL2ZpZG0uZXUxLmdpZ3lhLmNvbS9vaWRjL29wL3YxLjAvNF9YUW5qam1MYzE2b1M3dnFBNkR2SUFnIiwic3ViIjoiYWJjMTIzIiwiYXVkIjoiQUJiZDY3MktveTNVIiwiZXhwIjoxNzM4MjIwMDAwLCJpYXQiOjE3MzgxMzQwMDAsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IFVzZXIifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk..."
}
```

**DAS ist ein echter JWT!** ✅

---

### Option 3: OIDC Authorization Code Flow

**Schritt 1:** Authorization URL öffnen

```
https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg/authorize?client_id=ABbd672Koy3U&response_type=code&scope=openid%20profile%20email&redirect_uri=http://localhost/callback
```

**Schritt 2:** Nach Login bekommst du einen Code

```
http://localhost/callback?code=abc123def456
```

**Schritt 3:** Code gegen Token tauschen

```bash
curl -X POST "https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg/token" \
  -d "grant_type=authorization_code" \
  -d "code=abc123def456" \
  -d "client_id=ABbd672Koy3U" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=http://localhost/callback"
```

**Response:**

```json
{
  "access_token": "...",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",  ← Das ist der JWT!
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

## 📝 Zusammenfassung

### Bestehender Flow (auth-flow.ts)

```
Frontend sendet: { email, password }
Backend macht:
  1. CDC Login → { UID, UIDSignature, sessionInfo }
  2. accounts.getJWT → { id_token: "JWT..." }
  3. Token Exchange → Commerce Access Token
Frontend bekommt: Session Cookie (JWT ist intern)
```

**Frontend kennt den JWT NICHT!**

---

### Neuer Flow (jwt-auth-flow.ts)

```
Frontend sendet: { jwt: "eyJhbGci..." }
Backend macht:
  1. JWT validieren (Signatur prüfen!)
  2. Token Exchange → Commerce Access Token
Frontend bekommt: Session Cookie
```

**Frontend MUSS den JWT bereits haben!**

---

### Warum "echten JWT verwenden"?

**Platzhalter-JWT:**
```
eyJ...payload...SIGNATURE_PLACEHOLDER
                 ^^^^^^^^^^^^^^^^^^^^
                 Keine gültige RS256-Signatur!
```

**Backend prüft:**
1. ✓ Header dekodieren
2. ✓ Payload dekodieren
3. ✓ JWKS Public Key holen
4. ✗ **Signatur verifizieren** → FEHLER!

**Echter JWT:**
```
eyJ...payload...dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                Gültige RS256-Signatur mit Private Key erstellt!
```

**Backend prüft:**
1. ✓ Header dekodieren
2. ✓ Payload dekodieren
3. ✓ JWKS Public Key holen
4. ✓ **Signatur verifizieren** → OK!

---

## 🚀 Wie teste ich jetzt?

### Schritt 1: Echten JWT holen

```bash
# Login bei CDC
curl -X POST "https://accounts.eu1.gigya.com/accounts.login" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "loginID=test@example.com" \
  -d "password=secret123" \
  > login_response.json

# Session Token extrahieren
LOGIN_TOKEN=$(jq -r '.sessionInfo.login_token' login_response.json)

# JWT holen
curl -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "login_token=${LOGIN_TOKEN}" \
  > jwt_response.json

# JWT extrahieren
JWT_TOKEN=$(jq -r '.id_token' jwt_response.json)

echo "JWT Token: ${JWT_TOKEN}"
```

### Schritt 2: JWT-Flow testen

```bash
# Jetzt mit echtem JWT testen!
export JWT_TOKEN="${JWT_TOKEN}"

# Test-Script ausführen
bash jwt-auth-test-commands.sh
```

---

## 🎯 Fazit

**Deine ursprüngliche Annahme:**
> "wir bekommen underen token_id und signatur, machen crypto werte nach vorgabe und verifyn den token"

**Richtig für:** Bestehenden CDC-Flow (auth-flow.ts)
- Ihr bekommt `UID` + `UIDSignature` + `signatureTimestamp`
- Ihr verifiziert die HMAC-Signatur
- Ihr holt dann den JWT mit `accounts.getJWT`

**Falsch für:** Neuen JWT-Flow (jwt-auth-flow.ts)
- Ihr bekommt einen **fertigen JWT**
- Ihr verifiziert die **RS256-Signatur** mit JWKS Public Key
- Kein `accounts.getJWT` nötig, JWT kommt direkt vom Frontend

**Deshalb der Hinweis "echten JWT verwenden":**
- Der Platzhalter-JWT hat keine gültige Signatur
- Die Signatur-Verifikation schlägt fehl
- Der Test funktioniert nicht

**Um zu testen, brauchst du:**
1. Einen echten JWT von CDC (mit `accounts.getJWT`)
2. Oder einen JWT von eurem Lenzing-Backend
3. Oder einen JWT über OIDC Authorization Code Flow

**Dann funktioniert der Test!** ✅
