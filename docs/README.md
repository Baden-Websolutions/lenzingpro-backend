# JWT Authentication - Dokumentation & Test-Scripts

Vollständige Dokumentation und Test-Scripts für den JWT-Bearer Token Exchange Flow.

## 📚 Dokumentation

### Flow-Erklärungen

- **[JWT-FLOW-EXPLANATION.md](./JWT-FLOW-EXPLANATION.md)** - Vergleich: Bestehender CDC-Flow vs. Neuer JWT-Flow
- **[CDC-KEYS-EXPLANATION.md](./CDC-KEYS-EXPLANATION.md)** - Unterschied: CDC Secret Key vs. JWT Private Key
- **[CDC-HMAC-SIGNATURE-EXAMPLE.md](./CDC-HMAC-SIGNATURE-EXAMPLE.md)** - HMAC-Signatur-Berechnung mit Beispielen

### Test-Anleitungen

- **[GET-REAL-JWT-GUIDE.md](./GET-REAL-JWT-GUIDE.md)** - Anleitung: Echten JWT von CDC holen
- **[JWT-AUTH-CURL-TEST.md](./JWT-AUTH-CURL-TEST.md)** - curl-Befehle für JWT-Auth-Flow-Tests

## 🚀 Test-Scripts

### JWT holen

- **[get-jwt.sh](./get-jwt.sh)** - Einfaches Script: CDC Login → JWT holen
- **[cdc-getjwt-with-signature.sh](./cdc-getjwt-with-signature.sh)** - Vollständiges Script mit HMAC-Signatur-Berechnung

### JWT-Auth-Flow testen

- **[jwt-auth-test-commands.sh](./jwt-auth-test-commands.sh)** - Automatische Test-Suite (8 Tests)

## 📋 Schnellstart

### 1. JWT von CDC holen

```bash
# Credentials setzen
export CDC_SECRET_KEY="your_cdc_secret_key"
export CDC_EMAIL="your@email.com"
export CDC_PASSWORD="yourpassword"

# Script ausführen
bash get-jwt.sh
```

### 2. JWT-Auth-Flow testen

```bash
# JWT Token aus Schritt 1 verwenden
export JWT_TOKEN="eyJhbGci..."

# Test-Suite ausführen
bash jwt-auth-test-commands.sh
```

## 🎯 Was wird getestet?

Die Test-Suite führt folgende Tests aus:

1. ✅ Health Check
2. ✅ Session Check (vor Login)
3. ✅ Login mit JWT
4. ✅ Session Check (nach Login)
5. ✅ Protected Endpoint - Profile
6. ✅ Protected Endpoint - Commerce Token
7. ✅ Logout
8. ✅ Session Check (nach Logout)

## 📊 Erwartete Ergebnisse

### Erfolgreicher Flow

```
✓ Health Check OK (HTTP 200)
✓ Session Check OK - nicht authentifiziert (HTTP 200)
✓ Login erfolgreich (HTTP 200)
✓ Session Check OK - authentifiziert (HTTP 200)
✓ Profile abgerufen (HTTP 200)
✓ Commerce Token abgerufen (HTTP 200)
✓ Logout erfolgreich (HTTP 200)
✓ Session Check OK - nicht authentifiziert (HTTP 200)
```

## 🔧 Voraussetzungen

### Environment-Variablen

```bash
# Für JWT-Holen (get-jwt.sh)
CDC_SECRET_KEY="your_cdc_secret_key"
CDC_EMAIL="your@email.com"
CDC_PASSWORD="yourpassword"

# Für JWT-Auth-Tests (jwt-auth-test-commands.sh)
JWT_TOKEN="eyJhbGci..."
```

### Backend-Konfiguration

Das Backend muss mit folgenden Environment-Variablen konfiguriert sein:

```bash
# JWT Authentication
JWT_JWKS_URI="https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg/v2.0/keys"
JWT_ISSUER="https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg"
JWT_AUDIENCE="ABbd672Koy3U"
```

## 📖 Weitere Informationen

Für detaillierte Erklärungen siehe:

- **JWT-FLOW-EXPLANATION.md** - Versteht den Unterschied zwischen den Flows
- **CDC-KEYS-EXPLANATION.md** - Versteht die verschiedenen Keys
- **GET-REAL-JWT-GUIDE.md** - Holt einen echten JWT für Tests

## 🛠️ Troubleshooting

### Problem: "JWT validation failed: invalid signature"

**Lösung:** Verwende einen echten JWT von CDC (siehe GET-REAL-JWT-GUIDE.md)

### Problem: "Token exchange failed"

**Lösung:** Prüfe Backend-Logs und Commerce-Credentials

### Problem: "No JWT session found"

**Lösung:** Prüfe Cookie-Handling (siehe JWT-AUTH-CURL-TEST.md)

## ✅ Zusammenfassung

Diese Dokumentation und Scripts helfen dir:

- ✅ Den Unterschied zwischen CDC-Flow und JWT-Flow zu verstehen
- ✅ Einen echten JWT von CDC zu holen
- ✅ Den JWT-Auth-Flow zu testen
- ✅ Probleme zu debuggen

**Viel Erfolg beim Testen!** 🚀
