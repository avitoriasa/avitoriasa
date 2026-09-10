import { Router } from "express";
import { getConfiguredAIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { estimateDropshipOrder } from "../services/dropshipService.js";
import { listFxMethods, researchSuppliers } from "../services/sourcingService.js";

export const sourcingRouter = Router();

sourcingRouter.get("/fx-methods", (_req, res) => {
  res.json(listFxMethods());
});

sourcingRouter.post("/research", async (req, res) => {
  const { query, desiredResalePrice } = req.body ?? {};
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query é obrigatória" });
  }

  try {
    const store = await db.read();
    const aiProvider = await getConfiguredAIProvider();
    const result = await researchSuppliers(
      query,
      store.settings.usdToBrlRate,
      store.settings.importTaxPercent,
      desiredResalePrice !== undefined ? Number(desiredResalePrice) : undefined,
      aiProvider
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

sourcingRouter.post("/dropship-estimate", async (req, res) => {
  const { sourcePriceUsd, shippingBrl, isRemessaConformePlatform } = req.body ?? {};
  if (sourcePriceUsd === undefined) {
    return res.status(400).json({ error: "sourcePriceUsd é obrigatório" });
  }

  const store = await db.read();
  const estimate = estimateDropshipOrder(
    Number(sourcePriceUsd),
    store.settings.usdToBrlRate,
    shippingBrl !== undefined ? Number(shippingBrl) : 0,
    store.settings.remessaIcmsPercent,
    Boolean(isRemessaConformePlatform)
  );
  res.json(estimate);
});
