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
import { SessionStore } from "./services/session-store.js";
import { CDCAuthService } from "./services/cdc-auth.js";
import { registerAuthFlowRoutes } from "./routes/auth-flow.js";
import { registerUserProtectedRoutes } from "./routes/user-protected.js";
import {
  getCORSConfig,
  corsSecurityHook,
  handleCORSError,
  type CORSSecurityOptions,
} from "./middleware/cors-security.js";

/**
 * Enhanced Server Builder with Advanced CORS Security
 * 
 * This version includes:
 * - Strict CORS origin validation
 * - Additional security headers
 * - CORS violation logging
 * - Enhanced error handling
 * - Support for Gigya SDK operations
 */
export async function buildServerEnhanced() {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport: env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
    },
    // Increase body size limit for Gigya SDK operations
    bodyLimit: 1048576, // 1MB
    // Trust proxy headers (required for correct IP detection behind nginx)
    trustProxy: true,
  });

  // ============================================================================
  // SECURITY: Helmet with Custom CSP
  // ============================================================================
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Required for some CDC widgets
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://fidm.eu1.gigya.com",
          "https://accounts.eu1.gigya.com",
          env.COMMERCE_BASE_URL,
        ],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for some CDC operations
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // ============================================================================
  // RATE LIMITING: Protection against abuse
  // ============================================================================
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW_MS,
    // Custom error response
    errorResponseBuilder: (request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
    }),
    // Add rate limit headers
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });

  // ============================================================================
  // COOKIE SUPPORT: Required for OIDC flow and session management
  // ============================================================================
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || "lenzingpro-cookie-secret-change-in-production",
    parseOptions: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax", // Protection against CSRF
      path: "/",
      maxAge: 86400, // 24 hours
    },
  });

  // ============================================================================
  // ENHANCED CORS CONFIGURATION
  // ============================================================================
  const corsOptions: CORSSecurityOptions = {
    env,
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "X-CSRF-Token",
      "X-Session-ID",
      "X-Gigya-Signature", // For Gigya SDK signature validation
      "X-Gigya-Timestamp",
      "X-Gigya-UID",
    ],
    exposedHeaders: [
      "X-Total-Count",
      "X-Page-Count",
      "X-Session-ID",
      "X-Request-ID",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
  };

  await app.register(cors, getCORSConfig(corsOptions));

  // ============================================================================
  // SECURITY HOOKS: Additional security headers for all responses
  // ============================================================================
  app.addHook("onRequest", corsSecurityHook);

  // ============================================================================
  // ERROR HANDLING: Enhanced CORS error handling
  // ============================================================================
  app.setErrorHandler((error, request, reply) => {
    // Handle CORS errors specifically
    if (error.message.includes("CORS") || error.message.includes("Origin")) {
      return handleCORSError(error, request, reply);
    }

    // Handle rate limit errors
    if (error.statusCode === 429) {
      return reply.code(429).send({
        error: "Too Many Requests",
        message: error.message,
        statusCode: 429,
      });
    }

    // Log error
    request.log.error({
      msg: "Unhandled error",
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    // Generic error response
    reply.code(error.statusCode || 500).send({
      error: error.name || "Internal Server Error",
      message: env.NODE_ENV === "production" 
        ? "An error occurred processing your request" 
        : error.message,
      statusCode: error.statusCode || 500,
    });
  });

  // ============================================================================
  // REQUEST LOGGING: Log all requests for monitoring
  // ============================================================================
  app.addHook("onRequest", async (request, reply) => {
    request.log.info({
      msg: "Incoming request",
      method: request.method,
      url: request.url,
      origin: request.headers.origin,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
  });

  // ============================================================================
  // RESPONSE LOGGING: Log all responses for monitoring
  // ============================================================================
  app.addHook("onResponse", async (request, reply) => {
    request.log.info({
      msg: "Response sent",
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
    });
  });

  // ============================================================================
  // HEALTH CHECK: Simple endpoint for monitoring
  // ============================================================================
  app.get("/health", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            timestamp: { type: "string" },
            uptime: { type: "number" },
          },
        },
      },
    },
  }, async () => ({
    ok: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // ============================================================================
  // SERVICE INITIALIZATION
  // ============================================================================
  
  // Initialize Commerce client
  const commerce = new CommerceClient(env);

  // Initialize Session Store
  const sessionStore = new SessionStore();

  // Initialize CDC Auth Service (with Gigya SDK)
  const cdcAuth = new CDCAuthService(env);

  // Log Gigya SDK status
  if (cdcAuth.hasGigyaSDK()) {
    app.log.info("Gigya SDK initialized - signature validation enabled");
  } else {
    app.log.warn("Gigya SDK not initialized - CDC_SECRET_KEY missing");
  }

  // ============================================================================
  // ROUTE REGISTRATION
  // ============================================================================
  
  // Public routes (no authentication required)
  await registerCatalogRoutes(app, commerce);
  await registerSessionRoutes(app, commerce);
  await registerOidcRoutes(app, env);
  await registerOidcDiscoveryProxyRoutes(app);

  // Authentication flow routes
  await registerAuthFlowRoutes(app, env, sessionStore);
  
  // Protected routes (authentication required)
  await registerUserProtectedRoutes(app, sessionStore, cdcAuth);

  // ============================================================================
  // STARTUP VALIDATION
  // ============================================================================
  
  // Validate critical environment variables
  if (!env.CDC_SECRET_KEY) {
    app.log.warn(
      "⚠️  CDC_SECRET_KEY not set - Gigya signature validation disabled. " +
      "This is a security risk in production!"
    );
  }

  if (env.NODE_ENV === "production") {
    if (process.env.COOKIE_SECRET === "lenzingpro-cookie-secret-change-in-production") {
      app.log.error(
        "🚨 SECURITY RISK: Default COOKIE_SECRET detected in production! " +
        "Change this immediately!"
      );
    }

    if (env.CORS_ALLOW_ORIGINS.includes("localhost") || env.CORS_ALLOW_ORIGINS.includes("127.0.0.1")) {
      app.log.warn(
        "⚠️  CORS allows localhost in production - this may be a security risk"
      );
    }
  }

  app.log.info({
    msg: "Server configuration complete",
    environment: env.NODE_ENV,
    port: env.PORT,
    corsOrigins: env.CORS_ALLOW_ORIGINS,
    rateLimit: `${env.RATE_LIMIT_MAX} requests per ${env.RATE_LIMIT_TIME_WINDOW_MS}ms`,
  });

  return { app, env };
}
