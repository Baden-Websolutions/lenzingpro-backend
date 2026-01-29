# JWT Authentication Flow

Paralleler Authentifizierungs-Flow basierend auf **JWT-Bearer Token Exchange (RFC 7523)**, inspiriert vom [SAP AppGyver Auth-Flow Pattern](https://github.com/SAP-samples/appgyver-auth-flows).

## Übersicht

Dieser Flow ermöglicht die Authentifizierung mit einem JWT-Token vom Lenzing-Backend und tauscht diesen gegen einen SAP Commerce Cloud Access Token aus. Der Flow läuft **parallel** zum bestehenden CDC-OIDC-Flow und berührt **keine bestehenden Dateien**.

## Architektur

### Flow-Diagramm

```
┌─────────────┐
│  login.vue  │
│  (Frontend) │
└──────┬──────┘
       │ 1. POST /jwt-auth/login
       │    { jwt: "eyJ..." }
       ▼
┌─────────────────────────────────┐
│  JWT Validator Middleware       │
│  - Validiert JWT Signatur       │
│  - Prüft Issuer & Audience      │
│  - Extrahiert Claims             │
└──────┬──────────────────────────┘
       │ 2. Validiertes JWT
       ▼
┌─────────────────────────────────┐
│  JWT Token Exchange Service     │
│  - Cache-Check                   │
│  - JWT → Commerce Token Exchange │
│  - Token Caching                 │
└──────┬──────────────────────────┘
       │ 3. Commerce Access Token
       ▼
┌─────────────────────────────────┐
│  Session Store                   │
│  - Session erstellen             │
│  - Cookie setzen                 │
└──────┬──────────────────────────┘
       │ 4. Session Response
       ▼
┌─────────────┐
│  login.vue  │
│  ✓ Logged in│
└─────────────┘
```

## Neue Dateien

Alle neuen Dateien sind **eigenständig** und berühren keine bestehenden Implementierungen:

### Core Components

| Datei | Beschreibung |
|-------|--------------|
| `src/types/jwt-auth.ts` | TypeScript-Typen für JWT-Auth |
| `src/middleware/jwt-validator.ts` | JWT-Validierung mit JWKS |
| `src/services/jwt-token-exchange.ts` | Token-Exchange-Service mit Caching |
| `src/routes/jwt-auth-flow.ts` | Auth-Flow-Endpoints |
| `src/routes/jwt-protected.ts` | Beispiel-Protected-Routes |
| `src/middleware/jwt-auth-middleware.ts` | Middleware für geschützte Routes |
| `src/server-jwt-integration.ts` | Integration Helper |

### Configuration

| Datei | Beschreibung |
|-------|--------------|
| `.env.jwt-auth.example` | Environment-Variablen-Template |

## API Endpoints

### Authentifizierung

#### POST `/jwt-auth/login`

Tauscht JWT-Token gegen Session aus.

**Request:**
```json
{
  "jwt": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "sessionId": "abc123...",
  "user": {
    "userId": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "uid": "gigya-uid-123"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "invalid_jwt",
  "message": "JWT validation failed: invalid signature"
}
```

**Cookie gesetzt:**
- `jwt_session_id`: Session-ID (HttpOnly, Secure, SameSite=Lax, 24h)

#### GET `/jwt-auth/session`

Prüft aktuelle Session und refresht automatisch bei Bedarf.

**Response (Authenticated):**
```json
{
  "authenticated": true,
  "user": {
    "userId": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "uid": "gigya-uid-123"
  }
}
```

**Response (Not Authenticated):**
```json
{
  "authenticated": false,
  "message": "No JWT session found"
}
```

#### POST `/jwt-auth/refresh`

Manuelles Refresh des Commerce-Tokens.

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully"
}
```

#### POST `/jwt-auth/logout`

Logout und Session-Löschung.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Geschützte Endpoints (Beispiele)

#### GET `/jwt-protected/profile`

Gibt User-Profil aus Session zurück.

**Requires:** `jwt_session_id` Cookie

**Response:**
```json
{
  "userId": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "uid": "gigya-uid-123",
  "sessionInfo": {
    "createdAt": "2024-01-01T12:00:00.000Z",
    "lastAccessed": "2024-01-01T12:30:00.000Z",
    "tokenExpiry": "2024-01-01T13:00:00.000Z"
  }
}
```

#### GET `/jwt-protected/commerce-token`

Gibt Commerce Cloud Access Token zurück.

**Requires:** `jwt_session_id` Cookie

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-01T13:00:00.000Z"
}
```

## Integration in server.ts

### Option 1: Convenience Function (Empfohlen)

Füge nach Zeile 73 in `src/server.ts` hinzu:

