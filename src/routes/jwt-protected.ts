/**
 * JWT Protected Routes
 * 
 * Example routes that require JWT authentication
 * Parallel to existing user-protected.ts routes
 */

import type { FastifyInstance } from "fastify";
import type { SessionStore } from "../services/session-store.js";
import { jwtAuthMiddleware } from "../middleware/jwt-auth-middleware.js";

/**
 * Register JWT Protected Routes
 * 
 * These routes require valid JWT session
 */
export async function registerJWTProtectedRoutes(
  app: FastifyInstance,
  sessionStore: SessionStore
) {
  /**
   * GET /jwt-protected/profile
   * 
   * Get user profile from JWT session
   * 
   * Response:
   * {
   *   "userId": "...",
   *   "email": "...",
   *   "name": "...",
   *   "uid": "...",
   *   "sessionInfo": { ... }
   * }
   */
  app.get(
    "/jwt-protected/profile",
    {
      preHandler: jwtAuthMiddleware(sessionStore, app),
    },
    async (request, reply) => {
      const session = request.jwtSession!;

      return reply.send({
        userId: session.userId,
        email: session.email,
        name: session.name,
        uid: session.uid,
        sessionInfo: {
          createdAt: new Date(session.createdAt).toISOString(),
          lastAccessed: new Date(session.lastAccessed).toISOString(),
          tokenExpiry: new Date(session.commerceTokenExpiry).toISOString(),
        },
      });
    }
  );

  /**
   * GET /jwt-protected/commerce-token
   * 
   * Get Commerce Cloud access token for making API calls
   * 
   * Response:
   * {
   *   "accessToken": "...",
   *   "expiresAt": "2024-01-01T12:00:00.000Z"
   * }
   */
  app.get(
    "/jwt-protected/commerce-token",
    {
      preHandler: jwtAuthMiddleware(sessionStore, app),
    },
    async (request, reply) => {
      const session = request.jwtSession!;

      return reply.send({
        accessToken: session.commerceAccessToken,
        expiresAt: new Date(session.commerceTokenExpiry).toISOString(),
      });
    }
  );

  /**
   * POST /jwt-protected/test-commerce
   * 
   * Test endpoint to verify Commerce Cloud access
   * Makes a test call to Commerce Cloud API
   * 
   * Response:
   * {
   *   "success": true,
   *   "message": "Commerce Cloud access verified"
   * }
   */
  app.post(
    "/jwt-protected/test-commerce",
    {
      preHandler: jwtAuthMiddleware(sessionStore, app),
    },
    async (request, reply) => {
      const session = request.jwtSession!;

      try {
        // Example: Test Commerce Cloud API access
        // This would be replaced with actual Commerce Cloud endpoint
        const testUrl = `${process.env.COMMERCE_BASE_URL}/${process.env.COMMERCE_BASE_SITE}/users/current`;

        const response = await fetch(testUrl, {
          headers: {
            Authorization: `Bearer ${session.commerceAccessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Commerce API returned ${response.status}`);
        }

        return reply.send({
          success: true,
          message: "Commerce Cloud access verified",
          status: response.status,
        });
      } catch (error) {
        app.log.error("Commerce API test failed:", error);
        return reply.status(500).send({
          success: false,
          error: "commerce_test_failed",
          message: "Failed to verify Commerce Cloud access",
        });
      }
    }
  );

  app.log.info("JWT Protected routes registered");
}
