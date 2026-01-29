import type { FastifyRequest, FastifyReply } from "fastify";
import type { CDCAuthService } from "../services/cdc-auth.js";

/**
 * Extend Fastify Request to include Gigya-validated UID
 */
declare module "fastify" {
  interface FastifyRequest {
    gigyaUID?: string;
    gigyaValidated?: boolean;
  }
}

/**
 * Middleware to validate Gigya signatures from frontend requests
 * 
 * This middleware expects the following headers:
 * - x-gigya-uid: User ID
 * - x-gigya-timestamp: Signature timestamp
 * - x-gigya-signature: UIDSignature from CDC
 * 
 * Use this for critical operations that require additional validation
 * beyond session authentication.
 */
export function createGigyaSignatureValidator(cdcAuth: CDCAuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if Gigya SDK is available
    if (!cdcAuth.hasGigyaSDK()) {
      return reply.status(500).send({
        error: "signature_validation_unavailable",
        message: "Signature validation is not configured",
      });
    }

    // Get signature parameters from headers
    const uid = request.headers["x-gigya-uid"] as string;
    const timestamp = request.headers["x-gigya-timestamp"] as string;
    const signature = request.headers["x-gigya-signature"] as string;

    if (!uid || !timestamp || !signature) {
      return reply.status(401).send({
        error: "missing_signature",
        message: "Gigya signature parameters missing (x-gigya-uid, x-gigya-timestamp, x-gigya-signature)",
      });
    }

    try {
      // Validate signature
      const isValid = cdcAuth.validateUserSignature(uid, timestamp, signature);

      if (!isValid) {
        return reply.status(401).send({
          error: "invalid_signature",
          message: "Invalid or expired Gigya signature",
        });
      }

      // Attach validated UID to request
      request.gigyaUID = uid;
      request.gigyaValidated = true;
    } catch (error) {
      return reply.status(500).send({
        error: "signature_validation_failed",
        message: "Failed to validate signature",
      });
    }
  };
}

/**
 * Optional Gigya signature validator
 * Validates signature if present, but doesn't fail if missing
 */
export function createOptionalGigyaSignatureValidator(cdcAuth: CDCAuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if Gigya SDK is available
    if (!cdcAuth.hasGigyaSDK()) {
      return; // Skip validation if not configured
    }

    // Get signature parameters from headers
    const uid = request.headers["x-gigya-uid"] as string;
    const timestamp = request.headers["x-gigya-timestamp"] as string;
    const signature = request.headers["x-gigya-signature"] as string;

    // If any parameter is missing, skip validation
    if (!uid || !timestamp || !signature) {
      return;
    }

    try {
      // Validate signature
      const isValid = cdcAuth.validateUserSignature(uid, timestamp, signature);

      if (isValid) {
        request.gigyaUID = uid;
        request.gigyaValidated = true;
      }
    } catch (error) {
      // Silently fail for optional validation
      return;
    }
  };
}

/**
 * Middleware to ensure Gigya UID matches session UID
 * Should be used after requireAuth and validateGigyaSignature
 */
export function createUIDMatchValidator() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const gigyaUID = request.gigyaUID;
    const sessionUID = request.user?.uid || request.user?.sub;

    if (!gigyaUID) {
      return reply.status(400).send({
        error: "missing_gigya_uid",
        message: "Gigya UID not validated",
      });
    }

    if (!sessionUID) {
      return reply.status(401).send({
        error: "missing_session_uid",
        message: "Session UID not found",
      });
    }

    if (gigyaUID !== sessionUID) {
      return reply.status(403).send({
        error: "uid_mismatch",
        message: "Gigya UID does not match session UID",
      });
    }
  };
}
