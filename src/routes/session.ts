import { FastifyInstance } from "fastify";

export async function registerSessionRoutes(app: FastifyInstance) {
  app.get("/session", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return { authenticated: false, message: "Session handling not implemented yet (OIDC PKCE pending)." };
  });

  app.post("/session/logout", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
    return { ok: true };
  });
}
