import { Router } from "express";
import { getConfiguredAIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { runOnboardingPipeline } from "../services/agentOrchestrator.js";
import { computeOption, findLeadById } from "../services/sourcingService.js";
import { SourcingOption } from "../types.js";

export const agentsRouter = Router();

/**
 * Runs the full multi-agent onboarding pipeline for one sourcing option:
 * trust assessment, then (if relevant) an inventory plan. This is the
 * "esteira" entry point used from the Sourcing page after picking an
 * option, before the user commits to creating the product.
 */
agentsRouter.post("/onboard", async (req, res) => {
  const { leadId, desiredResalePrice } = req.body ?? {};
  if (!leadId) return res.status(400).json({ error: "leadId é obrigatório" });

  const lead = findLeadById(leadId);
  if (!lead) return res.status(404).json({ error: "Fornecedor não encontrado" });

  try {
    const store = await db.read();
    const aiProvider = await getConfiguredAIProvider();
    const optionWithoutReasoning = computeOption(
      lead,
      store.settings.usdToBrlRate,
      store.settings.importTaxPercent,
      desiredResalePrice !== undefined ? Number(desiredResalePrice) : undefined
    );

    // One more agent call to get the same marketplace-style reasoning shown
    // in the search results, so the pipeline's option looks identical to
    // the one the user picked.
    const { reasoningByLeadId } = await aiProvider.researchSuppliers({
      query: lead.name,
      options: [optionWithoutReasoning],
    });
    const option: SourcingOption = { ...optionWithoutReasoning, reasoning: reasoningByLeadId[lead.id] ?? "" };

    const result = await runOnboardingPipeline(option, aiProvider);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
