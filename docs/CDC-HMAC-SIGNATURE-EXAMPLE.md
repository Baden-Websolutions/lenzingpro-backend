# CDC accounts.getJWT - Vollständiges Beispiel mit HMAC-Signatur

## 🎯 Vollständig ausgefülltes Beispiel

### Schritt 1: Login und Login-Token holen

```bash
curl -X POST "https://accounts.eu1.gigya.com/accounts.login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "loginID=test@example.com" \
  -d "password=MySecretPassword123"
```

**Response:**
```json
{
  "errorCode": 0,
  "statusCode": 200,
  "UID": "abc123def456xyz789",
  "sessionInfo": {
    "login_token": "st2.s.AcbDef123GhiJkl456MnoPqr789"
  }
}
```

**Login Token:** `st2.s.AcbDef123GhiJkl456MnoPqr789`

---

### Schritt 2: HMAC-Signatur berechnen

#### 2.1 Parameter vorbereiten

```bash
# Gegeben
API_KEY="4_XQnjjmLc16oS7vqA6DvIAg"
LOGIN_TOKEN="st2.s.AcbDef123GhiJkl456MnoPqr789"
SECRET_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"  # Dein CDC Secret Key

# Generieren
TIMESTAMP="1738134000"  # Unix-Timestamp (date +%s)
NONCE="abc123def456789xyz"  # Zufälliger String (md5sum)
```

#### 2.2 Base String erstellen

**Format nach Gigya-Spezifikation:**
```
httpMethod + "&" + urlEncode(url) + "&" + urlEncode(sortedParams)
```

**Konkret:**

```bash
HTTP_METHOD="POST"
URL="https://accounts.eu1.gigya.com/accounts.getJWT"

# Parameter alphabetisch sortieren
PARAMS="apiKey=4_XQnjjmLc16oS7vqA6DvIAg&login_token=st2.s.AcbDef123GhiJkl456MnoPqr789&nonce=abc123def456789xyz&timestamp=1738134000"

# URL-Encoding
URL_ENCODED="https%3A%2F%2Faccounts.eu1.gigya.com%2Faccounts.getJWT"
PARAMS_ENCODED="apiKey%3D4_XQnjjmLc16oS7vqA6DvIAg%26login_token%3Dst2.s.AcbDef123GhiJkl456MnoPqr789%26nonce%3Dabc123def456789xyz%26timestamp%3D1738134000"

# Base String
BASE_STRING="POST&${URL_ENCODED}&${PARAMS_ENCODED}"
```

**Ergebnis:**
```
POST&https%3A%2F%2Faccounts.eu1.gigya.com%2Faccounts.getJWT&apiKey%3D4_XQnjjmLc16oS7vqA6DvIAg%26login_token%3Dst2.s.AcbDef123GhiJkl456MnoPqr789%26nonce%3Dabc123def456789xyz%26timestamp%3D1738134000
```

#### 2.3 HMAC-SHA1-Signatur berechnen

```bash
# HMAC-SHA1 mit Secret Key
SIGNATURE=$(echo -n "${BASE_STRING}" | openssl dgst -sha1 -hmac "${SECRET_KEY}" -binary | base64)
```

**Beispiel-Signatur:**
```
xYz789AbC123DeF456GhI789JkL012MnO=
```

---

### Schritt 3: accounts.getJWT mit Signatur aufrufen

#### Vollständiger curl-Befehl

```bash
curl -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "login_token=st2.s.AcbDef123GhiJkl456MnoPqr789" \
  -d "nonce=abc123def456789xyz" \
  -d "timestamp=1738134000" \
  -d "sig=xYz789AbC123DeF456GhI789JkL012MnO="
```

