import crypto from "crypto";

/**
 * Gigya SDK Utilities (TypeScript Port)
 * Based on SAP Gigya Python SDK
 * 
 * Provides signature validation and OAuth1 signature generation
 * for secure server-to-server communication with Gigya API
 */
export class GigyaSDK {
  private apiKey: string;
  private secretKey: string; // Base64-encoded
  private apiDomain: string;

  constructor(apiKey: string, secretKey: string, apiDomain = "eu1.gigya.com") {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.apiDomain = apiDomain;
  }

  /**
   * Validate User Signature
   * Validates the UIDSignature returned from Gigya API
   * 
   * @param uid User ID
   * @param timestamp Signature timestamp (Unix timestamp in seconds)
   * @param signature The UIDSignature to validate
   * @param expirationSeconds Maximum age of signature in seconds (default: 300 = 5 minutes)
   * @returns true if signature is valid and not expired
   */
  validateUserSignature(
    uid: string,
    timestamp: string,
    signature: string,
    expirationSeconds = 300
  ): boolean {
    // Check timestamp expiration
    const now = Math.floor(Date.now() / 1000);
    const signatureTimestamp = parseInt(timestamp, 10);

    if (isNaN(signatureTimestamp)) {
      return false;
    }

    if (Math.abs(now - signatureTimestamp) > expirationSeconds) {
      return false; // Signature expired
    }

    // Calculate expected signature
    const baseString = `${timestamp}_${uid}`;
    const expectedSignature = this.calcSignature(baseString);

    return expectedSignature === signature;
  }

  /**
   * Validate Friend Signature
   * Validates friend object signatures from getFriendsInfo responses
   * 
   * @param uid User ID
   * @param timestamp Signature timestamp
   * @param friendUID Friend's User ID
   * @param signature The signature to validate
   * @param expirationSeconds Maximum age of signature in seconds
   * @returns true if signature is valid and not expired
   */
  validateFriendSignature(
    uid: string,
    timestamp: string,
    friendUID: string,
    signature: string,
    expirationSeconds = 300
  ): boolean {
    // Check timestamp expiration
    const now = Math.floor(Date.now() / 1000);
    const signatureTimestamp = parseInt(timestamp, 10);

    if (isNaN(signatureTimestamp)) {
      return false;
    }

    if (Math.abs(now - signatureTimestamp) > expirationSeconds) {
      return false;
    }

    // Calculate expected signature
    const baseString = `${timestamp}_${friendUID}_${uid}`;
    const expectedSignature = this.calcSignature(baseString);

    return expectedSignature === signature;
  }

  /**
   * Calculate HMAC-SHA1 Signature
   * Uses Base64-encoded secret key
   * 
   * @param baseString The string to sign
   * @returns Base64-encoded signature
   */
  private calcSignature(baseString: string): string {
    try {
      const secretBuffer = Buffer.from(this.secretKey, "base64");
      const hmac = crypto.createHmac("sha1", secretBuffer);
      hmac.update(baseString, "utf8");
      return hmac.digest("base64");
    } catch (error) {
      throw new Error(`Failed to calculate signature: ${error}`);
    }
  }

  /**
   * Calculate OAuth1 Signature for API Requests
   * 
   * @param httpMethod HTTP method (GET, POST, etc.)
   * @param url Full URL of the request
   * @param params Request parameters
   * @returns Base64-encoded OAuth1 signature
   */
  private calcOAuth1Signature(
    httpMethod: string,
    url: string,
    params: Record<string, any>
  ): string {
    const baseString = this.buildOAuth1BaseString(httpMethod, url, params);
    return this.calcSignature(baseString);
  }

