# CDC Keys Erklärung - Secret Key vs. JWT Private Key

## 🤔 Deine Frage

> "meinst du den secret key der zu cdc_client_id gehört den du bei jetzt abfragst?"

**Antwort:** Nein! Das sind **zwei völlig verschiedene Keys** mit unterschiedlichen Zwecken.

---

## 🔑 Die drei verschiedenen Keys

### 1. CDC Secret Key (Application Secret)

**Was ist das?**
- Ein **HMAC Secret** für API-Authentifizierung
- Gehört zu deiner CDC Application (API Key)
- Wird für **REST API Calls** verwendet

**Wo wird er verwendet?**
- `accounts.login` - HMAC-Signatur für API-Authentifizierung
- `accounts.getJWT` - HMAC-Signatur für API-Authentifizierung
- Andere CDC REST API Calls

**Format:**
```
CDC_SECRET_KEY="abc123def456xyz789"  // Hex-String, ~32-64 Zeichen
```

**Beispiel in eurem Code (`src/services/gigya-sdk.ts`):**

```typescript
export class GigyaSDK {
  constructor(
    private apiKey: string,
    private secretKey: string,  // ← Das ist der CDC Secret Key!
    private datacenter: string
  ) {}

  // HMAC-Signatur für API-Authentifizierung
  private signRequest(params: Record<string, string>): string {
    const baseString = this.createBaseString(params);
    return crypto
      .createHmac('sha1', Buffer.from(this.secretKey, 'base64'))
      .update(baseString)
      .digest('base64');
  }
}
```

**Zweck:**
- Authentifizierung deiner **Application** gegenüber CDC
- Beweist, dass der API-Call von deiner App kommt
- **Nicht** für JWT-Signatur!

---

### 2. JWT Private Key (RSA Private Key)

**Was ist das?**
- Ein **RSA Private Key** für JWT-Signierung
- Gehört zu CDC's OIDC Provider
- Wird von **CDC** verwendet, um JWTs zu signieren

**Wo wird er verwendet?**
- CDC signiert JWTs mit diesem Key
- **Du hast KEINEN Zugriff darauf!**
- Nur CDC hat diesen Key

**Format:**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----
```

**Beispiel:**

```typescript
// Das macht CDC intern (du siehst das nie!)
function signJWT(header, payload, privateKey) {
  const data = base64url(header) + '.' + base64url(payload);
  const signature = crypto.sign('RSA-SHA256', data, privateKey);
  return data + '.' + base64url(signature);
}
```

**Zweck:**
- CDC signiert JWTs mit diesem Key
- Beweist, dass der JWT von CDC kommt
- **Du kannst keine JWTs selbst signieren!**

---

### 3. JWT Public Key (RSA Public Key)

**Was ist das?**
- Ein **RSA Public Key** für JWT-Verifikation
- Gehört zu CDC's OIDC Provider
- Wird von **deinem Backend** verwendet, um JWTs zu verifizieren

**Wo wird er verwendet?**
- Dein Backend holt den Public Key von JWKS-Endpoint
- Dein Backend verifiziert JWT-Signaturen damit

**Format (JWKS):**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "kid": "RS256",
      "n": "xGOr-H7A...",  // RSA Modulus
      "e": "AQAB"         // RSA Exponent
    }
  ]
}
```

**Beispiel in eurem Code (`src/middleware/jwt-validator.ts`):**

```typescript
export class JWTValidator {
  private jwksUri: string;

  async getPublicKey(kid: string): Promise<string> {
    // JWKS von CDC holen
    const response = await fetch(this.jwksUri);
    const jwks = await response.json();
    
    // Public Key für kid finden
    const key = jwks.keys.find(k => k.kid === kid);
    
    // Public Key im PEM-Format konvertieren
    return this.jwkToPem(key);
  }

  async validateToken(token: string): Promise<JWTValidationResult> {
    const parts = token.split('.');
    const header = JSON.parse(base64Decode(parts[0]));
    
    // Public Key holen
    const publicKey = await this.getPublicKey(header.kid);
    
    // Signatur verifizieren
    const isValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(parts[0] + '.' + parts[1]),
      publicKey,  // ← Das ist der JWT Public Key!
      Buffer.from(parts[2], 'base64url')
    );
    
    return { valid: isValid };
  }
}
```

**Zweck:**
- Dein Backend verifiziert JWT-Signaturen
- Beweist, dass der JWT wirklich von CDC kommt
- **Öffentlich verfügbar** über JWKS-Endpoint

---

## 🔍 Der Unterschied im Detail

### CDC Secret Key vs. JWT Private Key

