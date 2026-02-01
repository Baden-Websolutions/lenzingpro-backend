# Schnellstart: Enhanced CORS Security

Dieser Schnellstart-Leitfaden hilft Ihnen, die erweiterte CORS-Sicherheit in wenigen Minuten zu implementieren.

## 🚀 In 5 Minuten starten

### 1. Kritische Secrets hinzufügen

Fügen Sie diese beiden Zeilen zu Ihrer `.env`-Datei hinzu:

```bash
# Gigya Secret Key (aus Gigya Console > Site Settings > API Key)
CDC_SECRET_KEY=ihr_base64_encoded_secret_key

# Cookie Secret (generieren mit: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
COOKIE_SECRET=ihr_zufälliger_secret_hier_mindestens_32_zeichen
```

### 2. Server-Startpunkt aktualisieren

Öffnen Sie `src/index.ts` und ändern Sie:

```typescript
// ALT:
import { buildServer } from "./server.js";
const { app, env } = await buildServer();

// NEU:
import { buildServerEnhanced } from "./server-enhanced-cors.js";
const { app, env } = await buildServerEnhanced();
```

### 3. Build & Deploy

```bash
pnpm build
pm2 restart lenzingpro-backend
```

### 4. Verifizieren

```bash
# Health Check
curl https://api.mtna-lp.dev/health

# Logs prüfen
pm2 logs lenzingpro-backend --lines 20
```

**Erwartete Log-Meldung:**
```
✓ Gigya SDK initialized - signature validation enabled
✓ Server configuration complete
```

## ✅ Das war's!

Ihre erweiterte CORS-Sicherheit ist jetzt aktiv.

## 📚 Weitere Ressourcen

- **Vollständige Dokumentation**: `CORS_Security_Implementation_Guide.md`
- **Detaillierte Migration**: `MIGRATION-ENHANCED-CORS.md`
- **Konfigurationsvorlage**: `.env.enhanced.example`

## 🔧 Erweiterte Konfiguration (optional)

### Wildcard-Subdomains aktivieren

```env
# Erlaubt alle Subdomains von mtna-lp.dev
CORS_ALLOW_ORIGINS=https://mtna-lp.dev,*.mtna-lp.dev
```

### Logging anpassen

```env
# Debug-Logging für Entwicklung
LOG_LEVEL=debug
LOG_CORS_VIOLATIONS=true
```

### Rate Limiting anpassen

```env
# Höheres Limit für API-intensive Apps
RATE_LIMIT_MAX=1000
RATE_LIMIT_TIME_WINDOW_MS=60000
```

## ⚠️ Wichtige Hinweise

1. **CDC_SECRET_KEY ist kritisch**: Ohne diesen Key ist die Gigya Signature-Validierung deaktiviert!
2. **COOKIE_SECRET ändern**: Verwenden Sie NIEMALS den Default-Wert in Produktion!
3. **HTTPS verwenden**: CORS und Cookies funktionieren nur sicher über HTTPS!

## 🆘 Probleme?

### "Gigya SDK not initialized"
→ Fügen Sie `CDC_SECRET_KEY` zu `.env` hinzu

### "Origin not allowed by CORS"
→ Fügen Sie den Origin zu `CORS_ALLOW_ORIGINS` hinzu

### Cookies werden nicht gesetzt
→ Stellen Sie sicher, dass `COOKIE_SECURE=true` und HTTPS verwendet wird

Weitere Hilfe: Siehe `MIGRATION-ENHANCED-CORS.md` Abschnitt "Häufige Probleme"
