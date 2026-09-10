import { Marketplace, Product, RecommendationEntry, SourcingOption } from "../types.js";

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
 * Pluggable AI provider. Implementations must not throw for expected
 * conditions — the caller (see src/ai/index.ts) treats any thrown error as
 * "provider unavailable" and falls back to the heuristic provider.
 */
export interface AIProvider {
  readonly name: string;
  explainRecommendation(input: ExplainRecommendationInput): Promise<ExplainRecommendationOutput>;
  generateListingContent(input: GenerateListingContentInput): Promise<GenerateListingContentOutput>;
  researchSuppliers(input: ResearchSuppliersInput): Promise<ResearchSuppliersOutput>;
}
