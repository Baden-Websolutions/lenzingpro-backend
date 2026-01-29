/**
 * JWT Authentication Flow Routes
 * 
 * Parallel authentication flow using JWT-Bearer token exchange
 * Does not modify existing auth-flow.ts routes
 * 
 * Based on SAP AppGyver pattern from:
 * https://github.com/SAP-samples/appgyver-auth-flows
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppEnv } from "../config/env.js";
import type { JWTAuthRequest, JWTAuthResponse } from "../types/jwt-auth.js";
import { JWTValidator } from "../middleware/jwt-validator.js";
import { JWTTokenExchangeService } from "../services/jwt-token-exchange.js";
import { SessionStore } from "../services/session-store.js";
import crypto from "crypto";

/**
 * Register JWT Authentication Flow Routes
 * 
 * New endpoints that don't conflict with existing /auth/* routes:
 * - POST /jwt-auth/login - Exchange JWT for session
 * - GET /jwt-auth/session - Check JWT session
 * - POST /jwt-auth/refresh - Refresh Commerce token
 * - POST /jwt-auth/logout - Logout JWT session
 */
export async function registerJWTAuthFlowRoutes(
  app: FastifyInstance,
  env: AppEnv,
  sessionStore: SessionStore
) {
  // Initialize JWT validator
  // These values should come from environment variables
  const jwtValidator = new JWTValidator(
    process.env.JWT_JWKS_URI || "https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg/v2.0/keys",
    process.env.JWT_ISSUER || "https://fidm.eu1.gigya.com/oidc/op/v1.0/4_XQnjjmLc16oS7vqA6DvIAg",
    process.env.JWT_AUDIENCE || env.CDC_OIDC_CLIENT_ID
  );

  // Initialize token exchange service
  const tokenExchange = new JWTTokenExchangeService(env);

  /**
   * POST /jwt-auth/login
   * 
   * Exchange JWT token for Commerce Cloud access token and create session
   * 
   * Request body:
   * {
   *   "jwt": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   * 
   * Response:
   * {
   *   "success": true,
   *   "sessionId": "...",
   *   "user": { ... }
   * }
   */
  app.post<{
    Body: JWTAuthRequest;
  }>("/jwt-auth/login", async (request, reply) => {
    try {
      const { jwt } = request.body;

      if (!jwt) {
        return reply.status(400).send({
          success: false,
          error: "missing_jwt",
          message: "JWT token is required",
        } as JWTAuthResponse);
      }

      // Validate JWT token
      const validation = await jwtValidator.validateToken(jwt);

      if (!validation.valid || !validation.payload) {
        app.log.warn({ detail: validation.error }, "JWT validation failed:");
        return reply.status(401).send({
          success: false,
          error: "invalid_jwt",
          message: validation.error || "Invalid JWT token",
        } as JWTAuthResponse);
      }

      // Exchange JWT for Commerce Cloud access token
      let commerceToken;
      try {
        commerceToken = await tokenExchange.exchangeJWTForCommerceToken(
          jwt,
          validation.payload
        );
      } catch (exchangeError) {
        app.log.error({ err: exchangeError }, "Token exchange failed:");
        return reply.status(500).send({
          success: false,
          error: "token_exchange_failed",
          message: "Failed to exchange JWT for Commerce token",
        } as JWTAuthResponse);
      }

      // Create session
      const sessionId = crypto.randomBytes(32).toString("hex");
      const sessionData = tokenExchange.createSessionData(
        jwt,
        validation.payload,
        commerceToken
      );

      // Store session with prefix to distinguish from CDC sessions
      sessionStore.set(`jwt_${sessionId}`, sessionData);

      // Set session cookie
      reply.setCookie("jwt_session_id", sessionId, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60, // 24 hours (in seconds)
        path: "/",
      });

      app.log.info(`JWT session created for user: ${validation.payload.sub}`);

      return reply.send({
        success: true,
        sessionId,
        user: {
          userId: validation.payload.sub,
          email: validation.payload.email,
          name: validation.payload.name,
          uid: validation.payload.uid,
        },
      } as JWTAuthResponse);
    } catch (error) {
      app.log.error({ err: error }, "JWT login error:");
      return reply.status(500).send({
        success: false,
        error: "login_failed",
        message: "Failed to process JWT login",
      } as JWTAuthResponse);
    }
  });

  /**
   * GET /jwt-auth/session
   * 
   * Check current JWT session status
   * 
   * Response:
   * {
   *   "authenticated": true,
   *   "user": { ... }
   * }
   */
  app.get("/jwt-auth/session", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sessionId = request.cookies.jwt_session_id;

      if (!sessionId) {
        return reply.status(401).send({
          authenticated: false,
          message: "No JWT session found",
        });
      }

      const session = sessionStore.get(`jwt_${sessionId}`);

      if (!session) {
        reply.clearCookie("jwt_session_id");
        return reply.status(401).send({
          authenticated: false,
          message: "Invalid JWT session",
        });
      }

      // Check if Commerce token is expired
      if (tokenExchange.isSessionExpired(session)) {
        // Try to refresh token if refresh token is available
        if (session.commerceRefreshToken) {
          try {
            const newCommerceToken = await tokenExchange.refreshCommerceToken(
              session.commerceRefreshToken
            );
            const updatedSession = tokenExchange.updateSessionWithRefreshedToken(
              session,
              newCommerceToken
            );
            sessionStore.set(`jwt_${sessionId}`, updatedSession);

            app.log.info(`JWT session refreshed for user: ${session.userId}`);

            return reply.send({
              authenticated: true,
              user: {
                userId: updatedSession.userId,
                email: updatedSession.email,
                name: updatedSession.name,
                uid: updatedSession.uid,
              },
            });
          } catch (refreshError) {
            app.log.error({ err: refreshError }, "Token refresh failed:");
            sessionStore.delete(`jwt_${sessionId}`);
            reply.clearCookie("jwt_session_id");
            return reply.status(401).send({
              authenticated: false,
              message: "Session expired and refresh failed",
            });
          }
        } else {
          // No refresh token available, session expired
          sessionStore.delete(`jwt_${sessionId}`);
          reply.clearCookie("jwt_session_id");
          return reply.status(401).send({
            authenticated: false,
            message: "Session expired",
          });
        }
      }

      // Update last accessed time
      session.lastAccessed = Date.now();
      sessionStore.set(`jwt_${sessionId}`, session);

      return reply.send({
        authenticated: true,
        user: {
          userId: session.userId,
          email: session.email,
          name: session.name,
          uid: session.uid,
        },
      });
    } catch (error) {
      app.log.error({ err: error }, "JWT session check error:");
      return reply.status(500).send({
        error: "session_check_failed",
        message: "Failed to check JWT session",
      });
    }
  });

  /**
   * POST /jwt-auth/refresh
   * 
   * Manually refresh Commerce Cloud access token
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Token refreshed successfully"
   * }
   */
  app.post("/jwt-auth/refresh", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sessionId = request.cookies.jwt_session_id;

      if (!sessionId) {
        return reply.status(401).send({
          error: "no_session",
          message: "No JWT session found",
        });
      }

      const session = sessionStore.get(`jwt_${sessionId}`);

      if (!session || !session.commerceRefreshToken) {
        return reply.status(401).send({
          error: "invalid_session",
          message: "Invalid session or no refresh token",
        });
      }

      const newCommerceToken = await tokenExchange.refreshCommerceToken(
        session.commerceRefreshToken
      );
      const updatedSession = tokenExchange.updateSessionWithRefreshedToken(
        session,
        newCommerceToken
      );
      sessionStore.set(`jwt_${sessionId}`, updatedSession);

      app.log.info(`JWT token manually refreshed for user: ${session.userId}`);

      return reply.send({
        success: true,
        message: "Token refreshed successfully",
      });
    } catch (error) {
      app.log.error({ err: error }, "JWT token refresh error:");
      return reply.status(500).send({
        error: "refresh_failed",
        message: "Failed to refresh token",
      });
    }
  });

  /**
   * POST /jwt-auth/logout
   * 
   * Logout and clear JWT session
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Logged out successfully"
   * }
   */
  app.post("/jwt-auth/logout", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const sessionId = request.cookies.jwt_session_id;

      if (sessionId) {
        sessionStore.delete(`jwt_${sessionId}`);
        app.log.info(`JWT session logged out: ${sessionId}`);
      }

      reply.clearCookie("jwt_session_id");

      return reply.send({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      app.log.error({ err: error }, "JWT logout error:");
      return reply.status(500).send({
        error: "logout_failed",
        message: "Failed to logout",
      });
    }
  });

  /**
   * GET /jwt-auth/cache-stats
   * 
   * Get token cache statistics (for debugging)
   * Only available in development mode
   */
  if (env.NODE_ENV !== "production") {
    app.get("/jwt-auth/cache-stats", async (request: FastifyRequest, reply: FastifyReply) => {
      const stats = tokenExchange.getCacheStats();
      return reply.send(stats);
    });
  }

  app.log.info("JWT Authentication Flow routes registered");
}
