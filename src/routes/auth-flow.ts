import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppEnv } from "../config/env.js";
import { CDCAuthService } from "../services/cdc-auth.js";
import { SessionStore } from "../services/session-store.js";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "../utils/pkce.js";
import crypto from "crypto";

// Temporary storage for PKCE verifiers and states
// In production, use Redis or encrypted cookies
const pendingAuth = new Map<
  string,
  { codeVerifier: string; state: string; createdAt: number }
>();

/**
 * Register Authentication Flow Routes
 */
export async function registerAuthFlowRoutes(
  app: FastifyInstance,
  env: AppEnv,
  sessionStore: SessionStore
) {
  const cdcAuth = new CDCAuthService(env);

  /**
   * GET /auth/login
   * Initiates the OAuth2 Authorization Code Flow with PKCE
   */
  app.get("/auth/login", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = generateState();

      // Store PKCE verifier and state temporarily
      const authId = crypto.randomBytes(16).toString("hex");
      pendingAuth.set(authId, {
        codeVerifier,
        state,
        createdAt: Date.now(),
      });

      // Set auth ID in cookie for callback
      reply.setCookie("auth_id", authId, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60, // 10 minutes (in seconds for Fastify)
        path: "/",
      });

      // Build redirect URI
      const redirectUri = `${env.OIDC_REDIRECT_URI}${env.OIDC_CALLBACK_PATH}`;

      // Get authorization URL
      const authUrl = cdcAuth.getAuthorizationUrl(
        redirectUri,
        state,
        codeChallenge,
        "openid profile email uid"
      );

      // Redirect to CDC authorization endpoint
      return reply.redirect(authUrl);
    } catch (error) {
      app.log.error({ err: error }, "Login initiation error:");
      return reply.status(500).send({
        error: "login_failed",
        message: "Failed to initiate login",
      });
    }
  });

  /**
   * GET /auth/callback
   * Handles the OAuth2 callback from CDC
   */
  app.get<{
    Querystring: {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
  }>("/auth/callback", async (request, reply) => {
    try {
      const { code, state, error, error_description } = request.query;

      // Check for OAuth errors
      if (error) {
        app.log.error({ err: error, error_description }, "OAuth error:");
        return reply.redirect(`${env.FRONTEND_BASE_URL}/login?error=${error}`);
      }

      // Validate required parameters
      if (!code) {
        return reply.status(400).send({
          error: "invalid_request",
          message: "Missing authorization code",
        });
      }

      if (!state) {
        return reply.status(400).send({
          error: "invalid_request",
          message: "Missing state parameter",
        });
      }

      // Get auth ID from cookie
      const authId = request.cookies.auth_id;
      if (!authId) {
        return reply.status(400).send({
          error: "invalid_request",
          message: "Missing auth session",
        });
      }

      // Retrieve PKCE verifier and state
      const authData = pendingAuth.get(authId);
      if (!authData) {
        return reply.status(400).send({
          error: "invalid_request",
          message: "Invalid or expired auth session",
        });
      }

      // Validate state parameter (CSRF protection)
      if (state !== authData.state) {
        return reply.status(400).send({
          error: "invalid_state",
          message: "State parameter mismatch",
        });
      }

      // Clean up pending auth
      pendingAuth.delete(authId);
      reply.clearCookie("auth_id");

      // Exchange authorization code for tokens
      const redirectUri = `${env.OIDC_REDIRECT_URI}${env.OIDC_CALLBACK_PATH}`;
      const tokenResponse = await cdcAuth.exchangeCodeForTokens(
        code,
        redirectUri,
        authData.codeVerifier
      );

      // Get user info
      const userInfo = await cdcAuth.getUserInfo(tokenResponse.access_token);

      // Create session
      const sessionId = crypto.randomBytes(32).toString("hex");
      const sessionData = cdcAuth.createSessionData(tokenResponse, userInfo);
      sessionStore.set(sessionId, sessionData);

      // Set session cookie
      reply.setCookie("session_id", sessionId, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60, // 24 hours (in seconds)
        path: "/",
      });

      // Redirect to frontend
      return reply.redirect(`${env.FRONTEND_BASE_URL}/`);
    } catch (error) {
      app.log.error({ err: error }, "Callback error:");
      return reply.redirect(`${env.FRONTEND_BASE_URL}/login?error=callback_failed`);
    }
  });

  /**
   * POST /auth/logout
   * Logs out the user and clears session
   * 
   * NOTE: This route is now handled by auth.ts with /auth prefix
   * Commented out to avoid duplicate route registration error
   */
  /*
  app.post("/auth/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sessionId = request.cookies.session_id;

      if (sessionId) {
        sessionStore.delete(sessionId);
      }

      reply.clearCookie("session_id");

      return reply.send({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      app.log.error({ err: error }, "Logout error:");
      return reply.status(500).send({
        error: "logout_failed",
        message: "Failed to logout",
      });
    }
  });
  */

  /**
   * GET /auth/session
   * Returns current session info
   * 
   * NOTE: This route is now handled by auth.ts with /auth prefix
   * Commented out to avoid duplicate route registration error
   */
  /*
//   app.get("/auth/session", async (request: FastifyRequest, reply: FastifyReply) => {
//     try {
//       const sessionId = request.cookies.session_id;
// 
//       if (!sessionId) {
//         return reply.status(401).send({
//           authenticated: false,
//           message: "No session found",
//         });
//       }
// 
//       const session = sessionStore.get(sessionId);
// 
//       if (!session) {
//         reply.clearCookie("session_id");
//         return reply.status(401).send({
//           authenticated: false,
//           message: "Invalid session",
//         });
//       }
// 
//       // Check if session is expired
//       if (cdcAuth.isSessionExpired(session)) {
//         // Try to refresh token
//         if (session.refreshToken) {
//           try {
//             const tokenResponse = await cdcAuth.refreshAccessToken(session.refreshToken);
//             const userInfo = await cdcAuth.getUserInfo(tokenResponse.access_token);
//             const newSessionData = cdcAuth.createSessionData(tokenResponse, userInfo);
//             sessionStore.set(sessionId, newSessionData);
// 
//             return reply.send({
//               authenticated: true,
//               user: newSessionData.userInfo,
//             });
//           } catch (refreshError) {
//             app.log.error({ err: refreshError }, "Token refresh failed:");
//             sessionStore.delete(sessionId);
//             reply.clearCookie("session_id");
//             return reply.status(401).send({
//               authenticated: false,
//               message: "Session expired",
//             });
//           }
//         } else {
//           sessionStore.delete(sessionId);
//           reply.clearCookie("session_id");
//           return reply.status(401).send({
//             authenticated: false,
//             message: "Session expired",
          });
        }
      }

      return reply.send({
        authenticated: true,
        user: session.userInfo,
      });
    } catch (error) {
      app.log.error({ err: error }, "Session check error:");
      return reply.status(500).send({
        error: "session_check_failed",
        message: "Failed to check session",
      });
    }
  });
  */

  /**
   * POST /auth/refresh
   * Manually refresh access token
   */
  app.post("/auth/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sessionId = request.cookies.session_id;

      if (!sessionId) {
        return reply.status(401).send({
          error: "no_session",
          message: "No session found",
        });
      }

      const session = sessionStore.get(sessionId);

      if (!session || !session.refreshToken) {
        return reply.status(401).send({
          error: "invalid_session",
          message: "Invalid session or no refresh token",
        });
      }

      const tokenResponse = await cdcAuth.refreshAccessToken(session.refreshToken);
      const userInfo = await cdcAuth.getUserInfo(tokenResponse.access_token);
      const newSessionData = cdcAuth.createSessionData(tokenResponse, userInfo);
      sessionStore.set(sessionId, newSessionData);

      return reply.send({
        success: true,
        message: "Token refreshed successfully",
      });
    } catch (error) {
      app.log.error({ err: error }, "Token refresh error:");
      return reply.status(500).send({
        error: "refresh_failed",
        message: "Failed to refresh token",
      });
    }
  });

  // Clean up expired pending auth sessions periodically
  setInterval(() => {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [authId, data] of pendingAuth.entries()) {
      if (now - data.createdAt > maxAge) {
        pendingAuth.delete(authId);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Clean up expired sessions periodically
  setInterval(() => {
    const cleaned = sessionStore.cleanExpired();
    if (cleaned > 0) {
      app.log.info(`Cleaned ${cleaned} expired sessions`);
    }
  }, 15 * 60 * 1000); // Every 15 minutes
}
