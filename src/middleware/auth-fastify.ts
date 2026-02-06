import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";
import type { SessionStore } from "../services/session-store.js";
import type { SessionData, CDCUserInfo } from "../services/cdc-auth.js";

/**
 * Extend Fastify Request to include user data
 * Note: session is already provided by @fastify/secure-session
 */
declare module "fastify" {
  interface FastifyRequest {
    user?: CDCUserInfo;
  }
}

/**
 * Authentication Hook for Fastify
 * Checks if user is authenticated and attaches session data to request
 */
export function createAuthHook(sessionStore: SessionStore) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies.session_id;

    if (!sessionId) {
      return reply.status(401).send({
        error: "unauthorized",
        message: "Authentication required",
      });
    }

    const session = sessionStore.get(sessionId);

    if (!session) {
      reply.clearCookie("session_id");
      return reply.status(401).send({
        error: "invalid_session",
        message: "Invalid or expired session",
      });
    }

    // Check if session is expired
    if (Date.now() >= session.expiresAt) {
      sessionStore.delete(sessionId);
      reply.clearCookie("session_id");
      return reply.status(401).send({
        error: "session_expired",
        message: "Session expired, please login again",
      });
    }

    // Attach session and user to request
    request.session = session;
    request.user = session.userInfo;
  };
}

/**
 * Optional Authentication Hook for Fastify
 * Attaches session data if available, but doesn't require authentication
 */
export function createOptionalAuthHook(sessionStore: SessionStore) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies.session_id;

    if (sessionId) {
      const session = sessionStore.get(sessionId);

      if (session && Date.now() < session.expiresAt) {
        request.session = session;
        request.user = session.userInfo;
      }
    }
  };
}

/**
 * Decorator to add auth helpers to Fastify instance
 */
export function registerAuthDecorators(sessionStore: SessionStore) {
  return {
    requireAuth: createAuthHook(sessionStore),
    optionalAuth: createOptionalAuthHook(sessionStore),
  };
}
