import {
  AIProvider,
  ExplainRecommendationInput,
  ExplainRecommendationOutput,
  GenerateListingContentInput,
  GenerateListingContentOutput,
} from "./AIProvider.js";

const BENEFIT_ANGLES = [
  "entrega rápida",
  "qualidade premium",
  "melhor custo-benefício",
  "mais vendido da categoria",
  "satisfação garantida",
  "original com nota fiscal",
  "pronta entrega",
  "novidade em estoque",
];

const URGENCY_TAGS = ["Oferta", "Últimas unidades", "Mais vendido", "Promoção", "Exclusivo", "Novo"];

function titleCase(s: string): string {
  return s
    .split(" ")
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

/**
 * Deterministic, dependency-free AI substitute. Used when no LLM provider
 * is configured/reachable, and as the default so the product works out of
 * the box. Produces plausible, rule-based reasoning and listing variations
 * that rotate over time to avoid stale/duplicate SEO content.
 */
export class HeuristicProvider implements AIProvider {
  readonly name = "heuristic";

  async explainRecommendation(input: ExplainRecommendationInput): Promise<ExplainRecommendationOutput> {
    const reasoningByMarketplace: Record<string, string> = {};
    for (const entry of input.ranking) {
      const { demand, competition, fees, categoryFit, netMarginEstimate } = entry.breakdown;
      const parts: string[] = [];
      parts.push(
        demand >= 70
          ? "alta demanda de busca para essa categoria"
          : demand >= 45
            ? "demanda moderada de busca"
            : "demanda de busca ainda baixa"
      );
      parts.push(
        competition <= 40
          ? "baixa concorrência de vendedores"
          : competition <= 65
            ? "concorrência mediana"
            : "concorrência bastante alta"
      );
      parts.push(`taxa de ${fees.toFixed(1)}% sobre a venda`);
      parts.push(
        categoryFit >= 75
          ? "forte histórico de vendas nessa categoria"
          : "encaixe apenas razoável para essa categoria"
      );
      parts.push(`margem líquida estimada de ${netMarginEstimate.toFixed(1)}%`);
      reasoningByMarketplace[entry.marketplaceId] =
        `${entry.marketplaceName}: ${parts.join(", ")}. Pontuação final ${entry.score.toFixed(1)}/100.`;
    }
    return { reasoningByMarketplace };
  }

  async generateListingContent(input: GenerateListingContentInput): Promise<GenerateListingContentOutput> {
    const { product, marketplace, iteration } = input;
    const angle = pick(BENEFIT_ANGLES, iteration);
    const tag = pick(URGENCY_TAGS, iteration + 3);

    const baseKeywords = Array.from(
      new Set([...product.keywords, product.category, ...angle.split(" ")])
    ).filter(Boolean);

    // Rotate keyword order each cycle so the SEO signal keeps refreshing
    // instead of the marketplace seeing the exact same string forever.
    const rotated = [...baseKeywords.slice(iteration % baseKeywords.length), ...baseKeywords.slice(0, iteration % baseKeywords.length)];
    const keywords = rotated.slice(0, marketplace.maxKeywords);

    const rawTitle = `${tag}: ${titleCase(product.name)} - ${titleCase(angle)}`;
    const title = truncate(rawTitle, marketplace.titleMaxLength);

    const rawDescription = [
      `${titleCase(product.name)} — ${angle}.`,
      product.description,
      `Categoria: ${titleCase(product.category)}.`,
      `Palavras-chave: ${keywords.join(", ")}.`,
      `Por que comprar agora: ${tag.toLowerCase()}, estoque atualizado e reputação consolidada no marketplace.`,
    ].join("\n\n");
    const description = truncate(rawDescription, marketplace.descriptionMaxLength);

    return {
      title,
      description,
      keywords,
      changeReason: `Rotação automática de SEO (ciclo #${iteration}) para evitar estagnação no ranking: novo ângulo "${angle}" e chamada "${tag}".`,
    };
  }
}
