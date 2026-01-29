import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { OidcService } from "../services/oidc.js";
import type { AppEnv } from "../config/env.js";

/**
 * Register OIDC routes for PKCE flow:
 * - POST /oidc/authorize: initiate OIDC flow, return authorization URL
 * - GET /oidc/callback: handle authorization response, exchange code, create session
 * - POST /oidc/token/exchange: exchange authorization code for tokens (client-side PKCE)
 * - POST /oidc/commerce/token-exchange: exchange CDC token for Commerce token
 */
export async function registerOidcRoutes(app: FastifyInstance, env: AppEnv) {
  const oidcService = new OidcService(env);

  /**
   * POST /oidc/authorize
   * Generate PKCE parameters and return authorization URL
   * For server-side flow: stores state/nonce/verifier in cookies
   */
  app.post("/oidc/authorize", async (req, reply) => {
    const body = req.body as any;
    const returnTo = body?.returnTo ?? "/";
    
    const state = crypto.randomBytes(32).toString("base64url");
    const nonce = crypto.randomBytes(32).toString("base64url");
    const { verifier, challenge } = oidcService.generatePkce();

    // Set transient cookies for server-side flow
    reply.setCookie("oidc_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600 // 10 minutes
    });
    reply.setCookie("oidc_nonce", nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600
    });
    reply.setCookie("oidc_verifier", verifier, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600
    });
    reply.setCookie("oidc_return", returnTo, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600
    });

    const authorizationUrl = oidcService.buildAuthorizeUrl(state, nonce, challenge);
    
    reply.header("Cache-Control", "no-store");
    return {
      authorizationUrl,
      state,
      nonce,
      codeChallenge: challenge
    };
  });

  /**
   * GET /oidc/callback
   * Handle authorization response from CDC
   * Validates state, exchanges code for tokens, creates session
   */
  app.get(env.OIDC_CALLBACK_PATH, async (req, reply) => {
    const { code, state, error } = req.query as any;

    // Handle CDC error
    if (error) {
      reply.clearCookie("oidc_state");
      reply.clearCookie("oidc_nonce");
      reply.clearCookie("oidc_verifier");
      reply.clearCookie("oidc_return");
      return reply.redirect(`${env.FRONTEND_BASE_URL}/login?error=${error}`);
    }

    const storedState = req.cookies.oidc_state;
    const verifier = req.cookies.oidc_verifier;
    const nonce = req.cookies.oidc_nonce;
    const returnTo = req.cookies.oidc_return || "/";

    // Validate state and required parameters
    if (!code || !state || state !== storedState || !verifier || !nonce) {
      reply.clearCookie("oidc_state");
      reply.clearCookie("oidc_nonce");
      reply.clearCookie("oidc_verifier");
      reply.clearCookie("oidc_return");
      return reply.redirect(`${env.FRONTEND_BASE_URL}/login?error=state_mismatch`);
    }

    try {
      // Exchange code for tokens
      const tokens = await oidcService.exchangeCode(String(code), String(verifier));

      // Verify ID token if present
      if (tokens.id_token) {
        await oidcService.verifyIdToken(tokens.id_token, nonce);
      }

      // Set session cookies
      reply.setCookie("session_access", tokens.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: tokens.expires_in || 3600
      });

      if (tokens.refresh_token) {
        reply.setCookie("session_refresh", tokens.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 2592000 // 30 days
        });
      }

      // Clear transient cookies
      reply.clearCookie("oidc_state");
      reply.clearCookie("oidc_nonce");
      reply.clearCookie("oidc_verifier");
      reply.clearCookie("oidc_return");

      // Redirect to original destination
      return reply.redirect(`${env.FRONTEND_BASE_URL}${returnTo}`);
    } catch (err: any) {
      reply.clearCookie("oidc_state");
      reply.clearCookie("oidc_nonce");
      reply.clearCookie("oidc_verifier");
      reply.clearCookie("oidc_return");
      
      app.log.error({ err }, "OIDC callback error");
      return reply.redirect(
        `${env.FRONTEND_BASE_URL}/login?error=${encodeURIComponent(err?.message || "auth_failed")}`
      );
    }
  });

  /**
   * POST /oidc/token/exchange
   * Exchange authorization code for tokens (client-side PKCE flow)
   * Body: { code, codeVerifier, nonce? }
   */
  app.post("/oidc/token/exchange", async (req, reply) => {
    const body = req.body as any;
    const { code, codeVerifier, nonce } = body;

    if (!code || !codeVerifier) {
      reply.code(400);
      return { error: "missing_parameters", message: "code and codeVerifier are required" };
    }

    try {
      const tokens = await oidcService.exchangeCode(String(code), String(codeVerifier));

      // Verify ID token if nonce provided
      if (tokens.id_token && nonce) {
        await oidcService.verifyIdToken(tokens.id_token, String(nonce));
      }

      reply.header("Cache-Control", "no-store");
      return tokens;
    } catch (err: any) {
      app.log.error({ err }, "Token exchange error");
      reply.code(400);
      return {
        error: "token_exchange_failed",
        message: err?.message || "Failed to exchange authorization code"
      };
    }
  });

  /**
   * POST /oidc/commerce/token-exchange
   * Exchange CDC access token for Commerce access token
   * Body: { cdcAccessToken }
   */
  app.post("/oidc/commerce/token-exchange", async (req, reply) => {
    const body = req.body as any;
    const { cdcAccessToken } = body;

    if (!cdcAccessToken) {
      reply.code(400);
      return { error: "missing_parameters", message: "cdcAccessToken is required" };
    }

    try {
      // Exchange CDC token for Commerce token via Commerce token endpoint
      const url = `${env.COMMERCE_BASE_URL}/authorizationserver/oauth/token`;
      
      const formBody = new URLSearchParams();
      formBody.set("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange");
      formBody.set("subject_token", String(cdcAccessToken));
      formBody.set("subject_token_type", "urn:ietf:params:oauth:token-type:access_token");

      const basicAuth = Buffer.from(
        `${env.COMMERCE_CLIENT_ID}:${env.COMMERCE_CLIENT_SECRET}`
      ).toString("base64");

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`
        },
        body: formBody
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json?.error_description || json?.error || `HTTP ${resp.status}`);
      }

      reply.header("Cache-Control", "no-store");
      return json;
    } catch (err: any) {
      app.log.error({ err }, "Commerce token exchange error");
      reply.code(400);
      return {
        error: "commerce_token_exchange_failed",
        message: err?.message || "Failed to exchange CDC token for Commerce token"
      };
    }
  });
}
