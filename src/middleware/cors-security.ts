import type { FastifyRequest, FastifyReply } from "fastify";
import type { AppEnv } from "../config/env.js";

/**
 * Enhanced CORS Security Middleware
 * 
 * Provides secure CORS configuration with additional security features:
 * - Strict origin validation
 * - Preflight request handling
 * - Credential support for authentication flows
 * - Security headers for CORS responses
 * - Request method and header validation
 */

export interface CORSSecurityOptions {
  env: AppEnv;
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  preflightContinue?: boolean;
}

/**
 * Parse and validate allowed origins from environment
 */
export function parseAllowedOrigins(corsOrigins: string): Set<string> {
  return new Set(
    corsOrigins
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

/**
 * Validate if origin is allowed
 * 
 * @param origin - Request origin header
 * @param allowedOrigins - Set of allowed origins
 * @returns true if origin is allowed
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: Set<string>
): boolean {
  // No origin header (same-origin request or non-browser client)
  if (!origin) {
    return true;
  }

  // Exact match
  if (allowedOrigins.has(origin)) {
    return true;
  }

  // Check for wildcard subdomain support (e.g., *.example.com)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith("*.")) {
      const domain = allowed.slice(2); // Remove "*."
      if (origin.endsWith(`.${domain}`) || origin === `https://${domain}`) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get CORS configuration for Fastify
 * 
 * Returns configuration object for @fastify/cors plugin
 */
export function getCORSConfig(options: CORSSecurityOptions) {
  const allowedOrigins = parseAllowedOrigins(options.env.CORS_ALLOW_ORIGINS);

  return {
    // Origin validation
    origin: (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy`), false);
      }
    },

    // Credentials support (required for cookies, authorization headers)
    credentials: true,

    // Allowed HTTP methods
    methods: options.allowedMethods || [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    // Allowed request headers
    allowedHeaders: options.allowedHeaders || [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "X-CSRF-Token",
      "X-Session-ID",
    ],

    // Exposed response headers (accessible to frontend)
    exposedHeaders: options.exposedHeaders || [
      "X-Total-Count",
      "X-Page-Count",
      "X-Session-ID",
      "X-Request-ID",
    ],

    // Preflight cache duration (seconds)
    maxAge: options.maxAge || 86400, // 24 hours

    // Continue to next handler after preflight
    preflightContinue: options.preflightContinue || false,

    // Opt-in to new behavior
    strictPreflight: true,

    // Hide CORS options from error responses
    hideOptionsRoute: true,
  };
}

/**
 * Additional security headers for CORS responses
 * 
 * These headers provide additional protection against common attacks
 */
export function addSecurityHeaders(reply: FastifyReply): void {
  // Prevent MIME type sniffing
  reply.header("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  reply.header("X-Frame-Options", "DENY");

  // XSS Protection (legacy, but still useful)
  reply.header("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy (restrict browser features)
  reply.header(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  );
}

/**
 * Fastify hook for CORS security
 * 
 * Adds security headers to all responses
 */
export async function corsSecurityHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  addSecurityHeaders(reply);
}

/**
 * Validate CORS preflight request
 * 
 * Ensures preflight requests contain required headers
 */
export function validatePreflightRequest(request: FastifyRequest): {
  valid: boolean;
  error?: string;
} {
  const origin = request.headers.origin;
  const method = request.headers["access-control-request-method"];

  if (!origin) {
    return {
      valid: false,
      error: "Missing Origin header in preflight request",
    };
  }

  if (!method) {
    return {
      valid: false,
      error: "Missing Access-Control-Request-Method header in preflight request",
    };
  }

  return { valid: true };
}

/**
 * Log CORS violations for monitoring
 * 
 * Helps identify potential security issues or misconfigurations
 */
export function logCORSViolation(
  request: FastifyRequest,
  reason: string
): void {
  request.log.warn({
    msg: "CORS violation detected",
    origin: request.headers.origin,
    method: request.method,
    url: request.url,
    reason,
    ip: request.ip,
    userAgent: request.headers["user-agent"],
  });
}

/**
 * CORS error handler
 * 
 * Provides detailed error responses for CORS issues
 */
export function handleCORSError(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const origin = request.headers.origin;

  logCORSViolation(request, error.message);

  reply.code(403).send({
    error: "Forbidden",
    message: "CORS policy violation",
    statusCode: 403,
    // Only include details in development
    ...(process.env.NODE_ENV !== "production" && {
      details: error.message,
      origin,
    }),
  });
}
