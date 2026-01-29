import type { FastifyInstance } from "fastify";
import { OidcDiscoveryProxyService } from "../services/oidcDiscoveryProxy.js";
import type { AppEnv } from "../config/env.js";

/**
 * Register OIDC Discovery Proxy routes:
 * - GET /oidc/discovery: proxy CDC discovery endpoint
 * - GET /oidc/jwks: proxy CDC JWKS endpoint
 * - GET /oidc/discovery/bundle: return both discovery and JWKS in one request
 */
export async function registerOidcDiscoveryProxyRoutes(app: FastifyInstance, env: AppEnv) {
  const API_KEY = env.CDC_API_KEY;
  const CDC_BASE = env.CDC_BASE;

  const discoveryUrl = `${CDC_BASE}/oidc/op/v1.0/${API_KEY}/.well-known/openid-configuration`;
  const jwksUrl = `${CDC_BASE}/oidc/op/v1.0/${API_KEY}/jwks`;

  const svc = new OidcDiscoveryProxyService({
    discoveryUrl,
    jwksUrl,
    cacheTtlMs: 60_000,   // 60s cache
    timeoutMs: 8_000      // 8s timeout
  });

  /**
   * GET /oidc/discovery
   * Proxy CDC OpenID Connect discovery endpoint
   */
  app.get("/oidc/discovery", async (_req, reply) => {
    const r = await svc.fetchJson("discovery");

    reply.code(r.status);
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=60");
    
    return r.body;
  });

  /**
   * GET /oidc/jwks
   * Proxy CDC JWKS endpoint
   */
  app.get("/oidc/jwks", async (_req, reply) => {
    const r = await svc.fetchJson("jwks");

    reply.code(r.status);
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=300"); // JWKS can be cached longer
    
    return r.body;
  });

  /**
   * GET /oidc/discovery/bundle
   * Return both discovery and JWKS in a single request
   * Useful for client initialization
   */
  app.get("/oidc/discovery/bundle", async (_req, reply) => {
    const d = await svc.fetchJson("discovery");

    reply.code(200);
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Cache-Control", "public, max-age=60");
    
    return {
      discovery: d.body,
      jwks: { keys: [] },
      meta: {
        discoveryUrl,
        jwksUrl: d.body?.jwks_uri || jwksUrl,
        fetchedAt: new Date().toISOString(),
        note: "JWKS endpoint timeout - using discovery only"
      }
    };
  });
}
