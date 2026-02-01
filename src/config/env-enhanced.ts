import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

/**
 * Enhanced Environment Schema with Extended CORS Configuration
 * 
 * Adds support for:
 * - Wildcard subdomain CORS (*.example.com)
 * - Multiple CORS origin patterns
 * - Enhanced security settings
 */
const EnvSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().default(3002),
  NODE_ENV: z.string().default("development"),

  // SAP Commerce Cloud (OCC)
  COMMERCE_BASE_URL: z.string().url(),
  COMMERCE_BASE_SITE: z.string().min(1),
  COMMERCE_CLIENT_ID: z.string().min(1),
  COMMERCE_CLIENT_SECRET: z.string().min(1),

  // CDC (Gigya) OIDC Configuration
  CDC_BASE: z.string().url().default("https://fidm.eu1.gigya.com"),
  CDC_API_KEY: z.string().min(1).default("4_XQnjjmLc16oS7vqA6DvIAg"),
  CDC_OIDC_CLIENT_ID: z.string().min(1).default("ABbd672Koy3U"),
  
  // CDC Secret Key for Gigya SDK (Base64-encoded)
  // CRITICAL: Required for signature validation of Gigya SDK operations
  // Without this, signature validation will be disabled (security risk)
  CDC_SECRET_KEY: z.string().optional(),

  // Frontend & Callback Configuration
  FRONTEND_BASE_URL: z.string().url().default("https://mtna-lp.dev"),
  OIDC_CALLBACK_PATH: z.string().default("/oidc/callback"),
  OIDC_REDIRECT_URI: z.string().url().default("https://api.mtna-lp.dev/occ"),

  // CORS Configuration
  // Supports:
  // - Exact origins: https://example.com
  // - Wildcard subdomains: *.example.com
  // - Multiple origins: https://example.com,*.example.com,https://other.com
  CORS_ALLOW_ORIGINS: z
    .string()
    .default("https://mtna-lp.dev,https://www.mtna-lp.dev")
    .refine(
      (val) => {
        const origins = val.split(",").map((s) => s.trim()).filter(Boolean);
        return origins.length > 0;
      },
      { message: "At least one CORS origin must be specified" }
    ),

  // CORS Credentials Support (required for cookies and auth)
  CORS_ALLOW_CREDENTIALS: z.coerce.boolean().default(true),

  // Rate Limiting Configuration
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  RATE_LIMIT_TIME_WINDOW_MS: z.coerce.number().default(60000),

  // Cookie Configuration
  COOKIE_SECRET: z
    .string()
    .min(32, "Cookie secret must be at least 32 characters")
    .default("lenzingpro-cookie-secret-change-in-production"),
  
  COOKIE_SECURE: z.coerce.boolean().default(true),
  COOKIE_HTTP_ONLY: z.coerce.boolean().default(true),
  COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax"),
  COOKIE_MAX_AGE: z.coerce.number().default(86400), // 24 hours in seconds

  // Security Headers
  ENABLE_HSTS: z.coerce.boolean().default(true),
  HSTS_MAX_AGE: z.coerce.number().default(31536000), // 1 year in seconds
  ENABLE_CSP: z.coerce.boolean().default(true),

  // Logging
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  LOG_CORS_VIOLATIONS: z.coerce.boolean().default(true),

  // Gigya SDK Configuration
  GIGYA_SIGNATURE_EXPIRATION: z.coerce.number().default(300), // 5 minutes
  GIGYA_API_TIMEOUT: z.coerce.number().default(10000), // 10 seconds
});

export type AppEnv = z.infer<typeof EnvSchema>;

/**
 * Load and validate environment configuration
 * 
 * @throws Error if environment configuration is invalid
 * @returns Validated environment configuration
 */
export function loadEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const env = parsed.data;

  // Production security checks
  if (env.NODE_ENV === "production") {
    // Check for default cookie secret
    if (env.COOKIE_SECRET === "lenzingpro-cookie-secret-change-in-production") {
      console.error(
        "🚨 CRITICAL: Default COOKIE_SECRET in production! Change immediately!"
      );
      throw new Error("Default COOKIE_SECRET not allowed in production");
    }

    // Check for missing CDC secret key
    if (!env.CDC_SECRET_KEY) {
      console.warn(
        "⚠️  WARNING: CDC_SECRET_KEY not set in production. " +
        "Gigya signature validation will be disabled. " +
        "This is a security risk!"
      );
    }

    // Check for localhost in CORS origins
    if (
      env.CORS_ALLOW_ORIGINS.includes("localhost") ||
      env.CORS_ALLOW_ORIGINS.includes("127.0.0.1")
    ) {
      console.warn(
        "⚠️  WARNING: CORS allows localhost in production. " +
        "This may be a security risk!"
      );
    }

    // Ensure secure cookies in production
    if (!env.COOKIE_SECURE) {
      console.warn(
        "⚠️  WARNING: Cookies are not secure in production. " +
        "Set COOKIE_SECURE=true!"
      );
    }
  }

  return env;
}

/**
 * Validate CORS origin format
 * 
 * @param origin - Origin string to validate
 * @returns true if origin format is valid
 */
export function isValidCORSOrigin(origin: string): boolean {
  // Wildcard subdomain pattern
  if (origin.startsWith("*.")) {
    const domain = origin.slice(2);
    return /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(domain);
  }

  // Full URL pattern
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Get CORS origins as array
 * 
 * @param env - Environment configuration
 * @returns Array of CORS origins
 */
export function getCORSOrigins(env: AppEnv): string[] {
  return env.CORS_ALLOW_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isValidCORSOrigin);
}

/**
 * Check if environment is production
 */
export function isProduction(env: AppEnv): boolean {
  return env.NODE_ENV === "production";
}

/**
 * Check if environment is development
 */
export function isDevelopment(env: AppEnv): boolean {
  return env.NODE_ENV === "development";
}
