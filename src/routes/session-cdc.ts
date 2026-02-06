import type { FastifyInstance } from "fastify";
import type { GigyaRestService } from "../services/gigya-rest.js";

// Session data interface
interface SessionData {
  uid?: string;
  loginToken?: string;
  cdc?: {
    iat: number;
    exp: number;
  };
}

export async function registerSessionCdcRoutes(
  app: FastifyInstance,
  gigyaRest: GigyaRestService
) {
  /**
   * POST /session/login
   * Accepts loginToken from Gigya onLogin event, validates it, and starts app session
   */
  app.post("/session/login", async (request, reply) => {
    const body = request.body as { loginToken?: string; uid?: string };
    const { loginToken, uid } = body;

    if (!loginToken || typeof loginToken !== "string") {
      return reply.code(400).send({ error: "missing loginToken" });
    }

    if (!uid || typeof uid !== "string") {
      return reply.code(400).send({ error: "missing uid" });
    }

    try {
      // Verify loginToken with Gigya
      const accountInfo = await gigyaRest.getAccountInfo(uid, loginToken);

      if (!accountInfo.UID) {
        return reply.code(401).send({ error: "invalid loginToken" });
      }

      // Set session data - @fastify/secure-session stores everything in one object
      const sessionData: SessionData = { uid, loginToken };
      request.session.set("cookie", sessionData);

      app.log.info({ uid }, "Session established via loginToken");

      return reply.send({ ok: true, uid });
    } catch (error) {
      app.log.error({ error }, "LoginToken verification failed");
      return reply.code(401).send({ 
        error: "invalid loginToken",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

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
      const sessionData: SessionData = {
        uid,
        cdc: {
          iat: (payload as any).iat,
          exp: (payload as any).exp
        }
      };
      request.session.set("cookie", sessionData);

      app.log.info({ uid }, "CDC session established");

      return reply.send({ ok: true, uid });
    } catch (error) {
      app.log.error({ error }, "CDC JWT verification failed");
      return reply.code(401).send({ 
        error: "invalid JWT",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /session/check
   * Returns current session status
   */
  app.get("/session/check", async (request, reply) => {
    const sessionData = request.session.get("cookie") as SessionData | undefined;
    const uid = sessionData?.uid;

    if (!uid) {
      return reply.send({ authenticated: false, uid: null });
    }

    return reply.send({ authenticated: true, uid });
  });

  /**
   * GET /session/me
   * Returns current user profile from Gigya
   */
  app.get("/session/me", async (request, reply) => {
    const sessionData = request.session.get("cookie") as SessionData | undefined;
    const uid = sessionData?.uid;

    if (!uid) {
      return reply.code(401).send({ error: "not authenticated" });
    }

    try {
      const account = await gigyaRest.getAccountInfo(uid);
      return reply.send({ 
        uid: account.UID,
        profile: account.profile,
        email: account.profile?.email
      });
    } catch (error) {
      app.log.error({ error, uid }, "Failed to fetch user profile");
      return reply.code(500).send({ error: "failed to fetch profile" });
    }
  });

  /**
   * POST /session/logout
   * Destroys current session
   */
  app.post("/session/logout", async (request, reply) => {
    const sessionData = request.session.get("cookie") as SessionData | undefined;
    const uid = sessionData?.uid;

    if (!uid) {
      return reply.send({ ok: true, message: "no active session" });
    }

    // Clear session by setting empty object
    request.session.set("cookie", {});

    app.log.info({ uid }, "Session destroyed");

    return reply.send({ ok: true });
  });

  /**
   * GET /auth/session/check
   * Backward compatibility endpoint for old frontend code
   */
  app.get("/auth/session/check", async (request, reply) => {
    const sessionData = request.session.get("cookie") as SessionData | undefined;
    const uid = sessionData?.uid;

    return reply.send({ 
      isLoggedIn: !!uid, 
      uid: uid || null 
    });
  });

  /**
   * GET /auth/session
   * Backward compatibility endpoint for old frontend code
   */
  app.get("/auth/session", async (request, reply) => {
    const sessionData = request.session.get("cookie") as SessionData | undefined;
    const uid = sessionData?.uid;

    if (!uid) {
      return reply.send({ isLoggedIn: false });
    }

    try {
      const account = await gigyaRest.getAccountInfo(uid);
      return reply.send({
        isLoggedIn: true,
        profile: account.profile
      });
    } catch (error) {
      return reply.send({ isLoggedIn: false });
    }
  });
}
