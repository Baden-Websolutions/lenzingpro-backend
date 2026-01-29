import { FastifyInstance } from "fastify";
import type { CommerceClient } from "../services/commerce.js";

/**
 * Register session routes:
 * - GET /session: return current user info if authenticated
 * - POST /session/logout: clear session cookies
 */
export async function registerSessionRoutes(app: FastifyInstance, commerce: CommerceClient) {
  /**
   * GET /session
   * Return user info if authenticated via session cookie
   */
  app.get("/session", async (req, reply) => {
    const accessToken = req.cookies.session_access;

    if (!accessToken) {
      reply.header("Cache-Control", "no-store");
      return { authenticated: false };
    }

    try {
      const user = await commerce.getCurrentUser(String(accessToken));
      reply.header("Cache-Control", "no-store");
      return {
        authenticated: true,
        user
      };
    } catch (err: any) {
      // Token expired or invalid, clear cookies
      app.log.warn({ err }, "Session validation failed");
      reply.clearCookie("session_access");
      reply.clearCookie("session_refresh");
      reply.header("Cache-Control", "no-store");
      return { authenticated: false };
    }
  });

  /**
   * POST /session/logout
   * Clear session cookies
   */
  app.post("/session/logout", async (_req, reply) => {
    reply.clearCookie("session_access");
    reply.clearCookie("session_refresh");
    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });
}
