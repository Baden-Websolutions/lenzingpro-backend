import Gigya from "gigya";
import { createPublicKey } from "crypto";
import { jwtVerify } from "jose";
import type { AppEnv } from "../config/env.js";

export class GigyaRestService {
  private gigya: any;
  private env: AppEnv;

  constructor(env: AppEnv) {
    this.env = env;
    
    // Initialize Gigya SDK with API Key + Secret
    this.gigya = new Gigya(
      env.GIGYA_API_KEY,
      env.GIGYA_DATA_CENTER as any, // Type cast for DataCenter enum
      env.GIGYA_SECRET
    );
  }

  /**
   * Verify CDC JWT using accounts.getJWTPublicKey
   */
  async verifyCdcJwt(idToken: string) {
    try {
      // Get CDC public key for JWT verification
      const keyRes = await this.gigya.accounts.getJWTPublicKey({
        apiKey: this.env.GIGYA_API_KEY
      });

      // Extract PEM from response (field name varies by SDK version)
      const pem = keyRes.publicKey || keyRes.PublicKey || keyRes.key || keyRes;
      
      if (!pem || typeof pem !== "string") {
        throw new Error("Could not obtain CDC JWT public key (PEM).");
      }

      const publicKey = createPublicKey(pem);

      // Verify JWT with jose
      const { payload, protectedHeader } = await jwtVerify(idToken, publicKey, {
        // Optional: Add issuer/audience validation
        // issuer: `https://accounts.${this.env.GIGYA_DATA_CENTER}.gigya.com`,
        // audience: this.env.GIGYA_API_KEY
      });

      return { payload, protectedHeader };
    } catch (error) {
      throw new Error(`JWT verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get account info from CDC
   */
  async getAccountInfo(uid: string) {
    try {
      const response = await this.gigya.accounts.getAccountInfo({
        UID: uid
      });
      return response;
    } catch (error) {
      throw new Error(`Failed to get account info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Set account info in CDC
   */
  async setAccountInfo(uid: string, data: any) {
    try {
      const response = await this.gigya.accounts.setAccountInfo({
        UID: uid,
        ...data
      });
      return response;
    } catch (error) {
      throw new Error(`Failed to set account info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * DS get operation
   */
  async dsGet(type: string, oid: string) {
    try {
      const response = await this.gigya.ds.get({
        type,
        oid
      });
      return response;
    } catch (error) {
      throw new Error(`DS get failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * DS store operation
   */
  async dsStore(type: string, oid: string, data: any) {
    try {
      const response = await this.gigya.ds.store({
        type,
        oid,
        data
      });
      return response;
    } catch (error) {
      throw new Error(`DS store failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
