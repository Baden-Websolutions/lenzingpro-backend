import { FastifyInstance } from "fastify";
import type { CommerceClient } from "../services/commerce.js";

export async function registerSessionRoutes(app: FastifyInstance, commerce?: CommerceClient) {
  app.get("/session", async (req, reply) => {
    const accessToken = req.cookies.session_access;
    if (!accessToken) {
      reply.header("Cache-Control", "no-store");
      return { authenticated: false };
    }

    try {
      const user = await commerce!.getCurrentUser(String(accessToken));
      reply.header("Cache-Control", "no-store");
      return { authenticated: true, user };
    } catch (err: any) {
      reply.clearCookie("session_access");
      reply.clearCookie("session_refresh");
      reply.header("Cache-Control", "no-store");
      return { authenticated: false };
    }
  });

  app.post("/session/logout", async (_req, reply) => {
    reply.clearCookie("session_access");
    reply.clearCookie("session_refresh");
    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });
}
