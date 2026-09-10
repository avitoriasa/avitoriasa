import { AIProvider } from "../ai/index.js";
import { FX_METHODS } from "../data/fxMethods.js";
import { SUPPLIER_LEADS } from "../data/supplierLeads.js";
import { FxMethod, SourcingOption, SourcingResearchResult, SupplierLead, SupplierNiche } from "../types.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

const NICHE_KEYWORDS: Record<SupplierNiche, string[]> = {
  perfumes_arabes: ["arabe", "arabes", "oud", "khamrah", "lattafa", "rasasi", "ajmal", "swiss arabian"],
  perfumes_importados_originais: ["original", "originais", "importado", "importados", "grife", "luxo", "designer"],
  geral_b2b: ["alibaba", "tradekey", "b2b", "atacado geral"],
};

/** Which niches a query is specifically about, based on keyword hits. Empty means "not niche-specific". */
function inferQueryNiches(normalizedQuery: string): SupplierNiche[] {
  const niches = (Object.keys(NICHE_KEYWORDS) as SupplierNiche[]).filter((niche) =>
    NICHE_KEYWORDS[niche].some((kw) => normalizedQuery.includes(kw))
  );
  // General B2B platforms (Alibaba, TradeKey) are valid channels for sourcing
  // arabic/private-label perfumes too, so surface them alongside that niche.
  if (niches.includes("perfumes_arabes") && !niches.includes("geral_b2b")) niches.push("geral_b2b");
  return niches;
}

function matchesQuery(lead: SupplierLead, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;

  const targetNiches = inferQueryNiches(normalizedQuery);
  if (targetNiches.length > 0) return targetNiches.includes(lead.niche);

  // No niche keyword matched — treat as a generic search across everything,
  // or a direct name/product lookup.
  if (normalizedQuery.includes("perfume") || normalizedQuery.includes("perfumaria")) return true;
  const nameHit = normalize(lead.name).includes(normalizedQuery);
  const productHit = lead.productExamples.some((p) => normalize(p).includes(normalizedQuery));
  return nameHit || productHit;
}

export async function researchSuppliers(
  query: string,
  usdToBrlRate: number,
  desiredResalePrice: number | undefined,
  aiProvider: AIProvider
): Promise<SourcingResearchResult> {
  const normalizedQuery = normalize(query);
  const matched = normalizedQuery ? SUPPLIER_LEADS.filter((lead) => matchesQuery(lead, normalizedQuery)) : SUPPLIER_LEADS;
  const leads = matched.length > 0 ? matched : SUPPLIER_LEADS;

  const optionsWithoutReasoning: Omit<SourcingOption, "reasoning">[] = leads.map((lead) => {
    const unitCostBrlMin = round2(lead.unitCostUsdMin * usdToBrlRate);
    const unitCostBrlMax = round2(lead.unitCostUsdMax * usdToBrlRate);
    const avgCostBrl = (unitCostBrlMin + unitCostBrlMax) / 2;
    const estimatedMarginPercent =
      desiredResalePrice && desiredResalePrice > 0
        ? round2(((desiredResalePrice - avgCostBrl) / desiredResalePrice) * 100)
        : null;

    return {
      leadId: lead.id,
      name: lead.name,
      niche: lead.niche,
      channel: lead.channel,
      country: lead.country,
      unitCostUsdMin: lead.unitCostUsdMin,
      unitCostUsdMax: lead.unitCostUsdMax,
      unitCostBrlMin,
      unitCostBrlMax,
      moq: lead.moq,
      leadTimeDays: lead.leadTimeDays,
      riskNotes: lead.riskNotes,
      productExamples: lead.productExamples,
      estimatedMarginPercent,
    };
  });

  // Best margin (or lowest cost, when no target resale price was given) first.
  optionsWithoutReasoning.sort((a, b) => {
    if (a.estimatedMarginPercent !== null && b.estimatedMarginPercent !== null) {
      return b.estimatedMarginPercent - a.estimatedMarginPercent;
    }
    return a.unitCostBrlMin - b.unitCostBrlMin;
  });

  const { summary, reasoningByLeadId } = await aiProvider.researchSuppliers({
    query,
    options: optionsWithoutReasoning,
  });

  const options: SourcingOption[] = optionsWithoutReasoning.map((option) => ({
    ...option,
    reasoning: reasoningByLeadId[option.leadId] ?? "",
  }));

  return { query, usdToBrlRate, summary, aiProvider: aiProvider.name, options };
}

export function listFxMethods(): FxMethod[] {
  return FX_METHODS;
}
