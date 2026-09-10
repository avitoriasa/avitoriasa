import { RisingQuery, TrendDirection, TrendSignal } from "../types.js";

/**
 * Curated reference dataset of search-interest signals for Brazil, used as
 * the default TrendsProvider (see services/trendsProvider.ts). There is no
 * official free Google Trends API — the unofficial "pytrends" scraper
 * library was archived in 2025, and the closest thing to an official API is
 * a gated alpha that only Google-approved partners can use. Real-time data
 * IS available through paid third-party providers (SerpApi, DataForSEO),
 * wired in as SerpApiTrendsProvider when SERPAPI_KEY is configured — this
 * dataset is what the app falls back to (or runs on, by default) instead of
 * pretending to scrape Google directly.
 *
 * interestScore/direction/risingQueries below are hand-curated snapshots
 * (0-100 relative interest, same scale Google Trends itself uses), not a
 * live measurement. Keep entries broad enough that keyword matching in
 * seoTrendsService.ts finds a reasonable hit for most beauty products.
 */
const entry = (
  keyword: string,
  interestScore: number,
  direction: TrendDirection,
  risingQueries: RisingQuery[]
): TrendSignal => ({
  keyword,
  region: "BR",
  interestScore,
  direction,
  risingQueries,
  source: "curado",
  updatedAt: new Date().toISOString(),
});

export const CURATED_TREND_SIGNALS: TrendSignal[] = [
  entry("perfume importado", 78, "subindo", [
    { query: "perfume importado feminino barato", growthPercent: 35 },
    { query: "perfume importado original", growthPercent: 20 },
  ]),
  entry("perfume árabe", 82, "subindo", [
    { query: "perfume árabe feminino", growthPercent: 40 },
    { query: "perfume árabe amadeirado", growthPercent: 22 },
  ]),
  entry("perfume feminino", 74, "estavel", [
    { query: "perfume feminino que fixa muito", growthPercent: 18 },
  ]),
  entry("perfume masculino", 70, "estavel", [
    { query: "perfume masculino amadeirado", growthPercent: 15 },
  ]),
  entry("perfume contratipo", 65, "subindo", [
    { query: "perfume contratipo bom", growthPercent: 28 },
  ]),
  entry("skincare coreano", 80, "subindo", [
    { query: "skincare coreano para pele oleosa", growthPercent: 45 },
    { query: "rotina skincare coreana passo a passo", growthPercent: 30 },
  ]),
  entry("ácido hialurônico", 68, "estavel", [
    { query: "sérum ácido hialurônico", growthPercent: 12 },
  ]),
  entry("protetor solar facial", 85, "subindo", [
    { query: "protetor solar facial com cor", growthPercent: 38 },
    { query: "protetor solar oil free", growthPercent: 25 },
  ]),
  entry("sérum vitamina c", 72, "subindo", [
    { query: "sérum vitamina c para manchas", growthPercent: 20 },
  ]),
  entry("hidratante facial", 60, "estavel", [
    { query: "hidratante facial pele seca", growthPercent: 10 },
  ]),
  entry("batom matte", 63, "estavel", [
    { query: "batom matte vermelho", growthPercent: 14 },
  ]),
  entry("base líquida", 66, "estavel", [
    { query: "base líquida cobertura alta", growthPercent: 16 },
  ]),
  entry("paleta de sombras", 58, "caindo", [
    { query: "paleta de sombras nude", growthPercent: 5 },
  ]),
  entry("máscara capilar", 61, "subindo", [
    { query: "máscara capilar hidratação profunda", growthPercent: 24 },
  ]),
  entry("shampoo antiqueda", 64, "estavel", [
    { query: "shampoo antiqueda feminino", growthPercent: 11 },
  ]),
  entry("óleo capilar", 55, "subindo", [
    { query: "óleo capilar finalizador", growthPercent: 19 },
  ]),
  entry("kit presente maquiagem", 69, "subindo", [
    { query: "kit presente maquiagem dia das mães", growthPercent: 50 },
  ]),
  entry("beleza importados", 59, "estavel", [
    { query: "cosméticos importados originais", growthPercent: 13 },
  ]),
];

/** Generic, honestly-neutral fallback for a keyword with no curated match — never invents a rising trend. */
export function genericFallbackSignal(keyword: string): TrendSignal {
  return {
    keyword,
    region: "BR",
    interestScore: 40,
    direction: "estavel",
    risingQueries: [],
    source: "estimativa genérica (sem dado curado para este termo)",
    updatedAt: new Date().toISOString(),
  };
}
