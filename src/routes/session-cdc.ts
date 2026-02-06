import type { FastifyInstance } from "fastify";
import type { GigyaRestService } from "../services/gigya-rest.js";

export async function registerSessionCdcRoutes(
  app: FastifyInstance,
  gigyaRest: GigyaRestService
) {
  /**
   * POST /session/cdc
   * Accepts CDC JWT from frontend, validates it, and starts app session
   */
  app.post("/session/cdc", async (request, reply) => {
    const body = request.body as { idToken?: string };
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string") {
      return reply.code(400).send({ error: "missing idToken" });
    }

    try {
      // Verify JWT with CDC public key
      const { payload } = await gigyaRest.verifyCdcJwt(idToken);

      // Extract UID from payload
      const uid = (payload as any).UID || (payload as any).uid || (payload as any).sub;
      
      if (!uid) {
        return reply.code(401).send({ error: "token missing UID/sub" });
      }

      // Set session data
      request.session.set("uid", uid);
      request.session.set("cdc", {
        iat: (payload as any).iat,
        exp: (payload as any).exp
      });

      app.log.info({ uid }, "CDC session established");

      return reply.send({ ok: true, uid });
    } catch (error) {
      app.log.error({ error }, "CDC JWT verification failed");
      return reply.code(401).send({ 
        error: "invalid token",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /session/me
   * Returns current user from session (optionally fetches fresh data from CDC)
   */
  app.get("/session/me", async (request, reply) => {
    const uid = request.session.get("uid");

    if (!uid) {
      return reply.code(401).send({ authenticated: false });
    }

    try {
      // Optional: Fetch fresh account data from CDC
      const account = await gigyaRest.getAccountInfo(uid);

      return reply.send({
        authenticated: true,
        uid,
        profile: account?.profile || {},
        data: account?.data || {}
      });
    } catch (error) {
      app.log.error({ error, uid }, "Failed to fetch account info");
      
      // Return basic session info even if CDC call fails
      return reply.send({
        authenticated: true,
        uid,
        profile: {},
        data: {}
      });
    }
  });

  /**
   * POST /session/logout
   * Deletes app session
   */
  app.post("/session/logout", async (request, reply) => {
    const uid = request.session.get("uid");
    
    if (uid) {
      app.log.info({ uid }, "User logged out");
    }

    request.session.delete();

    return reply.send({ ok: true });
  });

  /**
   * GET /session/check
   * Simple session check endpoint (for page protection)
   */
  app.get("/session/check", async (request, reply) => {
    const uid = request.session.get("uid");

    return reply.send({
      authenticated: !!uid,
      uid: uid || null
    });
  });

  /**
   * GET /auth/session/check
   * Backward compatibility endpoint for frontend AccountMenu component
   * Returns isLoggedIn instead of authenticated for legacy compatibility
   */
  app.get("/auth/session/check", async (request, reply) => {
    const uid = request.session.get("uid");

    return reply.send({
      isLoggedIn: !!uid,
      uid: uid || null
    });
  });
}
