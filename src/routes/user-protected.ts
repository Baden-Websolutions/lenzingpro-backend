import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SessionStore } from "../services/session-store.js";
import type { CDCAuthService } from "../services/cdc-auth.js";
import { createAuthHook } from "../middleware/auth-fastify.js";
import {
  createGigyaSignatureValidator,
  createUIDMatchValidator,
} from "../middleware/gigya-signature.js";

/**
 * Register Protected User Routes
 */
export async function registerUserProtectedRoutes(
  app: FastifyInstance,
  sessionStore: SessionStore,
  cdcAuth: CDCAuthService
) {
  const requireAuth = createAuthHook(sessionStore);
  const validateGigyaSignature = createGigyaSignatureValidator(cdcAuth);
  const validateUIDMatch = createUIDMatchValidator();

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
        app.log.error({ err: error }, "Profile fetch error:");
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
        app.log.error({ err: error }, "User info error:");
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
        app.log.error({ err: error }, "Preferences fetch error:");
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
        app.log.error({ err: error }, "Preferences update error:");
        return reply.status(500).send({
          error: "preferences_update_failed",
          message: "Failed to update preferences",
        });
      }
    }
  );

  /**
   * GET /user/sensitive-data
   * Example route requiring both session AND Gigya signature validation
   * This demonstrates enhanced security for critical operations
   */
  app.get(
    "/user/sensitive-data",
    { preHandler: [requireAuth, validateGigyaSignature, validateUIDMatch] },
    async (request: FastifyRequest, reply: FastifyReply) => {      
      try {
        const gigyaUID = request.gigyaUID;
        
        // At this point, we have:
        // 1. Valid session (requireAuth)
        // 2. Valid Gigya signature (validateGigyaSignature)
        // 3. Matching UIDs (validateUIDMatch)
        
        return reply.send({
          message: "This is sensitive data protected by signature validation",
          uid: gigyaUID,
          validated: request.gigyaValidated,
          data: {
            // Example sensitive data
            accountBalance: 1000.00,
            ssn: "***-**-1234",
          },
        });
      } catch (error) {
        app.log.error({ err: error }, "Sensitive data fetch error:");
        return reply.status(500).send({
          error: "sensitive_data_fetch_failed",
          message: "Failed to fetch sensitive data",
        });
      }
    }
  );

  /**
   * POST /user/delete-account
   * Critical operation requiring signature validation
   */
  app.post(
    "/user/delete-account",
    { preHandler: [requireAuth, validateGigyaSignature, validateUIDMatch] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const uid = request.gigyaUID;
        
        // TODO: Implement actual account deletion logic
        // This would typically involve:
        // 1. Deleting user data from database
        // 2. Calling CDC API to delete account
        // 3. Invalidating all sessions
        
        app.log.info(`Account deletion requested for UID: ${uid}`);
        
        // Delete all sessions for this user
        const deletedSessions = sessionStore.deleteAllForUser(uid!);
        
        return reply.send({
          success: true,
          message: "Account deletion initiated",
          sessionsDeleted: deletedSessions,
        });
      } catch (error) {
        app.log.error({ err: error }, "Account deletion error:");
        return reply.status(500).send({
          error: "account_deletion_failed",
          message: "Failed to delete account",
        });
      }
    }
  );
}