**Response:**
```json
{
  "errorCode": 0,
  "statusCode": 200,
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJTMjU2In0.eyJpc3MiOiJodHRwczovL2ZpZG0uZXUxLmdpZ3lhLmNvbS9vaWRjL29wL3YxLjAvNF9YUW5qam1MYzE2b1M3dnFBNkR2SUFnIiwic3ViIjoiYWJjMTIzZGVmNDU2eHl6Nzg5IiwiYXVkIjoiQUJiZDY3MktveTNVIiwiZXhwIjoxNzM4MjIwMDAwLCJpYXQiOjE3MzgxMzQwMDAsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IFVzZXIifQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk..."
}
```

---

## 🔍 Detaillierte Erklärung

### Parameter-Übersicht

| Parameter | Wert | Beschreibung |
|-----------|------|--------------|
| `apiKey` | `4_XQnjjmLc16oS7vqA6DvIAg` | Deine CDC API Key |
| `login_token` | `st2.s.AcbDef123...` | Von `accounts.login` |
| `nonce` | `abc123def456789xyz` | Zufälliger String (Replay-Schutz) |
| `timestamp` | `1738134000` | Unix-Timestamp (Replay-Schutz) |
| `sig` | `xYz789AbC123...` | HMAC-SHA1-Signatur |

---

### HMAC-Signatur-Berechnung Schritt-für-Schritt

#### Schritt 1: Parameter sortieren

**Alphabetisch sortieren:**
```
apiKey=4_XQnjjmLc16oS7vqA6DvIAg
login_token=st2.s.AcbDef123GhiJkl456MnoPqr789
nonce=abc123def456789xyz
timestamp=1738134000
```

**Als Query-String:**
```
apiKey=4_XQnjjmLc16oS7vqA6DvIAg&login_token=st2.s.AcbDef123GhiJkl456MnoPqr789&nonce=abc123def456789xyz&timestamp=1738134000
```

#### Schritt 2: URL-Encoding

**URL:**
```
https://accounts.eu1.gigya.com/accounts.getJWT
→
https%3A%2F%2Faccounts.eu1.gigya.com%2Faccounts.getJWT
```

**Parameter:**
```
apiKey=4_XQnjjmLc16oS7vqA6DvIAg&login_token=st2.s.AcbDef123GhiJkl456MnoPqr789&nonce=abc123def456789xyz&timestamp=1738134000
→
apiKey%3D4_XQnjjmLc16oS7vqA6DvIAg%26login_token%3Dst2.s.AcbDef123GhiJkl456MnoPqr789%26nonce%3Dabc123def456789xyz%26timestamp%3D1738134000
```

#### Schritt 3: Base String erstellen

```
POST&https%3A%2F%2Faccounts.eu1.gigya.com%2Faccounts.getJWT&apiKey%3D4_XQnjjmLc16oS7vqA6DvIAg%26login_token%3Dst2.s.AcbDef123GhiJkl456MnoPqr789%26nonce%3Dabc123def456789xyz%26timestamp%3D1738134000
```

#### Schritt 4: HMAC-SHA1 berechnen

**Mit openssl:**
```bash
echo -n "${BASE_STRING}" | openssl dgst -sha1 -hmac "${SECRET_KEY}" -binary | base64
```

**Mit Node.js:**
```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha1', SECRET_KEY)
  .update(BASE_STRING)
  .digest('base64');
```

**Mit Python:**
```python
import hmac
import hashlib
import base64

signature = base64.b64encode(
    hmac.new(
        SECRET_KEY.encode(),
        BASE_STRING.encode(),
        hashlib.sha1
    ).digest()
).decode()
```

**Ergebnis:**
```
xYz789AbC123DeF456GhI789JkL012MnO=
```

---

## 🚀 Praktisches Beispiel mit echten Werten

### Vollständiges Shell-Script