```typescript
import { registerJWTAuthentication } from "./server-jwt-integration.js";

// ... existing code ...

// Register JWT authentication flow (NEW)
await registerJWTAuthentication(app, env, sessionStore);

return { app, env };
```

### Option 2: Manuelle Integration

Füge nach Zeile 73 in `src/server.ts` hinzu:

```typescript
import { registerJWTAuthFlowRoutes } from "./routes/jwt-auth-flow.js";
import { registerJWTProtectedRoutes } from "./routes/jwt-protected.js";

// ... existing code ...

// Register JWT authentication flow routes (NEW)
await registerJWTAuthFlowRoutes(app, env, sessionStore);
await registerJWTProtectedRoutes(app, sessionStore);

return { app, env };
```

## Environment-Variablen

Füge folgende Variablen zu deiner `.env` hinzu:

```bash
# JWT Validation Configuration
JWT_JWKS_URI=https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg/v2.0/keys
JWT_ISSUER=https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg
JWT_AUDIENCE=ABbd672Koy3U
```

**Hinweis:** Die bestehenden `COMMERCE_*` Variablen werden wiederverwendet.

## Frontend-Integration (login.vue)

### Beispiel-Implementation

```vue
<script setup lang="ts">
import { ref } from 'vue';

const jwt = ref('');
const loading = ref(false);
const error = ref('');

async function loginWithJWT() {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await fetch('https://api.mtna-lp.dev/occ/jwt-auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: Include cookies
      body: JSON.stringify({ jwt: jwt.value }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Login successful, redirect or update UI
      console.log('Logged in as:', data.user);
      // Redirect to dashboard or home
      window.location.href = '/';
    } else {
      error.value = data.message || 'Login failed';
    }
  } catch (err) {
    error.value = 'Network error';
    console.error('Login error:', err);
  } finally {
    loading.value = false;
  }
}

async function checkSession() {
  try {
    const response = await fetch('https://api.mtna-lp.dev/occ/jwt-auth/session', {
      credentials: 'include',
    });
    
    const data = await response.json();
    
    if (data.authenticated) {
      console.log('User is authenticated:', data.user);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Session check error:', err);
    return false;
  }
}
</script>

<template>
  <div class="login-form">
    <h2>JWT Login</h2>
    
    <div v-if="error" class="error">{{ error }}</div>
    
    <textarea
      v-model="jwt"
      placeholder="Paste JWT token here"
      rows="10"
      :disabled="loading"
    />
    
    <button @click="loginWithJWT" :disabled="loading || !jwt">
      {{ loading ? 'Logging in...' : 'Login with JWT' }}
    </button>
    
    <button @click="checkSession">Check Session</button>
  </div>
</template>
```

## Token-Exchange-Details

### JWT-Bearer Grant (RFC 7523)

Der Token-Exchange verwendet den **JWT-Bearer Grant Type**:

```http
POST /authorizationserver/oauth/token HTTP/1.1
Host: commerce.example.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
&assertion=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
&scope=basic
```

### Token-Caching

Der Service cached ausgetauschte Tokens automatisch:

- **Cache-Key:** SHA256-Hash des JWT
- **TTL:** `expires_in - 60 Sekunden`
- **Implementierung:** NodeCache (In-Memory)
- **Produktion:** Sollte durch Redis ersetzt werden

### Session-Management

Sessions werden mit Präfix `jwt_` gespeichert, um Kollisionen mit CDC-Sessions zu vermeiden:

```typescript
sessionStore.set(`jwt_${sessionId}`, sessionData);
```

**Session-Daten:**
```typescript
{
  userId: string;
  email?: string;
  name?: string;
  uid?: string;
  commerceAccessToken: string;
  commerceTokenExpiry: number;
  commerceRefreshToken?: string;
  originalJWT: string;
  createdAt: number;
  lastAccessed: number;
}
```

## Sicherheit

### JWT-Validierung

Die JWT-Validierung prüft:

1. **Signatur:** RSA-Signatur mit JWKS
2. **Issuer:** Muss mit `JWT_ISSUER` übereinstimmen
3. **Audience:** Muss mit `JWT_AUDIENCE` übereinstimmen
4. **Expiration:** Token darf nicht abgelaufen sein
5. **Required Claims:** `sub` (Subject) muss vorhanden sein

### Clock Skew Tolerance

Die Validierung erlaubt 30 Sekunden Clock Skew zwischen Systemen:

```typescript
clockTolerance: 30
```

### Cookie-Sicherheit

Session-Cookies sind sicher konfiguriert:

- **HttpOnly:** Ja (kein JavaScript-Zugriff)
- **Secure:** Ja in Production
- **SameSite:** Lax (CSRF-Schutz)
- **MaxAge:** 24 Stunden

