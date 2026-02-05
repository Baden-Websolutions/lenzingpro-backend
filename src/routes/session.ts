import { FastifyInstance } from "fastify";
import type { CommerceClient } from "../services/commerce.js";

export async function registerSessionRoutes(app: FastifyInstance, commerce?: CommerceClient) {
  // New endpoint for frontend AccountMenu component
  app.get("/auth/session/check", async (req, reply) => {
    const accessToken = req.cookies.session_access;
    if (!accessToken) {
      reply.header("Cache-Control", "no-store");
      return { isLoggedIn: false };
    }

    try {
      // Verify token is valid by checking with commerce backend
      await commerce!.getCurrentUser(String(accessToken));
      reply.header("Cache-Control", "no-store");
      return { isLoggedIn: true };
    } catch (err: any) {
      // Token invalid, clear cookies
      reply.clearCookie("session_access");
      reply.clearCookie("session_refresh");
      reply.header("Cache-Control", "no-store");
      return { isLoggedIn: false };
    }
  });

  // Legacy endpoint (keep for backward compatibility)
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