```bash
#!/bin/bash

# Konfiguration
CDC_API_KEY="4_XQnjjmLc16oS7vqA6DvIAg"
CDC_SECRET_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"  # ERSETZEN!
CDC_EMAIL="test@example.com"  # ERSETZEN!
CDC_PASSWORD="MyPassword123"  # ERSETZEN!

# Schritt 1: Login
echo "=== Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.login" \
  -d "apiKey=${CDC_API_KEY}" \
  -d "loginID=${CDC_EMAIL}" \
  -d "password=${CDC_PASSWORD}")

LOGIN_TOKEN=$(echo "${LOGIN_RESPONSE}" | jq -r '.sessionInfo.login_token')
echo "Login Token: ${LOGIN_TOKEN}"
echo ""

# Schritt 2: HMAC-Signatur berechnen
echo "=== HMAC-Signatur berechnen ==="
TIMESTAMP=$(date +%s)
NONCE=$(date +%s%N | md5sum | cut -c1-32)

echo "Timestamp: ${TIMESTAMP}"
echo "Nonce: ${NONCE}"

# Base String
HTTP_METHOD="POST"
URL="https://accounts.eu1.gigya.com/accounts.getJWT"
PARAMS="apiKey=${CDC_API_KEY}&login_token=${LOGIN_TOKEN}&nonce=${NONCE}&timestamp=${TIMESTAMP}"

BASE_STRING="${HTTP_METHOD}&$(echo -n ${URL} | jq -sRr @uri)&$(echo -n ${PARAMS} | jq -sRr @uri)"

echo "Base String: ${BASE_STRING}"

# HMAC-SHA1-Signatur
SIGNATURE=$(echo -n "${BASE_STRING}" | openssl dgst -sha1 -hmac "${CDC_SECRET_KEY}" -binary | base64)

echo "Signature: ${SIGNATURE}"
echo ""

# Schritt 3: accounts.getJWT aufrufen
echo "=== accounts.getJWT aufrufen ==="
JWT_RESPONSE=$(curl -s -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -d "apiKey=${CDC_API_KEY}" \
  -d "login_token=${LOGIN_TOKEN}" \
  -d "nonce=${NONCE}" \
  -d "timestamp=${TIMESTAMP}" \
  -d "sig=${SIGNATURE}")

echo "${JWT_RESPONSE}" | jq .

# JWT extrahieren
JWT_TOKEN=$(echo "${JWT_RESPONSE}" | jq -r '.id_token')
echo ""
echo "JWT Token: ${JWT_TOKEN}"
```

---

## 📝 Zusammenfassung

### Was du brauchst

1. **CDC API Key:** `4_XQnjjmLc16oS7vqA6DvIAg` (hast du)
2. **CDC Secret Key:** `a1b2c3d4e5f6...` (hast du in `.env`)
3. **Login Token:** Von `accounts.login` (musst du holen)
4. **Timestamp:** Unix-Timestamp (generieren)
5. **Nonce:** Zufälliger String (generieren)

### Was du tust

1. **Login:** `accounts.login` → bekommst `login_token`
2. **Base String:** `POST&URL&Params` (URL-encoded)
3. **Signatur:** `HMAC-SHA1(base_string, secret_key)` → Base64
4. **JWT holen:** `accounts.getJWT` mit Signatur → bekommst JWT

### Vollständiger curl-Befehl (Beispiel)

```bash
curl -X POST "https://accounts.eu1.gigya.com/accounts.getJWT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "apiKey=4_XQnjjmLc16oS7vqA6DvIAg" \
  -d "login_token=st2.s.AcbDef123GhiJkl456MnoPqr789" \
  -d "nonce=abc123def456789xyz" \
  -d "timestamp=1738134000" \
  -d "sig=xYz789AbC123DeF456GhI789JkL012MnO="
```

**Alle Werte sind ausgefüllt!** ✅

---

## 🛠️ Automatisches Script verwenden

**Einfacher Weg:**

```bash
# Credentials setzen
export CDC_SECRET_KEY="your_secret_key"
export CDC_EMAIL="your@email.com"
export CDC_PASSWORD="yourpassword"

# Script ausführen
bash cdc-getjwt-with-signature.sh
```

**Das Script macht alles automatisch:**
1. ✅ Login
2. ✅ HMAC-Signatur berechnen
3. ✅ accounts.getJWT aufrufen
4. ✅ JWT dekodieren und anzeigen

**Fertig!** 🚀