  /**
   * Build OAuth1 Base String
   * Constructs the base string for OAuth1 signature calculation
   * 
   * @param httpMethod HTTP method
   * @param url Request URL
   * @param params Request parameters
   * @returns OAuth1 base string
   */
  private buildOAuth1BaseString(
    httpMethod: string,
    url: string,
    params: Record<string, any>
  ): string {
    const parsedUrl = new URL(url);
    
    // Normalize URL (lowercase hostname, no query string, no fragment)
    const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.hostname.toLowerCase()}${parsedUrl.pathname}`;

    // Sort parameters alphabetically and encode
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => {
        const value = params[key];
        const encodedValue = encodeURIComponent(String(value));
        return `${key}=${encodedValue}`;
      })
      .join("&");

    // Build base string: METHOD&URL&PARAMS
    return `${httpMethod.toUpperCase()}&${encodeURIComponent(normalizedUrl)}&${encodeURIComponent(sortedParams)}`;
  }

  /**
   * Send Signed Request to Gigya API
   * Automatically adds signature and required parameters
   * 
   * @param apiMethod Gigya API method (e.g., "accounts.getAccountInfo")
   * @param params Request parameters
   * @returns API response JSON
   */
  async sendRequest(
    apiMethod: string,
    params: Record<string, any> = {}
  ): Promise<any> {
    // Extract namespace from method (e.g., "accounts" from "accounts.getAccountInfo")
    const namespace = apiMethod.split(".")[0];
    const domain = `${namespace}.${this.apiDomain}`;
    const url = `https://${domain}/${apiMethod}`;

    // Add required parameters
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const requestParams = {
      ...params,
      apiKey: this.apiKey,
      timestamp: timestamp.toString(),
      nonce,
      format: "json",
      sdk: "typescript_custom",
    };

    // Calculate OAuth1 signature
    const signature = this.calcOAuth1Signature("POST", url, requestParams);
    requestParams.sig = signature;

    // Send request
    const formBody = new URLSearchParams(
      Object.entries(requestParams).map(([key, value]) => [key, String(value)])
    ).toString();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody,
    });

    const json = await response.json();

    if (json.errorCode !== 0) {
      throw new Error(
        `Gigya API Error ${json.errorCode}: ${json.errorMessage || json.errorDetails || "Unknown error"}`
      );
    }

    return json;
  }

  /**
   * Get Dynamic Session Signature
   * Used for advanced session management scenarios
   * 
   * @param gltCookie The glt_* cookie value
   * @param timeoutInSeconds Session timeout in seconds
   * @returns Dynamic session signature string
   */
  getDynamicSessionSignature(gltCookie: string, timeoutInSeconds: number): string {
    const expirationTime = Math.floor(Date.now() / 1000) + timeoutInSeconds;
    const unsignedString = `${gltCookie}_${expirationTime}`;
    const signature = this.calcSignature(unsignedString);
    return `${expirationTime}_${signature}`;
  }

  /**
   * Get Dynamic Session Signature with User Key
   * Used when user key is required for session management
   * 
   * @param gltCookie The glt_* cookie value
   * @param timeoutInSeconds Session timeout in seconds
   * @param userKey User key for additional security
   * @returns Dynamic session signature string with user key
   */
  getDynamicSessionSignatureUserSigned(
    gltCookie: string,
    timeoutInSeconds: number,
    userKey: string
  ): string {
    const expirationTime = Math.floor(Date.now() / 1000) + timeoutInSeconds;
    const unsignedString = `${gltCookie}_${expirationTime}_${userKey}`;
    const signature = this.calcSignature(unsignedString);
    return `${expirationTime}_${userKey}_${signature}`;
  }

  /**
   * Check if signature timestamp is expired
   * 
   * @param timestamp Signature timestamp (Unix timestamp in seconds)
   * @param expirationSeconds Maximum age in seconds
   * @returns true if expired
   */
  isSignatureExpired(timestamp: string, expirationSeconds: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    const signatureTimestamp = parseInt(timestamp, 10);

    if (isNaN(signatureTimestamp)) {
      return true;
    }

    return Math.abs(now - signatureTimestamp) > expirationSeconds;
  }
}
