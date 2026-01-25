import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3002),
  NODE_ENV: z.string().default("development"),

  COMMERCE_BASE_URL: z.string().url(),
  COMMERCE_BASE_SITE: z.string().min(1),
  COMMERCE_CLIENT_ID: z.string().min(1),
  COMMERCE_CLIENT_SECRET: z.string().min(1),

  FRONTEND_BASE_URL: z.string().url().default("https://mtna-lp.dev"),
  OIDC_CALLBACK_PATH: z.string().default("/oidc/callback"),

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
