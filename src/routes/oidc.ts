import { FastifyInstance } from "fastify";
import { AppEnv } from "../config/env.js";

export async function registerOidcRoutes(app: FastifyInstance, env: AppEnv) {
  app.get(env.OIDC_CALLBACK_PATH, async (req, reply) => {
    const qs = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
    reply.header("Cache-Control", "no-store");
    return reply.redirect(302, `${env.FRONTEND_BASE_URL}/login${qs}`);
  });
}
