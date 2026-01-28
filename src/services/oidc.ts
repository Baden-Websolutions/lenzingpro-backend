import crypto from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv } from "../config/env.js";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

/**
 * OidcService handles OIDC PKCE flow:
 * - Generate PKCE verifier/challenge
 * - Build authorization URL
 * - Exchange authorization code for tokens via Commerce
 * - Verify ID tokens using CDC JWKS
 */
export class OidcService {
  private env: AppEnv;
  private jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(env: AppEnv) {
    this.env = env;
    // CDC JWKS endpoint for ID token verification
    const jwksUrl = new URL(`${env.CDC_BASE}/oidc/op/v1.0/${env.CDC_API_KEY}/jwks`);
    this.jwks = createRemoteJWKSet(jwksUrl);
  }

  /**
   * Generate PKCE verifier and challenge pair (S256 method)
   */
  generatePkce(): { verifier: string; challenge: string } {
    const verifier = crypto.randomBytes(64).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest()
      .toString("base64url");
    return { verifier, challenge };
  }

  /**
   * Build CDC authorization URL with PKCE
   */
  buildAuthorizeUrl(state: string, nonce: string, codeChallenge: string): string {
    const url = new URL(`${this.env.CDC_BASE}/oidc/op/v1.0/${this.env.CDC_API_KEY}/authorize`);
    url.searchParams.set("client_id", this.env.CDC_OIDC_CLIENT_ID);
    url.searchParams.set("redirect_uri", this.env.OIDC_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile email");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("response_mode", "query");
    return url.toString();
  }

  /**
   * Exchange authorization code for tokens via Commerce token endpoint
   */
  async exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
    const url = `${this.env.COMMERCE_BASE_URL}/authorizationserver/oauth/token`;
    
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", this.env.OIDC_REDIRECT_URI);
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

    return json as TokenResponse;
  }

  /**
   * Verify ID token using CDC JWKS and validate nonce
   */
  async verifyIdToken(idToken: string, expectedNonce: string) {
    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer: `${this.env.CDC_BASE}/oidc/op/v1.0/${this.env.CDC_API_KEY}`,
      audience: this.env.CDC_OIDC_CLIENT_ID
    });

    if (payload.nonce !== expectedNonce) {
      throw new Error("Nonce mismatch");
    }

    return payload;
  }
}