| Aspekt | CDC Secret Key | JWT Private Key |
|--------|----------------|-----------------|
| **Typ** | HMAC Secret (symmetrisch) | RSA Private Key (asymmetrisch) |
| **Format** | Hex-String (~32-64 Zeichen) | PEM-Format (2048+ Bit) |
| **Zweck** | API-Authentifizierung | JWT-Signierung |
| **Verwendet von** | Deiner Application | CDC (intern) |
| **Zugriff** | Du hast ihn (in .env) | Nur CDC hat ihn |
| **Verwendet für** | REST API Calls | JWT-Erstellung |
| **Algorithmus** | HMAC-SHA1 | RSA-SHA256 |

---

## 📊 Wie die Keys zusammenspielen

### Szenario 1: CDC REST API Call (accounts.login)

```
1. Deine App → CDC: POST accounts.login
   Headers:
     - apiKey: "4_XQnjjmLc16oS7vqA6DvIAg"
     - signature: HMAC-SHA1(params, CDC_SECRET_KEY)  ← CDC Secret Key!
   
2. CDC prüft:
   - Ist apiKey gültig?
   - Ist signature korrekt? (mit CDC Secret Key verifizieren)
   
3. CDC → Deine App: { UID, UIDSignature, sessionInfo }
```

**Verwendet:** CDC Secret Key (HMAC)

---

### Szenario 2: JWT holen (accounts.getJWT)

```
1. Deine App → CDC: POST accounts.getJWT
   Headers:
     - apiKey: "4_XQnjjmLc16oS7vqA6DvIAg"
     - signature: HMAC-SHA1(params, CDC_SECRET_KEY)  ← CDC Secret Key!
   Body:
     - login_token: "st2.s.AcbDef123..."
   
2. CDC prüft:
   - Ist signature korrekt? (mit CDC Secret Key)
   - Ist login_token gültig?
   
3. CDC erstellt JWT:
   - Header: { "alg": "RS256", "typ": "JWT" }
   - Payload: { "iss": "...", "sub": "...", "aud": "..." }
   - Signature: RSA-SHA256(header + payload, JWT_PRIVATE_KEY)  ← JWT Private Key!
   
4. CDC → Deine App: { id_token: "eyJhbGci..." }
```

**Verwendet:** 
- CDC Secret Key (für API-Authentifizierung)
- JWT Private Key (für JWT-Signierung, nur CDC hat ihn!)

---

### Szenario 3: JWT verifizieren (dein Backend)

```
1. Frontend → Dein Backend: POST /jwt-auth/login
   Body: { jwt: "eyJhbGci..." }
   
2. Dein Backend:
   - JWT dekodieren
   - Header lesen: { "alg": "RS256", "kid": "RS256" }
   
3. Dein Backend → CDC JWKS: GET /keys
   
4. CDC → Dein Backend: { "keys": [{ "kid": "RS256", "n": "...", "e": "..." }] }
   
5. Dein Backend:
   - Public Key aus JWKS extrahieren  ← JWT Public Key!
   - Signatur verifizieren: crypto.verify(data, JWT_PUBLIC_KEY, signature)
   
6. Dein Backend → Frontend: { success: true }
```

**Verwendet:** JWT Public Key (von JWKS)

---

## 🎯 Warum du KEINEN JWT selbst signieren kannst

### Was du denkst

> "Ich habe den CDC Secret Key, also kann ich JWTs signieren!"

**Falsch!** Hier ist warum:

### CDC Secret Key (HMAC)

```javascript
// Das kannst du machen (hast du bereits)
const signature = crypto
  .createHmac('sha1', CDC_SECRET_KEY)
  .update(baseString)
  .digest('base64');

// Verwendet für: REST API Calls
```

**Algorithmus:** HMAC-SHA1 (symmetrisch)  
**Zweck:** API-Authentifizierung  
**Format:** Base64-String

---

### JWT Private Key (RSA)

```javascript
// Das kannst du NICHT machen (hast du nicht!)
const signature = crypto.sign(
  'RSA-SHA256',
  data,
  JWT_PRIVATE_KEY  // ← Du hast diesen Key NICHT!
);

// Verwendet für: JWT-Signierung
```

**Algorithmus:** RSA-SHA256 (asymmetrisch)  
**Zweck:** JWT-Signierung  
**Format:** PEM-Format (2048+ Bit RSA Key)

---

## 🔐 Asymmetrische Kryptographie erklärt

### HMAC (symmetrisch) - CDC Secret Key

```
Signieren:   HMAC-SHA1(data, SECRET_KEY) → signature
Verifizieren: HMAC-SHA1(data, SECRET_KEY) → signature (vergleichen)

Problem: Jeder mit SECRET_KEY kann signieren UND verifizieren!
```

