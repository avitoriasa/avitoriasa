import { v4 as uuid } from "uuid";
import { AIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { getMarketSignal } from "./marketSignals.js";
import { computePricing } from "./pricingService.js";
import { Marketplace, Product, RecommendationEntry, RecommendationResult } from "../types.js";

const WEIGHTS = {
  demand: 0.3,
  competition: 0.25, // applied as (100 - competitionScore)
  categoryFit: 0.25,
  netMargin: 0.2,
};

function scoreMarketplace(product: Product, marketplace: Marketplace): RecommendationEntry["breakdown"] & { score: number } {
  const signal = getMarketSignal(marketplace.slug, product.category);
  const netMarginEstimate = 100 - marketplace.feePercent;
  const invertedCompetition = 100 - signal.competitionScore;

  const score =
    signal.demandScore * WEIGHTS.demand +
    invertedCompetition * WEIGHTS.competition +
    signal.categoryFit * WEIGHTS.categoryFit +
    netMarginEstimate * WEIGHTS.netMargin;

  return {
    score: Math.round(score * 10) / 10,
    demand: signal.demandScore,
    competition: signal.competitionScore,
    fees: marketplace.feePercent,
    categoryFit: signal.categoryFit,
    netMarginEstimate,
  };
}

export async function generateRecommendation(productId: string, aiProvider: AIProvider): Promise<RecommendationResult> {
  const store = await db.read();
  const product = store.products.find((p) => p.id === productId);
  if (!product) throw new Error(`Produto ${productId} não encontrado`);

  const scored = store.marketplaces.map((marketplace) => {
    const breakdown = scoreMarketplace(product, marketplace);
    const entry: RecommendationEntry = {
      marketplaceId: marketplace.id,
      marketplaceName: marketplace.name,
      score: breakdown.score,
      reasoning: "",
      breakdown: {
        demand: breakdown.demand,
        competition: breakdown.competition,
        fees: breakdown.fees,
        categoryFit: breakdown.categoryFit,
        netMarginEstimate: breakdown.netMarginEstimate,
      },
      pricing: computePricing(product.basePrice, marketplace),
    };
    return entry;
  });

  scored.sort((a, b) => b.score - a.score);

  const { reasoningByMarketplace } = await aiProvider.explainRecommendation({ product, ranking: scored });
  for (const entry of scored) {
    entry.reasoning = reasoningByMarketplace[entry.marketplaceId] ?? `Pontuação calculada: ${entry.score}/100.`;
  }

  const result: RecommendationResult = {
    id: uuid(),
    productId,
    generatedAt: new Date().toISOString(),
    aiProvider: aiProvider.name,
    ranking: scored,
    topPick: scored[0]?.marketplaceId ?? "",
  };

  store.recommendations = store.recommendations.filter((r) => r.productId !== productId);
  store.recommendations.push(result);
  await db.save();

  return result;
}

export async function getLatestRecommendation(productId: string): Promise<RecommendationResult | undefined> {
  const store = await db.read();
  return store.recommendations.find((r) => r.productId === productId);
}
