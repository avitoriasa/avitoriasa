import { AIProvider } from "../ai/index.js";
import { InventoryPlan, OnboardingPipelineResult, SourcingOption, SupplierTrustAssessment } from "../types.js";

/**
 * The "esteira" (conveyor belt) the user asked for: a small multi-agent
 * pipeline over a single already-computed SourcingOption. Each stage is one
 * call into the configured AIProvider (heuristic by default, or an Ollama/
 * Llama model when configured — see ai/index.ts), and every stage receives
 * only the deterministic numbers it needs; none of them may invent data.
 *
 *   1. Trust analyst  — explains the curated trust tier/score.
 *   2. Inventory planner — only runs when the option isn't a pure
 *      dropshipping fit, since a dropship product carries no stock to plan.
 *
 * Sourcing itself (step 0) already happened via sourcingService.researchSuppliers
 * or computeOption before this runs — this module picks up from there rather
 * than repeating it, so the same option's numbers aren't recomputed twice.
 */

function computeReorderPlan(option: SourcingOption): { reorderPoint: number; reorderQuantity: number } {
  // Reference heuristic, not a demand forecast: cover roughly one lead-time
  // window assuming a conservative baseline of ~1 unit/week of demand, and
  // reorder in batches of the supplier's own MOQ (you can't order less).
  const weeksOfLeadTime = option.leadTimeDays / 7;
  const reorderPoint = Math.max(1, Math.ceil(weeksOfLeadTime));
  const reorderQuantity = option.moq;
  return { reorderPoint, reorderQuantity };
}

export async function runOnboardingPipeline(
  option: SourcingOption,
  aiProvider: AIProvider
): Promise<OnboardingPipelineResult> {
  const trustOutput = await aiProvider.assessSupplierTrust({
    leadName: option.name,
    trustTier: option.trustTier,
    trustScore: option.trustScore,
    trustSignals: option.trustSignals,
    riskNotes: option.riskNotes,
  });
  const trustAssessment: SupplierTrustAssessment = {
    leadId: option.leadId,
    trustTier: option.trustTier,
    trustScore: option.trustScore,
    reasoning: trustOutput.reasoning,
  };

  let inventoryPlan: InventoryPlan | null = null;
  if (option.suggestedFulfillment !== "dropshipping") {
    const { reorderPoint, reorderQuantity } = computeReorderPlan(option);
    const planOutput = await aiProvider.planInventory({
      productName: option.productExamples[0] ?? option.name,
      moq: option.moq,
      leadTimeDays: option.leadTimeDays,
      reorderPoint,
      reorderQuantity,
    });
    inventoryPlan = { reorderPoint, reorderQuantity, reasoning: planOutput.reasoning };
  }

  return { option, trustAssessment, inventoryPlan, aiProvider: aiProvider.name };
}
