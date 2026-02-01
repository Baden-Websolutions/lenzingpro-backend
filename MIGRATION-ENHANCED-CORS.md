# Migration zu Enhanced CORS Security

Dieser Leitfaden beschreibt die Migration von der aktuellen CORS-Konfiguration zur erweiterten, sicheren CORS-Lösung mit zusätzlichen Sicherheitsfeatures für Gigya SDK-Operationen.

## Übersicht der Änderungen

Die erweiterte CORS-Lösung bietet:

- **Strikte Origin-Validierung** mit Wildcard-Subdomain-Support
- **Zusätzliche Sicherheitsheader** (X-Content-Type-Options, X-Frame-Options, etc.)
- **CORS-Violation-Logging** für Monitoring und Sicherheitsanalyse
- **Erweiterte Fehlerbehandlung** mit detaillierten CORS-Fehlermeldungen
- **Gigya SDK-spezifische Header** für Signature-Validierung
- **Produktions-Sicherheitschecks** beim Server-Start
- **Flexible Konfiguration** über Umgebungsvariablen

## Migration Schritt für Schritt

### Schritt 1: Neue Dateien hinzufügen

Die folgenden neuen Dateien wurden erstellt:

```
src/middleware/cors-security.ts          # CORS Security Middleware
src/server-enhanced-cors.ts              # Enhanced Server Configuration
src/config/env-enhanced.ts               # Enhanced Environment Schema
.env.enhanced.example                    # Enhanced Environment Template
```

### Schritt 2: Bestehende Dateien sichern

Vor der Migration sollten Sie Backups erstellen:

```bash
# Backup der aktuellen Server-Konfiguration
cp src/server.ts src/server.backup.ts
cp src/config/env.ts src/config/env.backup.ts
cp .env .env.backup
```

### Schritt 3: Umgebungsvariablen aktualisieren

#### Option A: Minimale Migration (empfohlen für den Start)

Fügen Sie nur die kritischen neuen Variablen zu Ihrer `.env` hinzu:

```env
# Gigya Secret Key (KRITISCH für Signature-Validierung)
CDC_SECRET_KEY=your_base64_encoded_secret_key

# Cookie Secret (falls noch nicht gesetzt)
COOKIE_SECRET=your-random-secret-here-at-least-32-characters

# Optional: Erweiterte CORS-Konfiguration
CORS_ALLOW_CREDENTIALS=true
LOG_CORS_VIOLATIONS=true
```

**So erhalten Sie den CDC_SECRET_KEY:**
1. Gehen Sie zur Gigya Console: https://console.gigya.com
2. Wählen Sie Ihre Site aus
3. Navigieren Sie zu: Site Settings > API Key
4. Kopieren Sie den "Secret Key" (Base64-encoded)

**So generieren Sie einen sicheren COOKIE_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Option B: Vollständige Migration

Verwenden Sie die neue `.env.enhanced.example` als Vorlage:

```bash
# Kopieren Sie die Vorlage
cp .env.enhanced.example .env.new

# Übertragen Sie Ihre bestehenden Werte
# Bearbeiten Sie .env.new und fügen Sie Ihre Werte ein

# Nach Überprüfung: Ersetzen Sie die alte .env
mv .env .env.old
mv .env.new .env
```

### Schritt 4: Server-Konfiguration aktualisieren

#### Option A: Schrittweise Migration (empfohlen)

Erstellen Sie eine neue Index-Datei für Tests:

```typescript
// src/index-enhanced.ts
import { buildServerEnhanced } from "./server-enhanced-cors.js";

const { app, env } = await buildServerEnhanced();

try {
  await app.listen({ port: env.PORT, host: "127.0.0.1" });
  app.log.info(`lenzingpro-backend (enhanced) listening on http://127.0.0.1:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

Testen Sie die neue Konfiguration:

```bash
# Development Test
pnpm tsx src/index-enhanced.ts

# Build Test
pnpm build
node dist/index-enhanced.js
```

