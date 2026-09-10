import { Router } from "express";
import { db } from "../db.js";

export const optimizationsRouter = Router();

optimizationsRouter.get("/recent", async (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const store = await db.read();
  const recent = [...store.optimizationLogs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((log) => {
      const product = store.products.find((p) => p.id === log.productId);
      const marketplace = store.marketplaces.find((m) => m.id === log.marketplaceId);
      return { ...log, productName: product?.name ?? "Produto removido", marketplaceName: marketplace?.name ?? "?" };
    });
  res.json(recent);
});
