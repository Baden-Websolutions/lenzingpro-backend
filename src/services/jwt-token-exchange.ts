/**
 * JWT Token Exchange Service
 * 
 * Implements JWT-Bearer token exchange flow (RFC 7523)
 * Based on SAP AppGyver pattern: exchanges JWT for Commerce Cloud access token
 */

import type { AppEnv } from "../config/env.js";
import type {
  JWTAuthPayload,
  CommerceTokenResponse,
  JWTSessionData,
} from "../types/jwt-auth.js";
import NodeCache from "node-cache";

export class JWTTokenExchangeService {
  private env: AppEnv;
  private tokenCache: NodeCache;

  constructor(env: AppEnv) {
    this.env = env;
    // Initialize cache with TTL check period of 60 seconds
    this.tokenCache = new NodeCache({
      stdTTL: 3600, // Default TTL: 1 hour
      checkperiod: 60,
      useClones: false,
    });
  }

  /**
   * Exchange JWT token for Commerce Cloud access token
   * 
   * Uses JWT-Bearer grant type (RFC 7523):
   * grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
   * 
   * @param jwtToken - The validated JWT token
   * @param jwtPayload - The decoded JWT payload
   * @returns Commerce Cloud token response
   */
  async exchangeJWTForCommerceToken(
    jwtToken: string,
    jwtPayload: JWTAuthPayload
  ): Promise<CommerceTokenResponse> {
    // Check cache first
    const cacheKey = this.getCacheKey(jwtToken);
    const cachedToken = this.tokenCache.get<CommerceTokenResponse>(cacheKey);

    if (cachedToken) {
      // Verify cached token is not expired
      const now = Math.floor(Date.now() / 1000);
      const expiryBuffer = 60; // 60 seconds buffer
      const tokenExpiry = Math.floor(Date.now() / 1000) + cachedToken.expires_in;

      if (tokenExpiry > now + expiryBuffer) {
        return cachedToken;
      }

      // Remove expired token from cache
      this.tokenCache.del(cacheKey);
    }

    // Perform token exchange
    const tokenResponse = await this.performTokenExchange(jwtToken, jwtPayload);

    // Cache the new token
    const ttl = tokenResponse.expires_in - 60; // Cache for expires_in minus 60 seconds
    this.tokenCache.set(cacheKey, tokenResponse, ttl);

    return tokenResponse;
  }

  /**
   * Perform the actual token exchange with Commerce Cloud
   * 
   * @param jwtToken - The JWT token to exchange
   * @param jwtPayload - The decoded JWT payload
   * @returns Commerce Cloud token response
   */
  private async performTokenExchange(
    jwtToken: string,
    jwtPayload: JWTAuthPayload
  ): Promise<CommerceTokenResponse> {
    const tokenUrl = `${this.env.COMMERCE_BASE_URL}/${this.env.COMMERCE_BASE_SITE}/oauth/token`;

    // Build form data for JWT-Bearer grant
    const formData = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtToken,
      scope: "basic", // Adjust scope as needed
    });

    // Prepare Basic Auth header
    const credentials = Buffer.from(
      `${this.env.COMMERCE_CLIENT_ID}:${this.env.COMMERCE_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const tokenResponse: CommerceTokenResponse = await response.json();

    return tokenResponse;
  }

  /**
   * Create session data from JWT and Commerce token
   * 
   * @param jwtToken - Original JWT token
   * @param jwtPayload - Decoded JWT payload
   * @param commerceToken - Commerce Cloud access token response
   * @returns Session data
   */
  createSessionData(
    jwtToken: string,
    jwtPayload: JWTAuthPayload,
    commerceToken: CommerceTokenResponse
  ): JWTSessionData {
    const now = Date.now();

    return {
      userId: jwtPayload.sub,
      email: jwtPayload.email,
      name: jwtPayload.name,
      uid: jwtPayload.uid,
      commerceAccessToken: commerceToken.access_token,
      commerceTokenExpiry: now + commerceToken.expires_in * 1000,
      commerceRefreshToken: commerceToken.refresh_token,
      originalJWT: jwtToken,
      createdAt: now,
      lastAccessed: now,
    };
  }

  /**
   * Check if session is expired
   * 
   * @param session - Session data
   * @returns True if expired
   */
  isSessionExpired(session: JWTSessionData): boolean {
    const now = Date.now();
    const buffer = 60 * 1000; // 60 seconds buffer

    return session.commerceTokenExpiry < now + buffer;
  }

  /**
   * Refresh Commerce Cloud access token using refresh token
   * 
   * @param refreshToken - Commerce Cloud refresh token
   * @returns New token response
   */
  async refreshCommerceToken(refreshToken: string): Promise<CommerceTokenResponse> {
    const tokenUrl = `${this.env.COMMERCE_BASE_URL}/${this.env.COMMERCE_BASE_SITE}/oauth/token`;

    const formData = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const credentials = Buffer.from(
      `${this.env.COMMERCE_CLIENT_ID}:${this.env.COMMERCE_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Token refresh failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const tokenResponse: CommerceTokenResponse = await response.json();

    return tokenResponse;
  }

  /**
   * Update session with refreshed token
   * 
   * @param session - Current session data
   * @param commerceToken - New Commerce token response
   * @returns Updated session data
   */
  updateSessionWithRefreshedToken(
    session: JWTSessionData,
    commerceToken: CommerceTokenResponse
  ): JWTSessionData {
    const now = Date.now();

    return {
      ...session,
      commerceAccessToken: commerceToken.access_token,
      commerceTokenExpiry: now + commerceToken.expires_in * 1000,
      commerceRefreshToken: commerceToken.refresh_token || session.commerceRefreshToken,
      lastAccessed: now,
    };
  }

  /**
   * Generate cache key for JWT token
   * 
   * @param jwtToken - JWT token
   * @returns Cache key
   */
  private getCacheKey(jwtToken: string): string {
    // Use a hash of the token as cache key to avoid storing full token
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(jwtToken).digest("hex");
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.tokenCache.flushAll();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.tokenCache.getStats();
  }
}
