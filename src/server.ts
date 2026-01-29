import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { loadEnv } from "./config/env.js";
import { CommerceClient } from "./services/commerce.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerOidcRoutes } from "./routes/oidc.js";
import { registerOidcDiscoveryProxyRoutes } from "./routes/oidcDiscoveryProxy.js";

export async function buildServer() {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport: env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" }
    }
  });

  // Security: Helmet
  await app.register(helmet, { global: true });

  // Rate limiting
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW_MS
  });

  // Cookie support for OIDC flow
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || "lenzingpro-cookie-secret-change-in-production",
    parseOptions: {}
  });

  // CORS configuration
  const allowed = env.CORS_ALLOW_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true
  });

  // Health check
  app.get("/health", async () => ({ ok: true }));

  // Initialize Commerce client
  const commerce = new CommerceClient(env);

  // Register routes
  await registerCatalogRoutes(app, commerce);
  await registerSessionRoutes(app, commerce);
  await registerOidcRoutes(app, env);
  await registerOidcDiscoveryProxyRoutes(app);

  return { app, env };
}
