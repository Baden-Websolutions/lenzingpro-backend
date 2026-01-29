import fetch from "node-fetch";
import type { AppEnv } from "../config/env.js";
import { GigyaSDK } from "./gigya-sdk.js";

/**
 * CDC (Gigya) OIDC Token Response
 */
export type OIDCTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
};

/**
 * CDC User Info Response
 */
export type CDCUserInfo = {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  uid?: string;
};

/**
 * CDC Direct Login Response
 */
export type CDCLoginResponse = {
  errorCode: number;
  statusCode: number;
  UID?: string;
  UIDSignature?: string;
  signatureTimestamp?: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    country?: string;
  };
  sessionInfo?: {
    cookieName: string;
    cookieValue: string;
  };
  errorMessage?: string;
  errorDetails?: string;
};

/**
 * Stored Session Data
 */
export type SessionData = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  userInfo?: CDCUserInfo;
};

/**
 * CDC Authentication Service
 * Handles OAuth2/OIDC flows with CDC (Gigya)
 */
export class CDCAuthService {
  private env: AppEnv;
  private tokenEndpoint: string;
  private userInfoEndpoint: string;
  private authorizationEndpoint: string;
  private gigyaSDK: GigyaSDK | null = null;

  constructor(env: AppEnv) {
    this.env = env;
    
    // CDC OIDC Endpoints
    const oidcBase = `${env.CDC_BASE}/oidc/op/v1.0/${env.CDC_API_KEY}`;
    this.tokenEndpoint = `${oidcBase}/token`;
    this.userInfoEndpoint = `${oidcBase}/userinfo`;
    this.authorizationEndpoint = `${oidcBase}/authorize`;

    // Initialize Gigya SDK if secret key is provided
    if (env.CDC_SECRET_KEY) {
      this.gigyaSDK = new GigyaSDK(
        env.CDC_API_KEY,
        env.CDC_SECRET_KEY,
        "eu1.gigya.com"
      );
    }
  }

