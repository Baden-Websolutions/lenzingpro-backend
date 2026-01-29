import fetch from "node-fetch";
import type { AppEnv } from "../config/env.js";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type OccErrorResponse = {
  errors?: Array<{ message?: string }>;
  message?: string;
};

export type ProductSearchOptions = {
  fields?: string;
  pageSize?: number;
  currentPage?: number;
};

export class CommerceClient {
  private env: AppEnv;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(env: AppEnv) {
    this.env = env;
  }

  private occBase(): string {
    return `${this.env.COMMERCE_BASE_URL}/occ/v2/${this.env.COMMERCE_BASE_SITE}`;
  }

  private tokenEndpoint(): string {
    return `${this.env.COMMERCE_BASE_URL}/authorizationserver/oauth/token`;
  }

  private async getClientCredentialsToken(): Promise<string> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt) return this.token;

    const basicAuth = Buffer.from(
      `${this.env.COMMERCE_CLIENT_ID}:${this.env.COMMERCE_CLIENT_SECRET}`
    ).toString("base64");

    const resp = await fetch(this.tokenEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });

    const json = (await resp.json()) as Partial<TokenResponse>;
    if (!resp.ok) {
      throw new Error(json?.error_description || json?.error || `HTTP ${resp.status}`);
    }
    if (!json.access_token || typeof json.expires_in !== "number") {
      throw new Error("Invalid token response from Commerce token endpoint");
    }

    this.token = json.access_token;
    this.tokenExpiresAt = now + json.expires_in * 1000 - 60_000;
    return this.token;
  }

  private async occGet(path: string, accessToken?: string): Promise<any> {
    const token = accessToken ?? (await this.getClientCredentialsToken());
    const url = `${this.occBase()}${path}`;

    const resp = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const json = (await resp.json()) as OccErrorResponse | any;
    if (!resp.ok) {
      const msg =
        (json as OccErrorResponse)?.errors?.[0]?.message ||
        (json as OccErrorResponse)?.message ||
        `HTTP ${resp.status}`;
      throw new Error(msg);
    }
    return json;
  }

  async getCurrentUser(accessToken: string): Promise<any> {
    return this.occGet("/users/current", accessToken);
  }

  async getCatalogTree(): Promise<any> {
    return this.occGet("/catalogs");
  }

  async searchProducts(query: string, opts?: ProductSearchOptions): Promise<any> {
    const params = new URLSearchParams({ query: query || ":relevance" });
    if (opts?.fields) params.set("fields", opts.fields);
    if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
    if (opts?.currentPage) params.set("currentPage", String(opts.currentPage));
    return this.occGet(`/products/search?${params}`);
  }

  async searchProductsByCategory(
    categoryCode: string,
    opts?: { query?: string; fields?: string; pageSize?: number; currentPage?: number }
  ): Promise<any> {
    const params = new URLSearchParams({
      query: opts?.query || `:relevance:allCategories:${categoryCode}`,
    });
    if (opts?.fields) params.set("fields", opts.fields);
    if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
    if (opts?.currentPage) params.set("currentPage", String(opts.currentPage));
    return this.occGet(`/products/search?${params}`);
  }
}
