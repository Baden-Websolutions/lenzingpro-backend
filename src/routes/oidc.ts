import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { OidcService } from "../services/oidc.js";
import type { AppEnv } from "../config/env.js";

export async function registerOidcRoutes(app: FastifyInstance, env: AppEnv) {
  const oidcService = new OidcService(env);

  // POST /oidc
  app.post("/oidc", async (req, reply) => {
    const returnTo = (req.body as any)?.returnTo ?? "/";
    const state = crypto.randomBytes(32).toString("base64url");
    const nonce = crypto.randomBytes(32).toString("base64url");
    const { verifier, challenge } = oidcService.generatePkce();

    reply.setCookie("oidc_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    reply.setCookie("oidc_nonce", nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    reply.setCookie("oidc_verifier", verifier, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    reply.setCookie("oidc_return", returnTo, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });

    const authorizationUrl = oidcService.buildAuthorizeUrl(state, nonce, challenge);
    return { authorizationUrl };
  });

  // POST /oidc/token - Token Exchange Proxy (vermeidet CORS)
  app.post("/oidc/token", async (req, reply) => {
    try {
      const body = req.body as any;
      const { code, code_verifier, redirect_uri } = body;

      if (!code || !code_verifier) {
        return reply.status(400).send({ error: "missing_parameters", message: "code and code_verifier required" });
      }

      const tokens = await oidcService.exchangeCode(code, code_verifier);
      return reply.send(tokens);
    } catch (err: any) {
      return reply.status(500).send({ error: "token_exchange_failed", message: err?.message || "Unknown error" });
    }
  });

  // GET /occ - Callback auf Backend-Domain
  app.get("/occ", async (req, reply) => {
    const { code, state, error } = req.query as any;

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

    if (!code || !state || state !== storedState || !verifier || !nonce) {
      reply.clearCookie("oidc_state");
      reply.clearCookie("oidc_nonce");
      reply.clearCookie("oidc_verifier");
      reply.clearCookie("oidc_return");
      return reply.redirect(`${env.FRONTEND_BASE_URL}/login?error=state_mismatch`);
    }

    try {
      const tokens = await oidcService.exchangeCode(String(code), String(verifier));
      
      if (tokens.id_token) {
        await oidcService.verifyIdToken(tokens.id_token, nonce);
      }

      reply.setCookie("session_access", tokens.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        domain: ".mtna-lp.dev"
      });
      
      if (tokens.refresh_token) {
        reply.setCookie("session_refresh", tokens.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          domain: ".mtna-lp.dev"
        });
      }

      reply.clearCookie("oidc_state");
      reply.clearCookie("oidc_nonce");
      reply.clearCookie("oidc_verifier");
      reply.clearCookie("oidc_return");

      return reply.redirect(`${env.FRONTEND_BASE_URL}${returnTo}`);
    } catch (err: any) {
      reply.clearCookie("oidc_state");
      reply.clearCookie("oidc_nonce");
      reply.clearCookie("oidc_verifier");
      reply.clearCookie("oidc_return");
      return reply.redirect(`${env.FRONTEND_BASE_URL}/login?error=${encodeURIComponent(err?.message || "auth_failed")}`);
    }
  });
}
