import { buildServer } from "./server.js";

const { app, env } = await buildServer();

try {
  await app.listen({ port: env.PORT, host: "127.0.0.1" });
  app.log.info(`lenzingpro-backend listening on http://127.0.0.1:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
