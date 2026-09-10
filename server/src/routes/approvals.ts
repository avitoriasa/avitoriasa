import { Router } from "express";
import { getConfiguredAIProvider } from "../ai/index.js";
import {
  approveRequest,
  listApprovals,
  proposePublishForIdleProducts,
  rejectRequest,
} from "../services/approvalService.js";
import { ApprovalStatus } from "../types.js";

export const approvalsRouter = Router();

approvalsRouter.get("/", async (req, res) => {
  const status = req.query.status as ApprovalStatus | undefined;
  res.json(await listApprovals(status));
});

/** Pede à IA que monte agora as sugestões de publicação, sem esperar o ciclo automático. */
approvalsRouter.post("/refresh", async (_req, res) => {
  try {
    const aiProvider = await getConfiguredAIProvider();
    const created = await proposePublishForIdleProducts(aiProvider);
    res.json({ created });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

approvalsRouter.post("/:id/approve", async (req, res) => {
  try {
    const aiProvider = await getConfiguredAIProvider();
    res.json(await approveRequest(req.params.id, aiProvider));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

approvalsRouter.post("/:id/reject", async (req, res) => {
  try {
    res.json(await rejectRequest(req.params.id));
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
