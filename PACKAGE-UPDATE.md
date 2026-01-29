# Package.json Update für JWT Auth Flow

## Erforderliche Dependencies

Die JWT-Auth-Implementation benötigt eine zusätzliche Dependency:

### node-cache

Für Token-Caching (In-Memory Cache).

```bash
npm install node-cache
```

**Hinweis:** Alle anderen Dependencies (`jose`, `fastify`, etc.) sind bereits vorhanden.

## Vollständige package.json

Nach dem Update sollte die `dependencies`-Sektion so aussehen:

```json
{
  "dependencies": {
    "@fastify/cookie": "^9.3.1",
    "@fastify/cors": "^9.0.0",
    "@fastify/helmet": "^11.1.1",
    "@fastify/rate-limit": "^9.1.0",
    "dotenv": "^16.4.5",
    "fastify": "^4.28.1",
    "jose": "^5.2.0",
    "node-cache": "^5.1.2",
    "node-fetch": "^3.3.2",
    "pino-pretty": "^11.2.2",
    "zod": "^3.23.8"
  }
}
```

## Installation

```bash
cd /path/to/lenzingpro-backend
npm install node-cache
```

## Verwendung in den neuen Dateien

`node-cache` wird verwendet in:

- `src/services/jwt-token-exchange.ts` - Für Token-Caching

```typescript
import NodeCache from "node-cache";

const tokenCache = new NodeCache({
  stdTTL: 3600,
  checkperiod: 60,
  useClones: false,
});
```

## Produktion: Redis statt NodeCache

Für Production sollte NodeCache durch Redis ersetzt werden:

```bash
npm install ioredis
```

Siehe `JWT-AUTH-FLOW.md` Abschnitt "Produktion-Optimierungen" für Details.
