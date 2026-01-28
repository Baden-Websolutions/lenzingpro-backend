export type DiscoveryProxyKind = "discovery" | "jwks";

export interface DiscoveryProxyConfig {
  discoveryUrl: string;
  jwksUrl: string;
  cacheTtlMs: number;
  timeoutMs: number;
}

type CacheEntry = {
  expiresAt: number;
  body: any;
  status: number;
  headers: Record<string, string>;
};

/**
 * OidcDiscoveryProxyService proxies CDC discovery and JWKS endpoints
 * with caching to avoid rate limits and improve performance.
 */
export class OidcDiscoveryProxyService {
  private cfg: DiscoveryProxyConfig;
  private cache = new Map<string, CacheEntry>();

  constructor(cfg: DiscoveryProxyConfig) {
    this.cfg = cfg;
  }

  private allowedUrl(kind: DiscoveryProxyKind): string {
    return kind === "discovery" ? this.cfg.discoveryUrl : this.cfg.jwksUrl;
  }

  async fetchJson(kind: DiscoveryProxyKind): Promise<CacheEntry> {
    const url = this.allowedUrl(kind);

    // Return cached entry if still valid
    const cached = this.cache.get(url);
    if (cached && Date.now() < cached.expiresAt) {
      return cached;
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "lenzingpro-oidc-discovery-proxy/1.0"
        },
        signal: controller.signal
      });

      const text = await res.text();
      let body: any;
      try {
        body = JSON.parse(text);
      } catch {
        // If not parsable, return raw text for debugging
        body = { raw: text };
      }

      // Extract selected headers (no sensitive headers)
      const headers: Record<string, string> = {};
      const ct = res.headers.get("content-type");
      if (ct) headers["content-type"] = ct;
      const cc = res.headers.get("cache-control");
      if (cc) headers["cache-control"] = cc;
      const etag = res.headers.get("etag");
      if (etag) headers["etag"] = etag;

      const entry: CacheEntry = {
        status: res.status,
        body,
        headers,
        expiresAt: Date.now() + this.cfg.cacheTtlMs
      };

      this.cache.set(url, entry);
      return entry;
    } finally {
      clearTimeout(timeout);
    }
  }
}
