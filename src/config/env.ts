import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
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
  CDC_SECRET_KEY: z.string().optional(), // Base64-encoded secret key for signature validation

  // Gigya REST API Configuration
  GIGYA_API_KEY: z.string().min(1).default("4_XQnjjmLc16oS7vqA6DvIAg"),
  GIGYA_SECRET: z.string().min(1),
  GIGYA_USER_KEY: z.string().min(1).default("ABbd672Koy3U"),
  GIGYA_DATA_CENTER: z.string().default("eu1"),

  // Session Configuration
  SESSION_SECRET: z.string().min(32),
  SESSION_SALT: z.string().min(16),

  // Frontend & Callback Configuration
  FRONTEND_BASE_URL: z.string().url().default("https://mtna-lp.dev"),
  OIDC_CALLBACK_PATH: z.string().default("/oidc/callback"),
  OIDC_REDIRECT_URI: z.string().url().default("https://api.mtna-lp.dev/occ"),

  // CORS & Rate Limiting
  CORS_ALLOW_ORIGINS: z.string().default("https://mtna-lp.dev,https://www.mtna-lp.dev"),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  RATE_LIMIT_TIME_WINDOW_MS: z.coerce.number().default(60000)
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
