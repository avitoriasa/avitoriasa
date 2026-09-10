import { Marketplace, Product, RecommendationEntry, SourcingOption, TrustTier } from "../types.js";

export interface ExplainRecommendationInput {
  product: Product;
  ranking: RecommendationEntry[];
}

export interface ExplainRecommendationOutput {
  /** Per-marketplace reasoning, keyed by marketplaceId, overriding the generic breakdown text. */
  reasoningByMarketplace: Record<string, string>;
}

export interface GenerateListingContentInput {
  product: Product;
  marketplace: Marketplace;
  currentTitle: string;
  currentDescription: string;
  currentKeywords: string[];
  /** How many times this listing has already been optimized — used to keep variations fresh. */
  iteration: number;
}

export interface GenerateListingContentOutput {
  title: string;
  description: string;
  keywords: string[];
  changeReason: string;
}

export interface ResearchSuppliersInput {
  query: string;
  /**
   * Numeric options already computed from the curated supplier dataset
   * (cost ranges, BRL conversion, margin estimate) — the AI only adds
   * natural-language reasoning/strategy on top of this, it must not invent
   * suppliers or prices.
   */
  options: Omit<SourcingOption, "reasoning">[];
}

export interface ResearchSuppliersOutput {
  /** Overall sourcing strategy summary for the query. */
  summary: string;
  /** Per-option reasoning, keyed by leadId. */
  reasoningByLeadId: Record<string, string>;
}

/**
 * "Trust analyst" agent input. Like researchSuppliers, the tier/score are
 * already curated/computed deterministically (see supplierLeads.ts) — the
 * agent only writes the reasoning, it must not invent or override them.
 */
export interface AssessSupplierTrustInput {
  leadName: string;
  trustTier: TrustTier;
  trustScore: number;
  trustSignals: string[];
  riskNotes: string;
}

export interface AssessSupplierTrustOutput {
  reasoning: string;
}

/**
 * "Inventory planner" agent input. reorderPoint/reorderQuantity are already
 * computed deterministically from MOQ/lead time (see agentOrchestrator.ts)
 * — the agent only explains the plan in plain language.
 */
export interface PlanInventoryInput {
  productName: string;
  moq: number;
  leadTimeDays: number;
  reorderPoint: number;
  reorderQuantity: number;
}

export interface PlanInventoryOutput {
  reasoning: string;
}

/**
 * Pluggable AI provider. Implementations must not throw for expected
 * conditions — the caller (see src/ai/index.ts) treats any thrown error as
 * "provider unavailable" and falls back to the heuristic provider.
 *
 * Each method here is a distinct "agent" in the onboarding pipeline
 * (agentOrchestrator.ts): a marketplace strategist (explainRecommendation),
 * an SEO copywriter (generateListingContent), a sourcing analyst
 * (researchSuppliers), a trust analyst (assessSupplierTrust) and an
 * inventory planner (planInventory) — each gets only the narrow input it
 * needs and never invents the numbers it's given.
 */
export interface AIProvider {
  readonly name: string;
  explainRecommendation(input: ExplainRecommendationInput): Promise<ExplainRecommendationOutput>;
  generateListingContent(input: GenerateListingContentInput): Promise<GenerateListingContentOutput>;
  researchSuppliers(input: ResearchSuppliersInput): Promise<ResearchSuppliersOutput>;
  assessSupplierTrust(input: AssessSupplierTrustInput): Promise<AssessSupplierTrustOutput>;
  planInventory(input: PlanInventoryInput): Promise<PlanInventoryOutput>;
}
