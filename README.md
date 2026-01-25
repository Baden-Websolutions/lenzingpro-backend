# lenzingpro-backend (api.mtna-lp.dev)

Option A: eigenständiger Backend-Service für api.mtna-lp.dev

## Features (Stand jetzt)
- GET /health
- GET /catalog/tree  -> OCC /catalogs
- GET /catalog/category/:code/products -> OCC products/search (category facet)
- GET /session (stub)
- GET /oidc/callback (stub redirect -> https://mtna-lp.dev/login?...)

## Setup
```bash
cd /home/lenzing-dev/lenzingpro-v2/lenzingpro-backend
cp .env.example .env
npm i
npm run dev
```
