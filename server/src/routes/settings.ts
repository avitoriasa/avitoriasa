import { Router } from "express";
import { db } from "../db.js";
import { restartScheduler } from "../services/schedulerService.js";
import { AppSettings } from "../types.js";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  const store = await db.read();
  res.json(store.settings);
});

settingsRouter.put("/", async (req, res) => {
  const store = await db.read();
  const body = req.body ?? {};
  const updated: AppSettings = {
    aiProvider: body.aiProvider === "ollama" ? "ollama" : body.aiProvider === "heuristic" ? "heuristic" : store.settings.aiProvider,
    ollamaBaseUrl: body.ollamaBaseUrl ?? store.settings.ollamaBaseUrl,
    ollamaModel: body.ollamaModel ?? store.settings.ollamaModel,
    optimizationIntervalHours: body.optimizationIntervalHours !== undefined ? Number(body.optimizationIntervalHours) : store.settings.optimizationIntervalHours,
    optimizationCooldownHours: body.optimizationCooldownHours !== undefined ? Number(body.optimizationCooldownHours) : store.settings.optimizationCooldownHours,
    usdToBrlRate: body.usdToBrlRate !== undefined ? Number(body.usdToBrlRate) : store.settings.usdToBrlRate,
    importTaxPercent: body.importTaxPercent !== undefined ? Number(body.importTaxPercent) : store.settings.importTaxPercent,
    remessaIcmsPercent:
      body.remessaIcmsPercent !== undefined ? Number(body.remessaIcmsPercent) : store.settings.remessaIcmsPercent,
    serpApiKey: body.serpApiKey !== undefined ? String(body.serpApiKey) : store.settings.serpApiKey,
  };
  store.settings = updated;
  await db.save();
  await restartScheduler();
  res.json(updated);
});
