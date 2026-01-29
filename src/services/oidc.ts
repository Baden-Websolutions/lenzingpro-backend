import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv } from "../config/env.js";

export class OidcService {
  private env: AppEnv;
  private jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(env: AppEnv) {
    this.env = env;
    const jwksUri = `${env.CDC_BASE}/oidc/op/v1.0/${env.CDC_API_KEY}/.well-known/jwks`;
    this.jwks = createRemoteJWKSet(new URL(jwksUri));
  }

  generatePkce() {
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest()
      .toString("base64url");
    return { verifier, challenge };
  }

  buildAuthorizeUrl(state: string, nonce: string, codeChallenge: string): string {
    const url = new URL(`${this.env.CDC_BASE}/oidc/op/v1.0/${this.env.CDC_API_KEY}/authorize`);
    url.searchParams.set("client_id", this.env.CDC_OIDC_CLIENT_ID);
    url.searchParams.set(
      "redirect_uri",
      `${this.env.FRONTEND_BASE_URL}${this.env.OIDC_CALLBACK_PATH}`
    );
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile email");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("response_mode", "query");
    return url.toString();
  }

  async exchangeCode(code: string, codeVerifier: string) {
    const url = `${this.env.COMMERCE_BASE_URL}/authorizationserver/oauth/token`;
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set(
      "redirect_uri",
      `${this.env.FRONTEND_BASE_URL}${this.env.OIDC_CALLBACK_PATH}`
    );
    body.set("code_verifier", codeVerifier);

    const basicAuth = Buffer.from(
      `${this.env.COMMERCE_CLIENT_ID}:${this.env.COMMERCE_CLIENT_SECRET}`
    ).toString("base64");

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`
      },
      body
    });

    const json = await resp.json();
    if (!resp.ok) {
      throw new Error(json?.error_description || json?.error || `HTTP ${resp.status}`);
    }
    return json;
  }

  async verifyIdToken(idToken: string, expectedNonce: string) {
    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer: this.env.CDC_BASE,
      audience: this.env.COMMERCE_CLIENT_ID
    });
    if (payload.nonce !== expectedNonce) {
      throw new Error("Nonce mismatch");
    }
    return payload;
  }
}
