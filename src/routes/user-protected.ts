import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SessionStore } from "../services/session-store.js";
import { createAuthHook } from "../middleware/auth-fastify.js";

/**
 * Register Protected User Routes
 */
export async function registerUserProtectedRoutes(
  app: FastifyInstance,
  sessionStore: SessionStore
) {
  const requireAuth = createAuthHook(sessionStore);

  /**
   * GET /user/profile
   * Get current user's profile (requires authentication)
   */
  app.get(
    "/user/profile",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            error: "unauthorized",
            message: "User not authenticated",
          });
        }

        return reply.send({
          user: request.user,
          session: {
            expiresAt: request.session?.expiresAt,
            hasRefreshToken: !!request.session?.refreshToken,
          },
        });
      } catch (error) {
        app.log.error("Profile fetch error:", error);
        return reply.status(500).send({
          error: "profile_fetch_failed",
          message: "Failed to fetch profile",
        });
      }
    }
  );

  /**
   * GET /user/me
   * Get current user info (requires authentication)
   */
  app.get(
    "/user/me",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send({
          authenticated: true,
          user: request.user,
        });
      } catch (error) {
        app.log.error("User info error:", error);
        return reply.status(500).send({
          error: "user_info_failed",
          message: "Failed to get user info",
        });
      }
    }
  );

  /**
   * GET /user/preferences
   * Get user preferences (example protected route)
   */
  app.get(
    "/user/preferences",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // TODO: Implement actual preferences storage
        return reply.send({
          preferences: {
            language: "en",
            theme: "light",
            notifications: true,
          },
        });
      } catch (error) {
        app.log.error("Preferences fetch error:", error);
        return reply.status(500).send({
          error: "preferences_fetch_failed",
          message: "Failed to fetch preferences",
        });
      }
    }
  );

  /**
   * PUT /user/preferences
   * Update user preferences (example protected route)
   */
  app.put<{
    Body: {
      language?: string;
      theme?: string;
      notifications?: boolean;
    };
  }>(
    "/user/preferences",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const { language, theme, notifications } = request.body;

        // TODO: Implement actual preferences storage
        return reply.send({
          success: true,
          preferences: {
            language,
            theme,
            notifications,
          },
        });
      } catch (error) {
        app.log.error("Preferences update error:", error);
        return reply.status(500).send({
          error: "preferences_update_failed",
          message: "Failed to update preferences",
        });
      }
    }
  );
}
