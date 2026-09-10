import { Router } from "express";
import { getConfiguredAIProvider } from "../ai/index.js";
import { db } from "../db.js";
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

connectionsRouter.delete("/:id", async (req, res) => {
  const store = await db.read();
  const connection = store.connections.find((c) => c.id === req.params.id);
  if (!connection) return res.status(404).json({ error: "Conexão não encontrada" });

  connection.status = "disconnected";
  store.connections = store.connections.map((c) => (c.id === connection.id ? connection : c));
  await db.save();
  res.json(connection);
});
