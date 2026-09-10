import { MarketSignal } from "../types.js";

/**
 * Simulated market intelligence per (marketplace, category).
 *
 * There is no free, universal API for cross-marketplace demand/competition
 * data, so this produces a deterministic-but-plausible signal from a hash of
 * the category + marketplace slug, mixed with category affinity tables
 * curated from each marketplace's known strong categories. This keeps
 * recommendations stable across restarts while still varying by category.
 *
 * Swap this module for real calls once you have marketplace API credentials
 * (e.g. Mercado Livre's trends API, Amazon Selling Partner API reports) —
 * the rest of the app only depends on the MarketSignal shape below.
 */

const CATEGORY_AFFINITY: Record<string, Record<string, number>> = {
  "mercado-livre": { eletronicos: 90, casa: 80, moda: 60, esporte: 75, beleza: 55, brinquedos: 70, perfumes: 65 },
  shopee: { moda: 90, beleza: 85, brinquedos: 80, eletronicos: 60, casa: 60, esporte: 65, perfumes: 88 },
  "amazon-br": { eletronicos: 92, casa: 78, moda: 50, esporte: 70, beleza: 60, brinquedos: 65, perfumes: 70 },
  magalu: { casa: 90, eletronicos: 82, moda: 55, esporte: 60, beleza: 55, brinquedos: 60, perfumes: 55 },
  shein: { moda: 95, beleza: 88, brinquedos: 55, eletronicos: 30, casa: 40, esporte: 50, perfumes: 85 },
  "tiktok-shop": { beleza: 90, moda: 88, perfumes: 92, eletronicos: 55, casa: 45, esporte: 50, brinquedos: 60 },
  "youtube-shopping": { beleza: 82, moda: 70, perfumes: 85, eletronicos: 75, casa: 55, esporte: 60, brinquedos: 55 },
};

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pseudoRandom(seed: string, min: number, max: number): number {
  const h = hash(seed);
  const normalized = (h % 1000) / 1000;
  return Math.round(min + normalized * (max - min));
}

function normalizeCategory(category: string): string {
  return category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function getMarketSignal(marketplaceSlug: string, category: string): MarketSignal {
  const normalizedCategory = normalizeCategory(category);
  const affinityTable = CATEGORY_AFFINITY[marketplaceSlug] ?? {};
  const matchedKey = Object.keys(affinityTable).find(
    (key) => normalizedCategory.includes(key) || key.includes(normalizedCategory)
  );
  const categoryFit = matchedKey ? affinityTable[matchedKey] : pseudoRandom(`${marketplaceSlug}:${normalizedCategory}:fit`, 35, 65);

  const demandScore = pseudoRandom(`${marketplaceSlug}:${normalizedCategory}:demand`, 30, 95);
  const competitionScore = pseudoRandom(`${marketplaceSlug}:${normalizedCategory}:competition`, 20, 90);
  const avgConversionRate = pseudoRandom(`${marketplaceSlug}:${normalizedCategory}:conv`, 5, 40) / 100;

  return {
    marketplaceId: marketplaceSlug,
    category: normalizedCategory,
    demandScore,
    competitionScore,
    avgConversionRate,
    categoryFit,
  };
}
