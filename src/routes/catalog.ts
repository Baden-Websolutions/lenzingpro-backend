import { FastifyInstance } from "fastify";
import { z } from "zod";
import { CommerceClient } from "../services/commerce.js";

export async function registerCatalogRoutes(app: FastifyInstance, commerce: CommerceClient) {
  app.get("/catalog/tree", async (req, reply) => {
    const fields = (req.query as any)?.fields ? String((req.query as any).fields) : "DEFAULT";
    try {
      const data = await commerce.getCatalogTree(fields);
      reply.header("Cache-Control", "no-store");
      return data;
    } catch (e: any) {
      reply.code(502);
      return { error: true, message: e?.message || "catalog tree failed" };
    }
  });

  app.get("/catalog/search", async (req, reply) => {
    const QuerySchema = z.object({
      query: z.string().optional(),
      fields: z.string().optional(),
      pageSize: z.coerce.number().optional(),
      currentPage: z.coerce.number().optional()
    });

    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: true, message: "Invalid query params", issues: parsed.error.issues };
    }

    try {
      const data = await commerce.searchProducts({
        query: parsed.data.query ?? ":relevance",
        fields: parsed.data.fields ?? "DEFAULT",
        pageSize: parsed.data.pageSize,
        currentPage: parsed.data.currentPage
      });
      reply.header("Cache-Control", "no-store");
      return data;
    } catch (e: any) {
      reply.code(502);
      return { error: true, message: e?.message || "search failed" };
    }
  });

  app.get("/catalog/category/:code/products", async (req, reply) => {
    const ParamsSchema = z.object({ code: z.string().min(1) });
    const QuerySchema = z.object({
      query: z.string().optional(),
      fields: z.string().optional(),
      pageSize: z.coerce.number().optional(),
      currentPage: z.coerce.number().optional()
    });

    const p = ParamsSchema.safeParse((req.params as any) ?? {});
    if (!p.success) {
      reply.code(400);
      return { error: true, message: "Invalid category code", issues: p.error.issues };
    }

    const q = QuerySchema.safeParse(req.query);
    if (!q.success) {
      reply.code(400);
      return { error: true, message: "Invalid query params", issues: q.error.issues };
    }

    try {
      const data = await commerce.searchProductsByCategory({
        categoryCode: p.data.code,
        queryPrefix: q.data.query ?? ":relevance",
        fields: q.data.fields ?? "DEFAULT",
        pageSize: q.data.pageSize,
        currentPage: q.data.currentPage
      });
      reply.header("Cache-Control", "no-store");
      return data;
    } catch (e: any) {
      reply.code(502);
      return { error: true, message: e?.message || "category products failed" };
    }
  });
}
