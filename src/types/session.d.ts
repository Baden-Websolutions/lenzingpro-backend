import "@fastify/secure-session";

declare module "@fastify/secure-session" {
  interface SessionData {
    uid?: string;
    cdc?: {
      iat: number;
      exp: number;
    };
    expiresAt?: number;
    refreshToken?: string;
    [key: string]: any;  // Allow any additional properties including "cookie"
  }
}
