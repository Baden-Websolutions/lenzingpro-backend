import type { FastifyInstance } from "fastify";
import { OidcDiscoveryProxyService } from "../services/oidcDiscoveryProxy.js";

export async function registerOidcDiscoveryProxyRoutes(app: FastifyInstance) {
  const API_KEY = "4_XQnjjmLc16oS7vqA6DvIAg";
  const discoveryUrl = `https://accounts.eu1.gigya.com/oidc/op/v1.0/${API_KEY}/.well-known/openid-configuration`;
  const jwksUrl = `https://fidm.eu1.gigya.com/oidc/op/v1.0/${API_KEY}/.well-known/jwks`;

  const svc = new OidcDiscoveryProxyService({
    discoveryUrl,
    jwksUrl,
    cacheTtlMs: 60_000,
    timeoutMs: 8_000,
  });

  app.get("/oidc/discovery", async (_req, reply) => {
    const r = await svc.fetchJson("discovery");
    reply.code(r.status);
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=60");
    return r.body;
  });

  app.get("/oidc/jwks", async (_req, reply) => {
    const r = await svc.fetchJson("jwks");
    reply.code(r.status);
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=300");
    return r.body;
  });

  app.get("/oidc/discovery/bundle", async (_req, reply) => {
    const [d, k] = await Promise.all([svc.fetchJson("discovery"), svc.fetchJson("jwks")]);
    reply.code(200);
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=60");
    return {
      discovery: { status: d.status, body: d.body },
      jwks: { status: k.status, body: k.body },
      meta: {
        discoveryUrl,
        jwksUrl,
        fetchedAt: new Date().toISOString(),
      },
    };
  });
}
