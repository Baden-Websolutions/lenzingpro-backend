import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
// import session from "@fastify/session"; // REMOVED: Using @fastify/secure-session instead
import secureSession from "@fastify/secure-session";
import { loadEnv } from "./config/env.js";
import { CommerceClient } from "./services/commerce.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerOidcRoutes } from "./routes/oidc.js";
import { registerOidcDiscoveryProxyRoutes } from "./routes/oidcDiscoveryProxy.js";
import { SessionStore } from "./services/session-store.js";
import { CDCAuthService } from "./services/cdc-auth.js";
import { registerAuthFlowRoutes } from "./routes/auth-flow.js";
import { registerUserProtectedRoutes } from "./routes/user-protected.js";
import authRoutes from "./routes/auth.js";
import { registerCMSRoutes } from "./routes/cms.js";
import gigyaDevRoutes from "./routes/gigya_dev.js";
import { GigyaRestService } from "./services/gigya-rest.js";
import { registerSessionCdcRoutes } from "./routes/session-cdc.js";

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

  // Session support for /auth routes (old system) - COMMENTED OUT
  // Using @fastify/secure-session for CDC authentication instead
  // To re-enable old cookie-based session system, uncomment below and reinstall @fastify/session
  /*
  await app.register(session, {
    secret: process.env.SESSION_SECRET || "lenzingpro-session-secret-change-in-production-min-32-chars",
    cookie: {
      secure: env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    },
    saveUninitialized: false
  });
  */

  // Secure session for CDC authentication (new system)
  await app.register(secureSession, {
    secret: env.SESSION_SECRET,
    salt: env.SESSION_SALT,
    cookie: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production"
    }
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

  // Initialize Session Store
  const sessionStore = new SessionStore();

  // Initialize CDC Auth Service
  const cdcAuth = new CDCAuthService(env);

  // Initialize Gigya REST Service
  const gigyaRest = new GigyaRestService(env);

  // Register routes
  await registerCatalogRoutes(app, commerce);
  
  // OLD COOKIE-BASED SESSION SYSTEM (DEPRECATED)
  // Uncomment the line below to switch back to the old cookie-based authentication system
  // This uses session_access/session_refresh cookies instead of Gigya CDC
  // Routes: /auth/session/check, /session, /session/logout
  // await registerSessionRoutes(app, commerce);
  await registerOidcRoutes(app, env);
  await registerOidcDiscoveryProxyRoutes(app);

  // Register new authentication flow routes
  await registerAuthFlowRoutes(app, env, sessionStore);
  await registerUserProtectedRoutes(app, sessionStore, cdcAuth);
  
  // Register session-based auth routes
  await app.register(authRoutes, { prefix: '/auth' });
  
  // Register CMS routes
  await registerCMSRoutes(app);
  
  // Register Gigya Dev routes (Python SDK)
  await app.register(gigyaDevRoutes, { prefix: '/gigya-dev' });

  // Register CDC session routes (NEW GIGYA CDC SYSTEM - ACTIVE)
  await registerSessionCdcRoutes(app, gigyaRest);

  return { app, env };
}
