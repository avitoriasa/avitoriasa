import { Marketplace, Product, RecommendationEntry } from "../types.js";

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

/**
 * Pluggable AI provider. Implementations must not throw for expected
 * conditions — the caller (see src/ai/index.ts) treats any thrown error as
 * "provider unavailable" and falls back to the heuristic provider.
 */
export interface AIProvider {
  readonly name: string;
  explainRecommendation(input: ExplainRecommendationInput): Promise<ExplainRecommendationOutput>;
  generateListingContent(input: GenerateListingContentInput): Promise<GenerateListingContentOutput>;
}
