# Lenzingpro Backend - OIDC PKCE Implementation

Vollständig funktionsfähiges Backend für OIDC PKCE-Authentifizierung mit SAP Commerce Cloud und CDC (Gigya).

## Features

- ✅ **OIDC PKCE Flow** - Sichere Authentifizierung ohne Client Secret im Frontend
- ✅ **Discovery Proxy** - Caching für CDC Discovery und JWKS Endpunkte
- ✅ **Token Exchange** - Code-zu-Token und CDC-zu-Commerce Token Exchange
- ✅ **Session Management** - Cookie-basierte Session mit Commerce OCC Integration
- ✅ **WebSDK Support** - Optional für Legacy-Integrationen
- ✅ **Rate Limiting** - Schutz vor Missbrauch
- ✅ **CORS** - Konfigurierbar für Frontend-Domains
- ✅ **Security Headers** - Helmet für Production-Ready Security

## Architektur

```
Frontend (mtna-lp.dev)
    ↓
Backend API (api.mtna-lp.dev)
    ↓
├── OIDC Routes (/oidc/*)
│   ├── POST /oidc/authorize
│   ├── GET /oidc/callback
│   ├── POST /oidc/token/exchange
│   └── POST /oidc/commerce/token-exchange
│
├── Discovery Proxy (/oidc/discovery/*)
│   ├── GET /oidc/discovery
│   ├── GET /oidc/jwks
│   └── GET /oidc/discovery/bundle
│
├── Session Routes (/session)
│   ├── GET /session
│   └── POST /session/logout
│
└── Catalog Routes (/catalog/*)
    ├── GET /catalog/tree
    ├── GET /catalog/search
    └── GET /catalog/category/:code/products
```

## Installation

### 1. Dependencies installieren

```bash
pnpm install
```

Neue Dependencies:
- `@fastify/cookie` - Cookie-Support für OIDC Flow
- `jose` - JWT-Verifikation für ID Tokens

### 2. Environment konfigurieren

```bash
cp .env.example .env
```

Erforderliche Variablen in `.env`:

```env
# Server
PORT=3002
NODE_ENV=production

# SAP Commerce Cloud
COMMERCE_BASE_URL=https://your-commerce-instance.com
COMMERCE_BASE_SITE=lenzingpro
COMMERCE_CLIENT_ID=your_commerce_client_id
COMMERCE_CLIENT_SECRET=your_commerce_client_secret

# CDC (Gigya)
CDC_BASE=https://fidm.eu1.gigya.com
CDC_API_KEY=4_XQnjjmLc16oS7vqA6DvIAg
CDC_OIDC_CLIENT_ID=ABbd672Koy3U

# Frontend & Callback
FRONTEND_BASE_URL=https://mtna-lp.dev
OIDC_CALLBACK_PATH=/oidc/callback
OIDC_REDIRECT_URI=https://api.mtna-lp.dev/occ

# Cookie Secret (WICHTIG: In Production ändern!)
COOKIE_SECRET=change-this-to-a-random-secret-in-production

# CORS
CORS_ALLOW_ORIGINS=https://mtna-lp.dev,https://www.mtna-lp.dev
```

### 3. Build & Start

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start
```

## API Endpunkte

### OIDC Flow

#### POST /oidc/authorize
Startet OIDC PKCE Flow, generiert state/nonce/verifier, gibt Authorization URL zurück.

**Request:**
```json
{
  "returnTo": "/dashboard"
}
```

**Response:**
```json
{
  "authorizationUrl": "https://fidm.eu1.gigya.com/oidc/op/v1.0/.../authorize?...",
  "state": "...",
  "nonce": "...",
  "codeChallenge": "..."
}
```

#### GET /oidc/callback
Callback-Endpunkt für CDC Authorization Response. Validiert state, tauscht Code gegen Tokens, erstellt Session.

**Query Parameters:**
- `code` - Authorization Code
- `state` - State Parameter

**Redirects to:** `${FRONTEND_BASE_URL}${returnTo}`

#### POST /oidc/token/exchange
Tauscht Authorization Code gegen Tokens (für client-side PKCE).

**Request:**
```json
{
  "code": "authorization_code",
  "codeVerifier": "pkce_verifier",
  "nonce": "nonce_value"
}
```

**Response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "id_token": "...",
  "expires_in": 3600
}
```

#### POST /oidc/commerce/token-exchange
Tauscht CDC Access Token gegen Commerce Access Token.

**Request:**
```json
{
  "cdcAccessToken": "cdc_access_token"
}
```

**Response:**
```json
{
  "access_token": "commerce_access_token",
  "expires_in": 3600
}
```

### Discovery Proxy

#### GET /oidc/discovery
Proxied CDC OpenID Connect Discovery Endpoint mit Caching.

#### GET /oidc/jwks
Proxied CDC JWKS Endpoint mit Caching.

#### GET /oidc/discovery/bundle
Gibt Discovery und JWKS in einem Request zurück.

**Response:**
```json
{
  "discovery": {
    "status": 200,
    "body": { ... }
  },
  "jwks": {
    "status": 200,
    "body": { "keys": [...] }
  },
  "meta": {
    "discoveryUrl": "...",
    "jwksUrl": "...",
    "fetchedAt": "2024-01-29T12:00:00.000Z"
  }
}
```

