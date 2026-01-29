/**
 * JWT Authentication Middleware
 * 
 * Middleware to protect routes with JWT session authentication
 * Parallel to existing auth-fastify.ts middleware
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import type { SessionStore } from "../services/session-store.js";
import type { JWTSessionData } from "../types/jwt-auth.js";

/**
 * Extend Fastify request with JWT session data
 */
declare module "fastify" {
  interface FastifyRequest {
    jwtSession?: JWTSessionData;
  }
}

/**
 * JWT Authentication Middleware
 * 
 * Checks for valid JWT session and attaches session data to request
 * 
 * @param sessionStore - Session store instance
 * @returns Fastify preHandler hook
 */
export function jwtAuthMiddleware(sessionStore: SessionStore, app?: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies.jwt_session_id;

    if (!sessionId) {
      return reply.status(401).send({
        error: "unauthorized",
        message: "No JWT session found",
      });
    }

    const session = sessionStore.get(`jwt_${sessionId}`);

    if (!session) {
      reply.clearCookie("jwt_session_id");
      return reply.status(401).send({
        error: "unauthorized",
        message: "Invalid or expired JWT session",
      });
    }

    // Check if session is expired (Commerce token)
    const now = Date.now();
    const buffer = 60 * 1000; // 60 seconds buffer

    if (session.commerceTokenExpiry < now + buffer) {
      // Session expired and no automatic refresh in middleware
      // Client should call /jwt-auth/refresh or /jwt-auth/session
      sessionStore.delete(`jwt_${sessionId}`);
      reply.clearCookie("jwt_session_id");
      return reply.status(401).send({
        error: "session_expired",
        message: "Session expired, please refresh or login again",
      });
    }

    // Update last accessed time
    session.lastAccessed = now;
    sessionStore.set(`jwt_${sessionId}`, session);

    // Attach session to request
    request.jwtSession = session;
  };
}

/**
 * Optional JWT Authentication Middleware
 * 
 * Checks for JWT session but doesn't fail if not present
 * Useful for routes that work with or without authentication
 * 
 * @param sessionStore - Session store instance
 * @returns Fastify preHandler hook
 */
export function optionalJwtAuthMiddleware(sessionStore: SessionStore, app?: FastifyInstance) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies.jwt_session_id;

    if (!sessionId) {
      return; // No session, continue without auth
    }

    const session = sessionStore.get(`jwt_${sessionId}`);

    if (!session) {
      reply.clearCookie("jwt_session_id");
      return; // Invalid session, continue without auth
    }

    // Check if session is expired
    const now = Date.now();
    const buffer = 60 * 1000; // 60 seconds buffer

    if (session.commerceTokenExpiry < now + buffer) {
      sessionStore.delete(`jwt_${sessionId}`);
      reply.clearCookie("jwt_session_id");
      return; // Expired session, continue without auth
    }

    // Update last accessed time
    session.lastAccessed = now;
    sessionStore.set(`jwt_${sessionId}`, session);

    // Attach session to request
    request.jwtSession = session;
  };
}