#### Option B: Direkte Migration

Ersetzen Sie die Server-Konfiguration in `src/index.ts`:

```typescript
// src/index.ts
import { buildServerEnhanced } from "./server-enhanced-cors.js";

const { app, env } = await buildServerEnhanced();

try {
  await app.listen({ port: env.PORT, host: "127.0.0.1" });
  app.log.info(`lenzingpro-backend listening on http://127.0.0.1:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

### Schritt 5: Wildcard-Subdomain-Support (optional)

Wenn Sie Wildcard-Subdomains unterstützen möchten:

```env
# Erlaubt alle Subdomains von mtna-lp.dev
CORS_ALLOW_ORIGINS=https://mtna-lp.dev,*.mtna-lp.dev

# Beispiele für erlaubte Origins:
# - https://mtna-lp.dev
# - https://www.mtna-lp.dev
# - https://app.mtna-lp.dev
# - https://api.mtna-lp.dev
```

### Schritt 6: Build und Deployment

```bash
# 1. Dependencies installieren (falls neue hinzugekommen sind)
pnpm install

# 2. TypeScript kompilieren
pnpm build

# 3. Testen
node dist/index.js

# 4. PM2 neu starten
pm2 restart lenzingpro-backend

# 5. Logs überprüfen
pm2 logs lenzingpro-backend
```

### Schritt 7: Produktions-Checks

Nach dem Deployment sollten Sie folgende Checks durchführen:

#### 1. Health Check
```bash
curl https://api.mtna-lp.dev/health
```

Erwartete Antwort:
```json
{
  "ok": true,
  "timestamp": "2024-01-29T12:00:00.000Z",
  "uptime": 123.45
}
```

#### 2. CORS Headers überprüfen
```bash
curl -I -X OPTIONS https://api.mtna-lp.dev/catalog/tree \
  -H "Origin: https://mtna-lp.dev" \
  -H "Access-Control-Request-Method: GET"
```

Erwartete Headers:
```
Access-Control-Allow-Origin: https://mtna-lp.dev
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

#### 3. CORS Violation Test
```bash
curl -I https://api.mtna-lp.dev/catalog/tree \
  -H "Origin: https://evil.com"
```

Erwartete Antwort: `403 Forbidden`

#### 4. Gigya SDK Status überprüfen

Überprüfen Sie die Logs beim Server-Start:

```bash
pm2 logs lenzingpro-backend --lines 50
```

Erwartete Log-Meldungen:
```
✓ Gigya SDK initialized - signature validation enabled
✓ Server configuration complete
```

**Falls Sie diese Warnung sehen:**
```
⚠️ Gigya SDK not initialized - CDC_SECRET_KEY missing
```

→ Fügen Sie `CDC_SECRET_KEY` zu Ihrer `.env` hinzu!

## Rollback-Plan

Falls Probleme auftreten, können Sie schnell zur alten Konfiguration zurückkehren:

```bash
# 1. Alte Dateien wiederherstellen
cp src/server.backup.ts src/server.ts
cp src/config/env.backup.ts src/config/env.ts
cp .env.backup .env

# 2. Index.ts zurücksetzen (falls geändert)
git checkout src/index.ts

