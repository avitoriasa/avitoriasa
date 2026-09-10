import { Router } from "express";
import { runOptimizationSweepNow } from "../services/schedulerService.js";

export const schedulerRouter = Router();

schedulerRouter.post("/run-now", async (_req, res) => {
  try {
    await runOptimizationSweepNow();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
