import { FastifyInstance } from "fastify";
import { z } from "zod";
import { CommerceClient } from "../services/commerce.js";

export async function registerCatalogRoutes(app: FastifyInstance, commerce: CommerceClient) {
  app.get("/catalog/tree", async (_req, reply) => {
    const data = await commerce.getCatalogTree();
    reply.header("Cache-Control", "no-store");
    return data;
  });

  app.get("/catalog/search", async (req, reply) => {
    const schema = z.object({
      query: z.string().optional(),
      fields: z.string().optional(),
      pageSize: z.coerce.number().optional(),
      currentPage: z.coerce.number().optional(),
    });
    const q = schema.parse(req.query);
    const data = await commerce.searchProducts(q.query ?? ":relevance", {
      fields: q.fields,
      pageSize: q.pageSize,
      currentPage: q.currentPage,
    });
    reply.header("Cache-Control", "no-store");
    return data;
  });

  app.get("/catalog/category/:code/products", async (req, reply) => {
    const paramsSchema = z.object({ code: z.string().min(1) });
    const querySchema = z.object({
      query: z.string().optional(),
      fields: z.string().optional(),
      pageSize: z.coerce.number().optional(),
      currentPage: z.coerce.number().optional(),
    });
    const p = paramsSchema.parse(req.params);
    const q = querySchema.parse(req.query);
    const data = await commerce.searchProductsByCategory(p.code, {
      query: q.query,
      fields: q.fields,
      pageSize: q.pageSize,
      currentPage: q.currentPage,
    });
    reply.header("Cache-Control", "no-store");
    return data;
  });
}
