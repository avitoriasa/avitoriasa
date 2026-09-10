import { ALL_REGIONS, REGION_ECOMMERCE_WEIGHT, REGION_LABELS } from "../data/regionalReference.js";
import { CURATED_TREND_SIGNALS } from "../data/trendSignals.js";
import { AdBudgetSuggestion, Product, RegionalRecommendation, RegionalSearchSignal, SeoOpportunity, TrendSignal } from "../types.js";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

/**
 * Builds the keyword list sent to the TrendsProvider for one product:
 * its own current keywords, category, and meaningful words from its name —
 * deduped. This is what "keywords related to the products I want to offer"
 * (the user's request) resolves to deterministically, before any AI call.
 */
export function buildKeywordCandidates(product: Pick<Product, "name" | "category" | "keywords">): string[] {
  const fromName = tokenize(product.name).join(" ");
  const candidates = [product.category, ...product.keywords, fromName, product.name].filter(Boolean);
  return Array.from(new Set(candidates.map((c) => c.trim().toLowerCase()))).slice(0, 8);
}

/**
 * Word-overlap relevance between a trend signal (its keyword + rising
 * queries) and a product's own name/description/category/keywords — 0-100.
 * Deterministic on purpose: how well a keyword actually matches the product
 * is not something the AI should judge or invent.
 */
function computeRelevance(product: Product, signal: TrendSignal): number {
  const productTokens = new Set([
    ...tokenize(product.name),
    ...tokenize(product.description),
    ...tokenize(product.category),
    ...product.keywords.flatMap(tokenize),
  ]);
  if (productTokens.size === 0) return 0;

  const signalTokens = new Set([...tokenize(signal.keyword), ...signal.risingQueries.flatMap((r) => tokenize(r.query))]);
  if (signalTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of signalTokens) {
    if (productTokens.has(token)) overlap++;
  }
  return Math.round((overlap / signalTokens.size) * 100);
}

/**
 * Ranks trend signals as SEO opportunities for a product: combines each
 * signal's own search-interest score with how relevant it is to this
 * specific product (word overlap), so a high-interest keyword unrelated to
 * the product doesn't outrank a closer, lower-volume match. `reasoning` is
 * left empty here — the AI agent (see routes/trends.ts) fills it in
 * afterwards, on top of these already-computed numbers.
 */
export function computeSeoOpportunities(product: Product, signals: TrendSignal[], limit = 8): SeoOpportunity[] {
  return signals
    .map((signal) => {
      const relevanceScore = computeRelevance(product, signal);
      const combinedScore = Math.round(signal.interestScore * 0.6 + relevanceScore * 0.4);
      return {
        keyword: signal.keyword,
        interestScore: signal.interestScore,
        relevanceScore,
        combinedScore,
        direction: signal.direction,
        risingQueries: signal.risingQueries,
        reasoning: "",
      };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);
}

/**
 * Deterministic starting budget range for paid ads, sized off the
 * product's own net price: 10%-30% of it per day, clamped to a sane floor
 * (R$10) and ceiling (R$300) so a very cheap or very expensive product
 * doesn't produce a nonsensical suggestion. This is a reference to type
 * into the marketplace's own ads manager, not a bid/spend automation.
 */
export function suggestAdBudget(product: Product): AdBudgetSuggestion {
  const dailyMinBrl = Math.min(300, Math.max(10, Math.round(product.basePrice * 0.1)));
  const dailyMaxBrl = Math.min(300, Math.max(dailyMinBrl + 10, Math.round(product.basePrice * 0.3)));
  return {
    dailyMinBrl,
    dailyMaxBrl,
    rationale: `Faixa de referência entre 10% e 30% do preço líquido do produto (${product.basePrice.toFixed(
      2
    )}) por dia, limitada entre R$ 10 e R$ 300 — ponto de partida para ajustar manualmente no gerenciador de anúncios de cada marketplace, não um lance automático.`,
  };
}

/** All curated keywords — used by routes/trends.ts to expose what the reference dataset covers, if needed. */
export function listCuratedKeywords(): string[] {
  return CURATED_TREND_SIGNALS.map((s) => s.keyword);
}

/**
 * Blends a region's real (or curated-fallback) search-interest score with
 * its curated e-commerce/logistics reference weight (regionalReference.ts)
 * into a single "purchase propensity" figure — deliberately NOT presented
 * as real sales data, since no live API reports actual purchases by region
 * for an arbitrary product. Equal-weighted so a region with strong search
 * but weak buying infrastructure (or vice-versa) pulls the score down
 * instead of one side masking the other.
 */
function computePurchasePropensity(interestScore: number, region: RegionalRecommendation["region"]): number {
  return Math.round(interestScore * 0.5 + REGION_ECOMMERCE_WEIGHT[region] * 0.5);
}

/**
 * Deterministic verdict from both scores — this is what surfaces the
 * "alta busca mas baixa compra" (or the reverse) divergence the seller
 * cares about, instead of collapsing everything into one number: both high
 * means prioritize spend there; only one high means watch it (opportunity
 * or under-monetized interest); both low means low priority for now.
 */
function classifyRegionalVerdict(interestScore: number, purchasePropensityScore: number): RegionalRecommendation["verdict"] {
  const HIGH = 60;
  if (interestScore >= HIGH && purchasePropensityScore >= HIGH) return "priorizar";
  if (interestScore >= HIGH || purchasePropensityScore >= HIGH) return "monitorar";
  return "baixa_prioridade";
}

/**
 * Ranks all 5 Brazilian macro-regions for one keyword's regional search
 * signals — reasoning left empty for the AI agent to fill in afterwards
 * (see routes/trends.ts / AIProvider.analyzeRegionalDemand).
 */
export function buildRegionalRecommendations(signals: RegionalSearchSignal[]): Omit<RegionalRecommendation, "reasoning">[] {
  return ALL_REGIONS.map((region) => {
    const signal = signals.find((s) => s.region === region);
    const interestScore = signal?.interestScore ?? 0;
    const purchasePropensityScore = computePurchasePropensity(interestScore, region);
    return {
      region,
      regionLabel: REGION_LABELS[region],
      interestScore,
      purchasePropensityScore,
      verdict: classifyRegionalVerdict(interestScore, purchasePropensityScore),
    };
  }).sort((a, b) => b.purchasePropensityScore - a.purchasePropensityScore);
}
