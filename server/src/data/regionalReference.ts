import { RegionCode } from "../types.js";

/** Brazilian state (UF) -> macro-region, used to bucket SerpApi's state-level Google Trends breakdown. */
export const STATE_TO_REGION: Record<string, RegionCode> = {
  AC: "norte", AP: "norte", AM: "norte", PA: "norte", RO: "norte", RR: "norte", TO: "norte",
  AL: "nordeste", BA: "nordeste", CE: "nordeste", MA: "nordeste", PB: "nordeste", PE: "nordeste",
  PI: "nordeste", RN: "nordeste", SE: "nordeste",
  DF: "centro_oeste", GO: "centro_oeste", MT: "centro_oeste", MS: "centro_oeste",
  ES: "sudeste", MG: "sudeste", RJ: "sudeste", SP: "sudeste",
  PR: "sul", RS: "sul", SC: "sul",
};

export const REGION_LABELS: Record<RegionCode, string> = {
  norte: "Norte",
  nordeste: "Nordeste",
  centro_oeste: "Centro-Oeste",
  sudeste: "Sudeste",
  sul: "Sul",
};

export const ALL_REGIONS: RegionCode[] = ["norte", "nordeste", "centro_oeste", "sudeste", "sul"];

/**
 * Rough, hand-curated reference index (0-100) of relative e-commerce
 * purchasing power/logistics maturity per macro-region — NOT an official or
 * precise statistic. There is no live/free API that reports actual PURCHASE
 * volume by region for an arbitrary product; only search interest (Google
 * Trends) is available live. This index exists so the app can distinguish
 * "people search for this here" (real, from Google Trends) from "this
 * region has historically had more purchasing power/delivery infrastructure
 * to convert that search into a sale" (a directional estimate).
 *
 * Directionally grounded in widely-reported 2025/2026 Brazilian e-commerce
 * market data: São Paulo alone accounts for roughly 55% of national online
 * sales revenue and Minas Gerais another ~13% (both Sudeste), while the
 * Nordeste — with a much larger population — represents only ~10% of
 * orders, reflecting weaker delivery/payment infrastructure and lower
 * average ticket, not lower interest. Adjust these numbers if you have
 * better regional data (e.g. your own marketplace's seller dashboard).
 */
export const REGION_ECOMMERCE_WEIGHT: Record<RegionCode, number> = {
  sudeste: 100,
  sul: 62,
  centro_oeste: 40,
  nordeste: 38,
  norte: 25,
};
