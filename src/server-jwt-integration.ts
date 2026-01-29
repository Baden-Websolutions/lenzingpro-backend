/**
 * JWT Authentication Flow Integration
 * 
 * This file shows how to integrate the JWT auth flow into server.ts
 * WITHOUT modifying the existing server.ts file
 * 
 * USAGE:
 * ------
 * In server.ts, add these lines after the existing route registrations:
 * 
 * import { registerJWTAuthFlowRoutes } from "./routes/jwt-auth-flow.js";
 * import { registerJWTProtectedRoutes } from "./routes/jwt-protected.js";
 * 
 * // Register JWT authentication flow routes (after line 73)
 * await registerJWTAuthFlowRoutes(app, env, sessionStore);
 * await registerJWTProtectedRoutes(app, sessionStore);
 * 
 * That's it! No other changes needed.
 */

import type { FastifyInstance } from "fastify";
import type { AppEnv } from "./config/env.js";
import type { SessionStore } from "./services/session-store.js";
import { registerJWTAuthFlowRoutes } from "./routes/jwt-auth-flow.js";
import { registerJWTProtectedRoutes } from "./routes/jwt-protected.js";

/**
 * Register all JWT authentication routes
 * 
 * This is a convenience function that registers all JWT auth routes
 * Can be called from server.ts with a single line
 */
export async function registerJWTAuthentication(
  app: FastifyInstance,
  env: AppEnv,
  sessionStore: SessionStore
) {
  await registerJWTAuthFlowRoutes(app, env, sessionStore);
  await registerJWTProtectedRoutes(app, sessionStore);
  
  app.log.info("JWT Authentication fully integrated");
}
