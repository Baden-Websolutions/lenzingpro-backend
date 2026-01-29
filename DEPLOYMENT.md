# Deployment Anleitung - OIDC PKCE Update

## Übersicht

Dieses Update bringt vollständige OIDC PKCE Unterstützung mit folgenden Fixes:

1. ✅ **Token Exchange Proxy** - POST /oidc/token vermeidet CORS-Probleme
2. ✅ **CDC Token Endpoint** - Korrekter Endpoint statt Commerce Cloud
3. ✅ **Client Authentication** - client_id in Body statt Basic Auth
4. ✅ **ID Token Verification** - Korrekte Issuer und Audience

## Deployment Schritte

### 1. Code auf Server pullen

```bash
cd /home/lenzing-dev/lenzingpro-v2/lenzingpro-backend
git pull origin main
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. TypeScript kompilieren

```bash
npm run build
```

### 4. PM2 neu starten

```bash
pm2 restart lenzingpro-api
pm2 logs lenzingpro-api --lines 20
```

### 5. Nginx Konfiguration aktualisieren

```bash
# Backup der aktuellen Konfiguration
sudo cp /etc/nginx/sites-available/api.mtna-lp.dev /etc/nginx/sites-available/api.mtna-lp.dev.backup

# Neue OIDC Endpoints hinzufügen (aus nginx-oidc-config.conf)
sudo nano /etc/nginx/sites-available/api.mtna-lp.dev

# Nginx testen
sudo nginx -t

# Nginx neu laden
sudo systemctl reload nginx
```

### 6. Backend testen

```bash
# Health Check
curl https://api.mtna-lp.dev/health

# Discovery Bundle
curl https://api.mtna-lp.dev/oidc/discovery/bundle

# POST /oidc (Authorization Start)
curl -X POST https://api.mtna-lp.dev/oidc \
  -H "Content-Type: application/json" \
  -d '{"returnTo":"/"}'
```

## Neue Endpoints

### POST /oidc
**Zweck:** Authorization Flow starten  
**Request:**
```json
{
  "returnTo": "/"
}
```
**Response:**
```json
{
  "authorizationUrl": "https://fidm.eu1.gigya.com/oidc/op/v1.0/..."
}
```

### POST /oidc/token
**Zweck:** Token Exchange Proxy (vermeidet CORS)  
**Request:**
```json
{
  "code": "authorization_code",
  "code_verifier": "pkce_verifier",
  "redirect_uri": "https://api.mtna-lp.dev/occ"
}
```
**Response:**
```json
{
  "access_token": "...",
  "id_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### GET /occ
**Zweck:** OIDC Callback (nach Login)  
**Query Params:** `code`, `state`  
**Response:** Redirect zu Frontend mit Session Cookies

## Änderungen im Detail

### src/services/oidc.ts

**Vorher:**
```typescript
const url = `${this.env.COMMERCE_BASE_URL}/authorizationserver/oauth/token`;
const basicAuth = Buffer.from(`${this.env.COMMERCE_CLIENT_ID}:${this.env.COMMERCE_CLIENT_SECRET}`).toString("base64");
```

**Nachher:**
```typescript
const url = `${this.env.CDC_BASE}/oidc/op/v1.0/${this.env.CDC_API_KEY}/token`;
body.set("client_id", this.env.CDC_OIDC_CLIENT_ID);
```

### src/routes/oidc.ts

**Neu hinzugefügt:**
```typescript
app.post("/oidc/token", async (req, reply) => {
  const { code, code_verifier } = req.body;
  const tokens = await oidcService.exchangeCode(code, code_verifier);
  return reply.send(tokens);
});
```

## Test-Seite anpassen

Um die Test-Seite `test_cdc_login_bu_2801-1709.html` mit dem Backend-Proxy zu verwenden:

```javascript
// Statt CDC direkt:
// const tokenEndpoint = 'https://fidm.eu1.gigya.com/oidc/op/v1.0/.../token';

// Backend-Proxy verwenden:
const tokenEndpoint = 'https://api.mtna-lp.dev/oidc/token';
```

## Troubleshooting

### Problem: POST /oidc gibt 301 Redirect

**Lösung:** Nginx Konfiguration prüfen
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Problem: Token Exchange schlägt fehl

**Lösung:** Backend Logs prüfen
```bash
pm2 logs lenzingpro-api --lines 50
```

### Problem: CORS Fehler

**Lösung:** CORS Konfiguration in src/server.ts prüfen
```typescript
origin: ['https://mtna-lp.dev', 'https://www.mtna-lp.dev']
```

## Rollback

Falls Probleme auftreten:

```bash
# Git Rollback
cd /home/lenzing-dev/lenzingpro-v2/lenzingpro-backend
git reset --hard HEAD~1
npm run build
pm2 restart lenzingpro-api

# Nginx Rollback
sudo cp /etc/nginx/sites-available/api.mtna-lp.dev.backup /etc/nginx/sites-available/api.mtna-lp.dev
sudo systemctl reload nginx
```

## Support

Bei Fragen oder Problemen:
- Backend Logs: `pm2 logs lenzingpro-api`
- Nginx Logs: `sudo tail -f /var/log/nginx/error.log`
- Browser Console: F12 → Console Tab
