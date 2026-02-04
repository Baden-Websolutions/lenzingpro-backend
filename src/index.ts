import { buildServerEnhanced } from "./server-enhanced-cors.js";

const { app, env } = await buildServerEnhanced();

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`lenzingpro-backend listening on http://127.0.0.1:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
