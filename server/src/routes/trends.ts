import { Router } from "express";
import { getConfiguredAIProvider } from "../ai/index.js";
import { db } from "../db.js";
import {
  buildKeywordCandidates,
  buildRegionalRecommendations,
  computeSeoOpportunities,
  suggestAdBudget,
} from "../services/seoTrendsService.js";
import { getConfiguredTrendsProvider } from "../services/trendsProvider.js";
import { RegionalRecommendation, SeoOpportunity, TrendsAnalysisResult } from "../types.js";

export const trendsRouter = Router();

/**
 * Runs the "trends & SEO/ads" agent for one product: fetches search-interest
 * signals (curated dataset by default, real Google Trends via SerpApi when
 * SERPAPI_KEY is set — see trendsProvider.ts), ranks them as SEO
 * opportunities deterministically (seoTrendsService.ts), then calls the
 * configured AIProvider for narrative reasoning and an ad-copy brief. No
 * marketplace ad platform is integrated: the ad copy/budget are a strategic
 * starting point, not an automated campaign.
 */
trendsRouter.post("/analyze", async (req, res) => {
  const { productId, marketplaceId } = req.body ?? {};
  if (!productId) return res.status(400).json({ error: "productId é obrigatório" });

  try {
    const store = await db.read();
    const product = store.products.find((p) => p.id === productId);
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });

    const marketplace = marketplaceId ? store.marketplaces.find((m) => m.id === marketplaceId) : undefined;
    const marketplaceName = marketplace?.name ?? "marketplaces conectados";

    const keywords = buildKeywordCandidates(product);
    const trendsProvider = getConfiguredTrendsProvider(store.settings.serpApiKey);
    const signals = await trendsProvider.getSignals(keywords, "BR");

    const opportunitiesWithoutReasoning = computeSeoOpportunities(product, signals);

    const aiProvider = await getConfiguredAIProvider();
    const { summary, reasoningByKeyword } = await aiProvider.analyzeSeoTrends({
      product,
      opportunities: opportunitiesWithoutReasoning,
    });
    const opportunities: SeoOpportunity[] = opportunitiesWithoutReasoning.map((opp) => ({
      ...opp,
      reasoning: reasoningByKeyword[opp.keyword] ?? "",
    }));

    const adBudget = suggestAdBudget(product);
    const topKeywords = opportunities.slice(0, 3).map((o) => o.keyword);
    const { headline, primaryText, targetingNotes } = await aiProvider.draftAdCopy({
      product,
      marketplaceName,
      topKeywords: topKeywords.length ? topKeywords : keywords.slice(0, 3),
      budget: adBudget,
    });

    const regionalKeyword = opportunities[0]?.keyword ?? keywords[0] ?? product.category;
    const regionalSignals = await trendsProvider.getRegionalSignals(regionalKeyword, "BR");
    const regionalWithoutReasoning = buildRegionalRecommendations(regionalSignals);
    const { summary: regionalSummary, reasoningByRegion } = await aiProvider.analyzeRegionalDemand({
      product,
      keyword: regionalKeyword,
      regions: regionalWithoutReasoning.map((r) => ({ ...r, reasoning: "" })),
    });
    const regionalRecommendations: RegionalRecommendation[] = regionalWithoutReasoning.map((r) => ({
      ...r,
      reasoning: reasoningByRegion[r.region] ?? "",
    }));

    const result: TrendsAnalysisResult = {
      productId: product.id,
      marketplaceId: marketplace?.id ?? null,
      marketplaceName,
      region: "BR",
      generatedAt: new Date().toISOString(),
      signals,
      opportunities,
      seoSummary: summary,
      adBudget,
      adCopy: { headline, primaryText, targetingNotes, suggestedKeywords: topKeywords },
      regionalKeyword,
      regionalSummary,
      regionalRecommendations,
      aiProvider: aiProvider.name,
      trendsProvider: trendsProvider.name,
    };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