  /**
   * Get Authorization URL for Authorization Code Flow
   */
  getAuthorizationUrl(
    redirectUri: string,
    state: string,
    codeChallenge: string,
    scope = "openid profile email"
  ): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.env.CDC_OIDC_CLIENT_ID,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return `${this.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange Authorization Code for Tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<OIDCTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: this.env.CDC_OIDC_CLIENT_ID,
      code_verifier: codeVerifier,
    });

    const resp = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const json = await resp.json();

    if (!resp.ok) {
      throw new Error(
        `Token exchange failed: ${json.error_description || json.error || resp.statusText}`
      );
    }

    return json as OIDCTokenResponse;
  }

  /**
   * Refresh Access Token using Refresh Token
   */
  async refreshAccessToken(refreshToken: string): Promise<OIDCTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.env.CDC_OIDC_CLIENT_ID,
    });

    const resp = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const json = await resp.json();

    if (!resp.ok) {
      throw new Error(
        `Token refresh failed: ${json.error_description || json.error || resp.statusText}`
      );
    }

    return json as OIDCTokenResponse;
  }

  /**
   * Get User Info from CDC using Access Token
   */
  async getUserInfo(accessToken: string): Promise<CDCUserInfo> {
    const resp = await fetch(this.userInfoEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const json = await resp.json();

    if (!resp.ok) {
      throw new Error(`UserInfo request failed: ${resp.statusText}`);
    }

    return json as CDCUserInfo;
  }

  /**
   * Direct Login with CDC (for testing/development)
   * Note: This bypasses OIDC flow and uses CDC REST API directly
   */
  async directLogin(loginID: string, password: string): Promise<CDCLoginResponse> {
    const params = new URLSearchParams({
      apiKey: this.env.CDC_API_KEY,
      loginID,
      password,
    });

    const resp = await fetch("https://accounts.eu1.gigya.com/accounts.login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const json = (await resp.json()) as CDCLoginResponse;

    if (json.errorCode !== 0) {
      throw new Error(
        `CDC Login failed: ${json.errorMessage || json.errorDetails || "Unknown error"}`
      );
    }

    return json;
  }

  /**
   * Get JWT Token from CDC Session
   */
  async getJWTFromSession(sessionToken: string): Promise<string> {
    const params = new URLSearchParams({
      apiKey: this.env.CDC_API_KEY,
      login_token: sessionToken,
    });

    const resp = await fetch("https://accounts.eu1.gigya.com/accounts.getJWT", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const json = await resp.json();

    if (!resp.ok || json.errorCode !== 0) {
      throw new Error(`JWT request failed: ${json.errorMessage || resp.statusText}`);
    }

    return json.id_token;
  }

  /**
   * Create Session Data from Token Response
   */
  createSessionData(
    tokenResponse: OIDCTokenResponse,
    userInfo?: CDCUserInfo
  ): SessionData {
    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token,
      expiresAt: Date.now() + tokenResponse.expires_in * 1000,
      userInfo,
    };
  }

  /**
   * Check if Session is Expired
   */
  isSessionExpired(session: SessionData): boolean {
    return Date.now() >= session.expiresAt;
  }

  /**
   * Validate User Signature from CDC Response
   * Should be called after directLogin() or any CDC API response with UIDSignature
   * 
   * @param uid User ID
   * @param timestamp Signature timestamp
   * @param signature UIDSignature from CDC
   * @param expirationSeconds Maximum age of signature (default: 300 seconds)
   * @returns true if signature is valid
   */
  validateUserSignature(
    uid: string,
    timestamp: string,
    signature: string,
    expirationSeconds = 300
  ): boolean {
    if (!this.gigyaSDK) {
      throw new Error("Gigya SDK not initialized - CDC_SECRET_KEY missing");
    }
    return this.gigyaSDK.validateUserSignature(uid, timestamp, signature, expirationSeconds);
  }

  /**
   * Enhanced Direct Login with Signature Validation
   * Performs login and validates the response signature
   * 
   * @param loginID User's login ID (email)
   * @param password User's password
   * @returns CDC login response (validated)
   */
  async directLoginSecure(
    loginID: string,
    password: string
  ): Promise<CDCLoginResponse> {
    const response = await this.directLogin(loginID, password);

    // Validate signature if available
    if (this.gigyaSDK && response.UID && response.UIDSignature && response.signatureTimestamp) {
      const isValid = this.validateUserSignature(
        response.UID,
        response.signatureTimestamp,
        response.UIDSignature
      );

      if (!isValid) {
        throw new Error("Invalid user signature - possible tampering detected");
      }
    }

    return response;
  }

  /**
   * Get Account Info using Server-to-Server API
   * Uses OAuth1 signature for authentication
   * 
   * @param uid User ID
   * @returns Account info from CDC
   */
  async getAccountInfo(uid: string): Promise<any> {
    if (!this.gigyaSDK) {
      throw new Error("Gigya SDK not initialized - CDC_SECRET_KEY missing");
    }
    return this.gigyaSDK.sendRequest("accounts.getAccountInfo", { UID: uid });
  }

  /**
   * Set Account Info using Server-to-Server API
   * Uses OAuth1 signature for authentication
   * 
   * @param uid User ID
   * @param data Account data to update
   * @returns Response from CDC
   */
  async setAccountInfo(uid: string, data: Record<string, any>): Promise<any> {
    if (!this.gigyaSDK) {
      throw new Error("Gigya SDK not initialized - CDC_SECRET_KEY missing");
    }
    return this.gigyaSDK.sendRequest("accounts.setAccountInfo", {
      UID: uid,
      ...data,
    });
  }

  /**
   * Check if Gigya SDK is available
   */
  hasGigyaSDK(): boolean {
    return this.gigyaSDK !== null;
  }
}
