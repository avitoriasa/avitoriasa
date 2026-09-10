import { Router } from "express";
import { getConfiguredAIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { pauseConnection, removeConnection, resumeConnection } from "../services/publishingService.js";
import { optimizeConnection } from "../services/seoOptimizationService.js";

export const connectionsRouter = Router();

connectionsRouter.post("/:id/optimize", async (req, res) => {
  try {
    const aiProvider = await getConfiguredAIProvider();
    const log = await optimizeConnection(req.params.id, aiProvider);
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

connectionsRouter.get("/:id/history", async (req, res) => {
  const store = await db.read();
  const history = store.optimizationLogs
    .filter((l) => l.connectionId === req.params.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(history);
});

/** Comando do dono: tirar o anúncio do ar temporariamente. */
connectionsRouter.post("/:id/pause", async (req, res) => {
  try {
    res.json(await pauseConnection(req.params.id));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/** Comando do dono: recolocar no ar um anúncio pausado. */
connectionsRouter.post("/:id/resume", async (req, res) => {
  try {
    const aiProvider = await getConfiguredAIProvider();
    res.json(await resumeConnection(req.params.id, aiProvider));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

connectionsRouter.delete("/:id", async (req, res) => {
  try {
    res.json(await removeConnection(req.params.id));
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});