# 3. Neu bauen und deployen
pnpm build
pm2 restart lenzingpro-backend
```

## Vorteile der neuen Konfiguration

### 1. Verbesserte Sicherheit

- **Strikte Origin-Validierung**: Nur explizit erlaubte Origins werden akzeptiert
- **Zusätzliche Security Headers**: Schutz gegen XSS, Clickjacking, MIME-Sniffing
- **Gigya Signature-Validierung**: Verifizierung aller Gigya SDK-Operationen
- **CORS-Violation-Logging**: Erkennung von Angriffsversuchen

### 2. Besseres Monitoring

- **Detailliertes Request/Response-Logging**: Alle Requests werden protokolliert
- **CORS-Violation-Tracking**: Verdächtige Aktivitäten werden geloggt
- **Performance-Metriken**: Response-Zeiten werden gemessen

### 3. Flexiblere Konfiguration

- **Wildcard-Subdomain-Support**: `*.example.com` erlaubt alle Subdomains
- **Umgebungsspezifische Settings**: Unterschiedliche Configs für Dev/Prod
- **Granulare Header-Kontrolle**: Volle Kontrolle über CORS-Header

### 4. Produktions-Sicherheitschecks

- **Automatische Validierung**: Kritische Konfigurationsfehler werden beim Start erkannt
- **Warnungen**: Unsichere Konfigurationen werden gemeldet
- **Fehlerprävention**: Deployment mit unsicheren Defaults wird verhindert

## Häufige Probleme und Lösungen

### Problem: "Origin not allowed by CORS policy"

**Ursache**: Der Origin ist nicht in `CORS_ALLOW_ORIGINS` aufgeführt.

**Lösung**:
```env
# Fügen Sie den Origin zu .env hinzu
CORS_ALLOW_ORIGINS=https://mtna-lp.dev,https://new-origin.com
```

### Problem: "Gigya SDK not initialized"

**Ursache**: `CDC_SECRET_KEY` fehlt in der `.env`.

**Lösung**:
```env
# Fügen Sie den Secret Key hinzu
CDC_SECRET_KEY=your_base64_encoded_secret_key
```

### Problem: "Invalid user signature"

**Ursache**: Der `CDC_SECRET_KEY` ist falsch oder die Signatur ist abgelaufen.

**Lösung**:
1. Überprüfen Sie den Secret Key in der Gigya Console
2. Stellen Sie sicher, dass der Key Base64-encoded ist
3. Erhöhen Sie ggf. `GIGYA_SIGNATURE_EXPIRATION`

### Problem: Cookies werden nicht gesetzt

**Ursache**: `COOKIE_SECURE=true` bei HTTP-Verbindung.

**Lösung für Development**:
```env
NODE_ENV=development
COOKIE_SECURE=false
```

**Lösung für Production**: Verwenden Sie HTTPS!

### Problem: Rate Limit zu streng

**Ursache**: `RATE_LIMIT_MAX` ist zu niedrig für Ihre Anwendung.

**Lösung**:
```env
# Erhöhen Sie das Limit
RATE_LIMIT_MAX=1000
RATE_LIMIT_TIME_WINDOW_MS=60000
```

## Testing-Checkliste

Vor dem Production-Deployment:

- [ ] Health Check funktioniert
- [ ] CORS Headers sind korrekt gesetzt
- [ ] CORS Violations werden blockiert und geloggt
- [ ] Gigya SDK ist initialisiert
- [ ] Cookies werden korrekt gesetzt
- [ ] Rate Limiting funktioniert
- [ ] Security Headers sind vorhanden
- [ ] Logs zeigen keine Fehler
- [ ] Frontend kann erfolgreich API-Requests machen
- [ ] Authentication Flow funktioniert
- [ ] Gigya Signature-Validierung funktioniert

## Support und Fragen

Bei Fragen oder Problemen:

1. Überprüfen Sie die Logs: `pm2 logs lenzingpro-backend`
2. Aktivieren Sie Debug-Logging: `LOG_LEVEL=debug`
3. Testen Sie mit curl (siehe Produktions-Checks)
4. Überprüfen Sie die Browser-Konsole auf CORS-Fehler

## Nächste Schritte

Nach erfolgreicher Migration:

1. **Monitoring einrichten**: Überwachen Sie CORS-Violations in Ihren Logs
2. **Alerting konfigurieren**: Benachrichtigungen bei häufigen CORS-Violations
3. **Performance-Optimierung**: Analysieren Sie Response-Zeiten
4. **Security-Audit**: Regelmäßige Überprüfung der CORS-Konfiguration
