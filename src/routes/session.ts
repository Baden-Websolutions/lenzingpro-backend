import { FastifyInstance } from "fastify";
import type { CommerceClient } from "../services/commerce.js";

export async function registerSessionRoutes(app: FastifyInstance, commerce?: CommerceClient) {
  app.get("/session", async (req, reply) => {
    const accessToken = req.cookies.session_access;
    if (!accessToken) {
      reply.header("Cache-Control", "no-store");
      return { isLoggedIn: false, profile: null, error: null };
    }

    try {
      const user = await commerce!.getCurrentUser(String(accessToken));
      reply.header("Cache-Control", "no-store");
      return { isLoggedIn: true, profile: user, error: null };
    } catch (err: any) {
      reply.clearCookie("session_access");
      reply.clearCookie("session_refresh");
      reply.header("Cache-Control", "no-store");
      return { isLoggedIn: false, profile: null, error: 'Session expired' };
    }
  });

  app.post("/session/logout", async (_req, reply) => {
    reply.clearCookie("session_access");
    reply.clearCookie("session_refresh");
    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });

  // Alias for /logout (used by useAuth composable)
  app.post("/logout", async (_req, reply) => {
    reply.clearCookie("session_access");
    reply.clearCookie("session_refresh");
    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });
}
