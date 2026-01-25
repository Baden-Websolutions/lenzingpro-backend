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

    // Cache bis 30s vor Ablauf
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

  async getCatalogTree(fields = "DEFAULT"): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.occBase()}/catalogs?fields=${encodeURIComponent(fields)}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });

    const json = await resp.json();
    if (!resp.ok) {
      const msg = json?.errors?.[0]?.message || `HTTP ${resp.status}`;
      throw new Error(`OCC catalogs failed: ${msg}`);
    }
    return json;
  }

  async searchProductsByCategory(opts: {
    categoryCode: string;
    queryPrefix?: string; // e.g. ":relevance"
    fields?: string; // DEFAULT
    pageSize?: number;
    currentPage?: number;
  }): Promise<any> {
    const token = await this.getAccessToken();

    const queryPrefix = opts.queryPrefix ?? ":relevance";
    const fields = opts.fields ?? "DEFAULT";
    const query = `${queryPrefix}:category:${opts.categoryCode}`;

    const url = new URL(`${this.occBase()}/products/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("fields", fields);
    if (typeof opts.pageSize === "number") url.searchParams.set("pageSize", String(opts.pageSize));
    if (typeof opts.currentPage === "number") url.searchParams.set("currentPage", String(opts.currentPage));

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });

    const json = await resp.json();
    if (!resp.ok) {
      const msg = json?.errors?.[0]?.message || `HTTP ${resp.status}`;
      throw new Error(`OCC product search failed: ${msg}`);
    }
    return json;
  }

  async searchProducts(opts: {
    query?: string;
    fields?: string;
    pageSize?: number;
    currentPage?: number;
  }): Promise<any> {
    const token = await this.getAccessToken();
    const query = opts.query ?? ":relevance";
    const fields = opts.fields ?? "DEFAULT";

    const url = new URL(`${this.occBase()}/products/search`);
    url.searchParams.set("query", query);
    url.searchParams.set("fields", fields);
    if (typeof opts.pageSize === "number") url.searchParams.set("pageSize", String(opts.pageSize));
    if (typeof opts.currentPage === "number") url.searchParams.set("currentPage", String(opts.currentPage));

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });

    const json = await resp.json();
    if (!resp.ok) {
      const msg = json?.errors?.[0]?.message || `HTTP ${resp.status}`;
      throw new Error(`OCC search failed: ${msg}`);
    }
    return json;
  }
}
