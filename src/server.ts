import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { loadEnv } from "./config/env.js";
import { CommerceClient } from "./services/commerce.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerSessionRoutes } from "./routes/session.js";
import { registerOidcRoutes } from "./routes/oidc.js";

export async function buildServer() {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport: env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" }
    }
  });

  await app.register(helmet, { global: true });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW_MS
  });

  const allowed = env.CORS_ALLOW_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true
  });

  app.get("/health", async () => ({ ok: true }));

  const commerce = new CommerceClient(env);
  await registerCatalogRoutes(app, commerce);
  await registerSessionRoutes(app);
  await registerOidcRoutes(app, env);

  return { app, env };
}
