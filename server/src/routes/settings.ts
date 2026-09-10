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
  };
  store.settings = updated;
  await db.save();
  await restartScheduler();
  res.json(updated);
});
