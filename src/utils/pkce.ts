import crypto from "crypto";

/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * Used for secure Authorization Code Flow
 * 
 * PKCE prevents authorization code interception attacks by requiring
 * the client to prove possession of a code verifier that was used
 * to generate the code challenge sent in the authorization request.
 */

/**
 * Generate a cryptographically random code verifier
 * 
 * @param length Length of the verifier (43-128 characters, default: 128)
 * @returns Base64URL-encoded code verifier
 */
export function generateCodeVerifier(length = 128): string {
  if (length < 43 || length > 128) {
    throw new Error("Code verifier length must be between 43 and 128 characters");
  }

  const bytes = crypto.randomBytes(length);
  return base64UrlEncode(bytes).substring(0, length);
}

/**
 * Generate code challenge from code verifier
 * Uses SHA256 hashing as required by PKCE spec
 * 
 * @param verifier The code verifier
 * @returns Base64URL-encoded code challenge
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(hash);
}

/**
 * Base64 URL encode (without padding)
 * Converts standard Base64 to Base64URL format
 * 
 * @param buffer Buffer to encode
 * @returns Base64URL-encoded string
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Generate a random state parameter
 * Used for CSRF protection in OAuth flows
 * 
 * @returns Random hex string (64 characters)
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate a random nonce
 * Used for replay attack protection
 * 
 * @returns Random hex string (32 characters)
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Validate code verifier format
 * Ensures verifier meets PKCE requirements
 * 
 * @param verifier Code verifier to validate
 * @returns true if valid
 */
export function isValidCodeVerifier(verifier: string): boolean {
  // Must be 43-128 characters
  if (verifier.length < 43 || verifier.length > 128) {
    return false;
  }

  // Must contain only unreserved characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
  const validPattern = /^[A-Za-z0-9\-._~]+$/;
  return validPattern.test(verifier);
}
