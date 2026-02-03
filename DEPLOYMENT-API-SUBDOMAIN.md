# Backend Deployment für api.mtna-lp.dev

## Problem

Backend API ist aktuell nicht erreichbar unter `https://api.mtna-lp.dev`:
- **Status:** 502 Bad Gateway
- **Ursache:** Backend nicht gestartet oder Nginx-Proxy-Config fehlt

## Lösung

### 1. Backend auf Server deployen

```bash
# SSH zum Server
ssh lenzing-dev@mtna-lp.dev

# Zum Backend-Verzeichnis
cd /home/lenzing-dev/lenzingpro-v2/lenzingpro-backend

# Pull latest changes
git pull origin dev

# Install dependencies (falls nötig)
pnpm install

# Build TypeScript
pnpm run build

# Start mit PM2
pm2 start pm2.config.cjs --name lenzingpro-backend
# ODER restart falls bereits läuft:
pm2 restart lenzingpro-backend

# Status prüfen
pm2 status
pm2 logs lenzingpro-backend --lines 50
```

### 2. Nginx Proxy Config für api.mtna-lp.dev

Erstelle `/etc/nginx/sites-available/api.mtna-lp.dev`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.mtna-lp.dev;

    # Basic Auth (optional, falls gewünscht)
    # auth_basic "Restricted Content";
    # auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktivieren und SSL hinzufügen:

```bash
# Symlink erstellen
sudo ln -s /etc/nginx/sites-available/api.mtna-lp.dev /etc/nginx/sites-enabled/

# Nginx testen
sudo nginx -t

# Nginx reload
sudo systemctl reload nginx

# SSL mit Certbot
sudo certbot --nginx -d api.mtna-lp.dev
```

### 3. Environment Variables prüfen

Stelle sicher, dass `.env` im Backend-Verzeichnis existiert:

```bash
cd /home/lenzing-dev/lenzingpro-v2/lenzingpro-backend

# .env erstellen (falls nicht vorhanden)
cp .env.example .env

# Wichtige Variablen:
# PORT=3002
# NODE_ENV=production
# CORS_ALLOW_ORIGINS=https://mtna-lp.dev
# COMMERCE_BASE_URL=...
# COMMERCE_CLIENT_ID=...
# COMMERCE_CLIENT_SECRET=...
```

### 4. Backend testen

```bash
# Health Check (lokal)
curl http://127.0.0.1:3002/health

# Health Check (extern)
curl https://api.mtna-lp.dev/health

# Catalog Tree
curl https://api.mtna-lp.dev/catalog/tree
```

## API-Endpunkte

Nach dem Deployment sind folgende Endpunkte verfügbar:

- `GET /health` - Health Check
- `GET /catalog/tree` - Katalog-Baum
- `GET /catalog/search?query=...` - Produktsuche
- `GET /catalog/category/:code/products` - Produkte nach Kategorie
- `GET /auth/*` - Auth-Endpunkte
- `GET /session/*` - Session-Endpunkte

## Frontend-Integration

Das Frontend (`mtna-lp.dev`) ruft die API über `https://api.mtna-lp.dev` auf:

```typescript
// app/composables/useApi.ts
const baseURL = 'https://api.mtna-lp.dev'

// Beispiel: Katalog laden
const catalogData = await $fetch(`${baseURL}/catalog/tree`)
```

## Troubleshooting

### 502 Bad Gateway
- Backend läuft nicht → `pm2 restart lenzingpro-backend`
- Falscher Port in Nginx → Prüfe `proxy_pass http://127.0.0.1:3002`
- Firewall blockiert → Prüfe `ufw status`

### CORS Errors
- Füge Frontend-URL zu `CORS_ALLOW_ORIGINS` hinzu
- Restart Backend nach .env-Änderungen

### 401 Unauthorized
- Commerce API Credentials falsch
- Prüfe `COMMERCE_CLIENT_ID` und `COMMERCE_CLIENT_SECRET`

## PM2 Commands

```bash
# Status
pm2 status

# Logs
pm2 logs lenzingpro-backend --lines 100

# Restart
pm2 restart lenzingpro-backend

# Stop
pm2 stop lenzingpro-backend

# Delete
pm2 delete lenzingpro-backend
```

## Nächste Schritte

1. Backend deployen (siehe oben)
2. Nginx Config erstellen
3. SSL aktivieren
4. Frontend deployen (bereits gepusht)
5. Testen: `https://mtna-lp.dev/catalog/textile`