### Session Management

#### GET /session
Gibt aktuellen User zurück, falls authentifiziert.

**Response (authenticated):**
```json
{
  "authenticated": true,
  "user": {
    "uid": "user@example.com",
    "name": "John Doe",
    ...
  }
}
```

**Response (not authenticated):**
```json
{
  "authenticated": false
}
```

#### POST /session/logout
Löscht Session Cookies.

**Response:**
```json
{
  "ok": true
}
```

### Catalog Routes

#### GET /catalog/tree
Gibt Katalog-Hierarchie zurück.

#### GET /catalog/search
Sucht Produkte.

**Query Parameters:**
- `query` - Suchbegriff (default: `:relevance`)
- `fields` - OCC Fields (default: `DEFAULT`)
- `pageSize` - Anzahl Ergebnisse (default: 20)
- `currentPage` - Seite (default: 0)

#### GET /catalog/category/:code/products
Gibt Produkte einer Kategorie zurück.

## Frontend Integration

### HTML Test-Seite

Die Datei `public/cdc-login-test.html` enthält eine vollständige Test-Implementierung mit:

- **OIDC PKCE Mode** - Client-side PKCE Flow
- **WebSDK Mode** - Legacy Gigya WebSDK Integration
- **Toggle zwischen Modi** - Einfacher Wechsel für Tests
- **Debug Log** - Alle Requests/Responses sichtbar

### PKCE Flow (Frontend)

```javascript
// 1. Generate PKCE parameters
const verifier = generateCodeVerifier();
const challenge = await generateCodeChallenge(verifier);
const state = generateRandomString(32);
const nonce = generateRandomString(32);

// 2. Store in sessionStorage
sessionStorage.setItem('pkce_verifier', verifier);
sessionStorage.setItem('pkce_state', state);
sessionStorage.setItem('pkce_nonce', nonce);

// 3. Redirect to authorization endpoint
const authUrl = new URL('https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg/authorize');
authUrl.searchParams.set('client_id', 'ABbd672Koy3U');
authUrl.searchParams.set('redirect_uri', 'https://api.mtna-lp.dev/occ');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'openid profile email');
authUrl.searchParams.set('state', state);
authUrl.searchParams.set('nonce', nonce);
authUrl.searchParams.set('code_challenge', challenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
window.location.href = authUrl.toString();

// 4. After redirect, exchange code
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const returnedState = urlParams.get('state');

if (returnedState === sessionStorage.getItem('pkce_state')) {
  const response = await fetch('https://api.mtna-lp.dev/oidc/token/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      codeVerifier: sessionStorage.getItem('pkce_verifier'),
      nonce: sessionStorage.getItem('pkce_nonce')
    })
  });
  const tokens = await response.json();
  // Use tokens...
}
```

## Deployment

### nginx Konfiguration

Die nginx-Konfiguration in `nginx/api.mtna-lp.dev.snippet.conf` ist bereits korrekt:

```nginx
location /health { proxy_pass http://127.0.0.1:3002; }
location /catalog/ { proxy_pass http://127.0.0.1:3002; }
location /session/ { proxy_pass http://127.0.0.1:3002; }
location /oidc/ { proxy_pass http://127.0.0.1:3002; }
```

### PM2 (Production)

```bash
pm2 start pm2.config.cjs
pm2 save
```

## Security Considerations

1. **Cookie Secret**: MUSS in Production geändert werden
2. **CORS Origins**: Nur vertrauenswürdige Domains
3. **Rate Limiting**: Aktiv (300 req/min default)
4. **Helmet**: Security Headers aktiv
5. **HTTPS**: Nur über HTTPS betreiben
6. **Environment Variables**: Niemals committen

## Testing

### Health Check

```bash
curl https://api.mtna-lp.dev/health
```

### Discovery Bundle

```bash
curl https://api.mtna-lp.dev/oidc/discovery/bundle
```

### Session Status

```bash
curl -b cookies.txt https://api.mtna-lp.dev/session
```

## Troubleshooting

### "Not allowed by CORS"
→ Prüfe `CORS_ALLOW_ORIGINS` in `.env`

### "Invalid environment configuration"
→ Prüfe alle erforderlichen Variablen in `.env`

### "Token exchange failed"
→ Prüfe `COMMERCE_CLIENT_ID` und `COMMERCE_CLIENT_SECRET`

### "Nonce mismatch"
→ ID Token wurde mit anderem nonce erstellt, prüfe PKCE Flow

### "State mismatch"
→ Möglicher CSRF-Angriff oder Session-Timeout

## Changelog

### v0.2.0 (2024-01-29)
- ✅ OIDC PKCE Flow komplett implementiert
- ✅ Discovery Proxy mit Caching
- ✅ Token Exchange Endpunkte
- ✅ Session Management mit Commerce Integration
- ✅ Frontend Test-Seite mit WebSDK-Toggle
- ✅ Cookie-Plugin integriert
- ✅ ID Token Verifikation

### v0.1.0
- Initial Release
- Basic Commerce Catalog Routes
- Health Check

## License

Private - Baden Websolutions
