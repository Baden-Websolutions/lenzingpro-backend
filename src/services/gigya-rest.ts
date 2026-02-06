import Gigya from "gigya";
// @ts-ignore - Gigya library has incorrect type definitions
const GigyaConstructor = (Gigya as any).default || Gigya;
// createPublicKey not needed for HS256 verification
import { jwtVerify } from "jose";
import type { AppEnv } from "../config/env.js";

export class GigyaRestService {
  private gigya: any;
  private env: AppEnv;

  constructor(env: AppEnv) {
    this.env = env;
    
    // Initialize Gigya SDK with API Key + Secret
    this.gigya = new GigyaConstructor(
      env.GIGYA_API_KEY,
      env.GIGYA_DATA_CENTER as any, // Type cast for DataCenter enum
      env.GIGYA_SECRET
    );
  }

  /**
   * Verify CDC JWT using HMAC-SHA256 (HS256) with Gigya Secret
   * Gigya CDC uses HS256 algorithm, not RS256
   */
  async verifyCdcJwt(idToken: string) {
    try {
      // Gigya uses HS256 (HMAC-SHA256) for JWT signing
      // Verify with the Gigya Secret, not a public key
      const secret = new TextEncoder().encode(this.env.GIGYA_SECRET);

      // Verify JWT with jose
      const { payload, protectedHeader } = await jwtVerify(idToken, secret, {
        issuer: `https://fidm.${this.env.GIGYA_DATA_CENTER}.gigya.com/oidc/op/v1.0/${this.env.GIGYA_API_KEY}`,
        audience: this.env.GIGYA_API_KEY
      });

      return { payload, protectedHeader };
    } catch (error) {
      throw new Error(`JWT verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get account info from CDC
   * @param uid User ID
   * @param loginToken Optional loginToken for authentication
   */
  async getAccountInfo(uid: string, loginToken?: string) {
    try {
      const params: any = { UID: uid };
      
      // If loginToken is provided, use it for authentication
      if (loginToken) {
        params.oauth_token = loginToken;
      }
      
      const response = await this.gigya.accounts.getAccountInfo(params);
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
