/**
 * JWT Validator Middleware
 * 
 * Validates JWT tokens from the Lenzing backend
 * Based on the SAP AppGyver auth-flow pattern
 */

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from "jose";
import type { JWTAuthPayload, JWTValidationResult } from "../types/jwt-auth.js";

export class JWTValidator {
  private jwksUri: string;
  private issuer: string;
  private audience: string;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(jwksUri: string, issuer: string, audience: string) {
    this.jwksUri = jwksUri;
    this.issuer = issuer;
    this.audience = audience;
  }

  /**
   * Initialize JWKS (JSON Web Key Set) for token verification
   */
  private getJWKS() {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(this.jwksUri));
    }
    return this.jwks;
  }

  /**
   * Validate JWT token
   * 
   * @param token - JWT token string
   * @returns Validation result with payload or error
   */
  async validateToken(token: string): Promise<JWTValidationResult> {
    try {
      // Remove "Bearer " prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, "");

      // Verify JWT signature and claims
      const { payload } = await jwtVerify(cleanToken, this.getJWKS(), {
        issuer: this.issuer,
        audience: this.audience,
        clockTolerance: 30, // Allow 30 seconds clock skew
      });

      // Validate required claims
      if (!payload.sub) {
        return {
          valid: false,
          error: "Missing 'sub' claim in JWT",
        };
      }

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return {
          valid: false,
          error: "JWT token has expired",
        };
      }

      return {
        valid: true,
        payload: payload as JWTAuthPayload,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        valid: false,
        error: `JWT validation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Extract token from Authorization header
   * 
   * @param authHeader - Authorization header value
   * @returns Token string or null
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }

  /**
   * Validate token from Authorization header
   * 
   * @param authHeader - Authorization header value
   * @returns Validation result
   */
  async validateFromHeader(authHeader?: string): Promise<JWTValidationResult> {
    const token = this.extractTokenFromHeader(authHeader);

    if (!token) {
      return {
        valid: false,
        error: "No Bearer token found in Authorization header",
      };
    }

    return this.validateToken(token);
  }
}

/**
 * Create JWT Validator instance from environment
 */
export function createJWTValidator(
  jwksUri: string,
  issuer: string,
  audience: string
): JWTValidator {
  return new JWTValidator(jwksUri, issuer, audience);
}