## Testing

### Manueller Test mit curl

#### 1. Login mit JWT

```bash
curl -X POST https://api.mtna-lp.dev/occ/jwt-auth/login \
  -H "Content-Type: application/json" \
  -d '{"jwt":"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."}' \
  -c cookies.txt
```

#### 2. Session prüfen

```bash
curl https://api.mtna-lp.dev/occ/jwt-auth/session \
  -b cookies.txt
```

#### 3. Geschützte Route aufrufen

```bash
curl https://api.mtna-lp.dev/occ/jwt-protected/profile \
  -b cookies.txt
```

#### 4. Logout

```bash
curl -X POST https://api.mtna-lp.dev/occ/jwt-auth/logout \
  -b cookies.txt
```

### Cache-Statistiken (Development)

```bash
curl https://api.mtna-lp.dev/occ/jwt-auth/cache-stats
```

## Fehlerbehandlung

### Häufige Fehler

| Fehlercode | Beschreibung | Lösung |
|------------|--------------|--------|
| `missing_jwt` | Kein JWT im Request | JWT im Body mitschicken |
| `invalid_jwt` | JWT-Validierung fehlgeschlagen | JWT-Signatur, Issuer, Audience prüfen |
| `token_exchange_failed` | Commerce-Token-Exchange fehlgeschlagen | Commerce-Credentials prüfen |
| `session_expired` | Session abgelaufen | Neu einloggen oder `/jwt-auth/refresh` aufrufen |
| `unauthorized` | Kein gültiger Session-Cookie | Einloggen mit `/jwt-auth/login` |

## Unterschiede zum CDC-Flow

| Aspekt | CDC-Flow | JWT-Flow |
|--------|----------|----------|
| **Initiierung** | Redirect zu CDC | POST mit JWT |
| **PKCE** | Ja | Nein (nicht nötig) |
| **Callback** | `/auth/callback` | Direkt in `/jwt-auth/login` |
| **Token-Source** | CDC OIDC | Lenzing-Backend JWT |
| **Session-Cookie** | `session_id` | `jwt_session_id` |
| **Endpoints** | `/auth/*` | `/jwt-auth/*` |
| **Protected Routes** | `/user-protected/*` | `/jwt-protected/*` |

## Produktion-Optimierungen

### 1. Redis für Token-Cache

Ersetze NodeCache durch Redis:

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

// In exchangeJWTForCommerceToken:
const cachedToken = await redis.get(cacheKey);
if (cachedToken) {
  return JSON.parse(cachedToken);
}

// Nach Exchange:
await redis.setex(cacheKey, ttl, JSON.stringify(tokenResponse));
```

### 2. Session-Store mit Redis

Verwende Redis statt In-Memory:

```typescript
// In SessionStore:
async set(sessionId: string, data: any) {
  await redis.setex(`session:${sessionId}`, 86400, JSON.stringify(data));
}

async get(sessionId: string) {
  const data = await redis.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}
```

### 3. Rate Limiting

Füge Rate Limiting für Login-Endpoint hinzu:

```typescript
app.post("/jwt-auth/login", {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '1 minute'
    }
  }
}, async (request, reply) => {
  // ...
});
```

## Monitoring & Logging

### Wichtige Log-Events

- JWT-Session erstellt: `JWT session created for user: ${userId}`
- JWT-Session refreshed: `JWT session refreshed for user: ${userId}`
- JWT-Session logout: `JWT session logged out: ${sessionId}`
- Token-Exchange fehlgeschlagen: `Token exchange failed: ${error}`
- JWT-Validierung fehlgeschlagen: `JWT validation failed: ${error}`

### Metriken

Überwache folgende Metriken:

- Login-Rate (`/jwt-auth/login`)
- Token-Exchange-Erfolgsrate
- Cache-Hit-Rate
- Session-Dauer
- Token-Refresh-Rate

## Zusammenfassung

Dieser JWT-Auth-Flow bietet:

✅ **Parallele Implementation** - Keine Änderungen an bestehenden Dateien  
✅ **RFC 7523 konform** - Standard JWT-Bearer Token Exchange  
✅ **Token-Caching** - Performance-Optimierung  
✅ **Session-Management** - Kompatibel mit bestehendem SessionStore  
✅ **Sicherheit** - JWKS-Validierung, sichere Cookies  
✅ **Frontend-Ready** - Einfache Integration in login.vue  
✅ **Production-Ready** - Mit Optimierungs-Hinweisen  

Der Flow ist inspiriert vom bewährten [SAP AppGyver Auth-Flow Pattern](https://github.com/SAP-samples/appgyver-auth-flows) und für den Einsatz mit Lenzing-Backend JWTs optimiert.
