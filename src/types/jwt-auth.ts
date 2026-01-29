/**
 * JWT Authentication Types
 * 
 * Types for the parallel JWT-Bearer token exchange authentication flow
 */

export interface JWTAuthPayload {
  sub: string;           // Subject (user ID)
  email?: string;        // User email
  name?: string;         // User name
  uid?: string;          // Gigya UID
  iss: string;           // Issuer
  aud: string | string[]; // Audience
  exp: number;           // Expiration time
  iat: number;           // Issued at
  [key: string]: any;    // Additional claims
}

export interface CommerceTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
}

export interface JWTSessionData {
  userId: string;
  email?: string;
  name?: string;
  uid?: string;
  commerceAccessToken: string;
  commerceTokenExpiry: number;
  commerceRefreshToken?: string;
  originalJWT: string;
  createdAt: number;
  lastAccessed: number;
}

export interface JWTAuthRequest {
  jwt: string;
}

export interface JWTAuthResponse {
  success: boolean;
  sessionId?: string;
  user?: {
    userId: string;
    email?: string;
    name?: string;
    uid?: string;
  };
  error?: string;
  message?: string;
}

export interface JWTValidationResult {
  valid: boolean;
  payload?: JWTAuthPayload;
  error?: string;
}