**Verwendet für:** API-Authentifizierung (nur du und CDC haben den Key)

---

### RSA (asymmetrisch) - JWT Keys

```
Signieren:   RSA-Sign(data, PRIVATE_KEY) → signature
Verifizieren: RSA-Verify(data, PUBLIC_KEY, signature) → true/false

Vorteil: Nur CDC kann signieren (PRIVATE_KEY),
         aber jeder kann verifizieren (PUBLIC_KEY)!
```

**Verwendet für:** JWT-Signierung (CDC signiert, alle können verifizieren)

---

## 📝 Zusammenfassung

### CDC Secret Key

**Was ist es?**
- HMAC Secret für API-Authentifizierung
- Du hast ihn (in `.env`)

**Wofür?**
- `accounts.login` - API-Authentifizierung
- `accounts.getJWT` - API-Authentifizierung
- Andere CDC REST API Calls

**Format:**
```bash
CDC_SECRET_KEY="abc123def456xyz789"
```

**Code:**
```typescript
// HMAC-Signatur für API-Call
const signature = crypto
  .createHmac('sha1', CDC_SECRET_KEY)
  .update(baseString)
  .digest('base64');
```

---

### JWT Private Key

**Was ist es?**
- RSA Private Key für JWT-Signierung
- **Nur CDC hat ihn!**

**Wofür?**
- CDC signiert JWTs damit
- Du kannst ihn **nicht** verwenden

**Format:**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----
```

**Code (nur CDC macht das):**
```typescript
// JWT signieren (nur CDC!)
const signature = crypto.sign('RSA-SHA256', data, JWT_PRIVATE_KEY);
```

---

### JWT Public Key

**Was ist es?**
- RSA Public Key für JWT-Verifikation
- **Öffentlich verfügbar** (JWKS)

**Wofür?**
- Dein Backend verifiziert JWTs damit

**Format (JWKS):**
```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "RS256",
      "n": "xGOr-H7A...",
      "e": "AQAB"
    }
  ]
}
```

**Code:**
```typescript
// JWT verifizieren (dein Backend)
const publicKey = await getPublicKeyFromJWKS();
const isValid = crypto.verify('RSA-SHA256', data, publicKey, signature);
```

---

## 🎯 Fazit

### Deine Frage

> "meinst du den secret key der zu cdc_client_id gehört den du bei jetzt abfragst?"

**Antwort:** Nein!

**CDC Secret Key:**
- Für API-Authentifizierung (HMAC)
- Du hast ihn
- Verwendest du für `accounts.login`, `accounts.getJWT`

**JWT Private Key:**
- Für JWT-Signierung (RSA)
- **Nur CDC hat ihn!**
- Du kannst keine JWTs selbst signieren

**JWT Public Key:**
- Für JWT-Verifikation (RSA)
- Öffentlich verfügbar (JWKS)
- Dein Backend verwendet ihn zum Verifizieren

---

## 🚀 Was bedeutet das für dich?

### Du kannst:

✅ CDC REST API Calls machen (mit CDC Secret Key)  
✅ JWTs von CDC holen (mit `accounts.getJWT`)  
✅ JWTs verifizieren (mit JWT Public Key von JWKS)  

### Du kannst NICHT:

❌ JWTs selbst signieren (brauchst JWT Private Key, den nur CDC hat)  
❌ Gefälschte JWTs erstellen (Signatur-Verifikation schlägt fehl)  

---

## 💡 Deshalb brauchst du einen echten JWT!

**Platzhalter-JWT:**
```
eyJ...payload...SIGNATURE_PLACEHOLDER
```
- Signatur ist ungültig
- Dein Backend kann sie nicht verifizieren (mit JWT Public Key)
- Test schlägt fehl

**Echter JWT (von CDC):**
```
eyJ...payload...dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```
- Signatur ist gültig (von CDC mit JWT Private Key erstellt)
- Dein Backend kann sie verifizieren (mit JWT Public Key)
- Test funktioniert!

---

## 📊 Übersicht

| Key | Typ | Hast du? | Zweck | Algorithmus |
|-----|-----|----------|-------|-------------|
| **CDC Secret Key** | HMAC Secret | ✅ Ja | API-Authentifizierung | HMAC-SHA1 |
| **JWT Private Key** | RSA Private | ❌ Nein (nur CDC) | JWT-Signierung | RSA-SHA256 |
| **JWT Public Key** | RSA Public | ✅ Ja (JWKS) | JWT-Verifikation | RSA-SHA256 |

**Alles klar jetzt?** 🎯
