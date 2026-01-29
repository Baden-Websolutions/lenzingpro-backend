import fetch from "node-fetch";
import { AppEnv } from "../config/env.js";

type TokenCache = { accessToken: string; expiresAtEpoch: number };

export class CommerceClient {
  private env: AppEnv;
  private tokenCache: TokenCache | null = null;

  constructor(env: AppEnv) {
    this.env = env;
  }

  private nowEpoch(): number {
    return Math.floor(Date.now() / 1000);
  }

  private async fetchClientCredentialsToken(): Promise<TokenCache> {
    const url = `${this.env.COMMERCE_BASE_URL}/authorizationserver/oauth/token`;

    const body = new URLSearchParams();
    body.set("grant_type", "client_credentials");
    body.set("client_id", this.env.COMMERCE_CLIENT_ID);
    body.set("client_secret", this.env.COMMERCE_CLIENT_SECRET);

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    const json = (await resp.json()) as any;

    if (!resp.ok) {
      const msg = json?.error_description || json?.error || `HTTP ${resp.status}`;
      throw new Error(`Commerce token request failed: ${msg}`);
    }

    const accessToken = String(json.access_token || "");
    const expiresIn = Number(json.expires_in || 0);

    if (!accessToken || !expiresIn) {
      throw new Error("Commerce token response missing access_token/expires_in");
    }

    // Cache until 30s before expiry
    const expiresAtEpoch = this.nowEpoch() + Math.max(0, expiresIn - 30);
    return { accessToken, expiresAtEpoch };
  }

  private async getAccessToken(): Promise<string> {
    const now = this.nowEpoch();
    if (this.tokenCache && this.tokenCache.expiresAtEpoch > now) {
      return this.tokenCache.accessToken;
    }
    this.tokenCache = await this.fetchClientCredentialsToken();
    return this.tokenCache.accessToken;
  }

  private occBase(): string {
    return `${this.env.COMMERCE_BASE_URL}/occ/v2/${this.env.COMMERCE_BASE_SITE}`;
  }

  /**
   * Generic OCC GET request with optional user access token
   */
  private async occGet(path: string, userAccessToken?: string): Promise<any> {
    const token = userAccessToken ?? (await this.getAccessToken());
    const url = `${this.occBase()}${path}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    const json = (await resp.json()) as any;
    if (!resp.ok) {
      const msg = json?.errors?.[0]?.message || json?.message || `HTTP ${resp.status}`;
      throw new Error(`OCC request failed: ${msg}`);
    }
    return json;
  }

  async getCatalogTree(fields = "DEFAULT"): Promise<any> {
    return this.occGet(`/catalogs?fields=${encodeURIComponent(fields)}`);
  }

  async searchProductsByCategory(opts: {
    categoryCode: string;
    queryPrefix?: string;
    fields?: string;
    pageSize?: number;
    currentPage?: number;
  }): Promise<any> {
    const queryPrefix = opts.queryPrefix ?? ":relevance";
    const fields = opts.fields ?? "DEFAULT";
    const query = `${queryPrefix}:category:${opts.categoryCode}`;

    const url = new URL(`${this.occBase()}/products/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("fields", fields);
    if (typeof opts.pageSize === "number") url.searchParams.set("pageSize", String(opts.pageSize));
    if (typeof opts.currentPage === "number") url.searchParams.set("currentPage", String(opts.currentPage));

    return this.occGet(`/products/search?${url.searchParams.toString()}`);
  }

  async searchProducts(opts: {
    query?: string;
    fields?: string;
    pageSize?: number;
    currentPage?: number;
  }): Promise<any> {
    const query = opts.query ?? ":relevance";
    const fields = opts.fields ?? "DEFAULT";

    const url = new URL(`${this.occBase()}/products/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("fields", fields);
    if (typeof opts.pageSize === "number") url.searchParams.set("pageSize", String(opts.pageSize));
    if (typeof opts.currentPage === "number") url.searchParams.set("currentPage", String(opts.currentPage));

    return this.occGet(`/products/search?${url.searchParams.toString()}`);
  }

  /**
   * Get current user info using user-context access token (from OIDC flow)
   */
  async getCurrentUser(userAccessToken: string): Promise<any> {
    if (!userAccessToken) {
      throw new Error("Missing user access token");
    }
    return this.occGet(`/users/current?fields=FULL`, userAccessToken);
  }
}
