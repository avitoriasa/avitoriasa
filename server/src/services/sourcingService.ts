import { AIProvider } from "../ai/index.js";
import { FX_METHODS } from "../data/fxMethods.js";
import { SUPPLIER_LEADS } from "../data/supplierLeads.js";
import {
  BeautyCategory,
  FulfillmentSuggestion,
  FxMethod,
  SourcingOption,
  SourcingResearchResult,
  SupplierLead,
  SupplierNiche,
} from "../types.js";

/**
 * Heuristic: low-MOQ, higher-ticket channels (typically parallel-import
 * originais) are a better fit for per-order dropshipping than for holding
 * stock — less capital at risk, and you don't need to move dozens of units
 * of an expensive, authenticity-sensitive item to justify buying it. High-MOQ
 * own-brand wholesale (K-beauty, arabic perfume houses, general B2B) fits the
 * traditional buy-stock-and-resell model instead.
 */
function suggestFulfillment(lead: SupplierLead): FulfillmentSuggestion {
  if (lead.moq > 25) return "estoque";
  return lead.niche === "importados_originais_marca" ? "dropshipping" : "ambos";
}

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

const CATEGORY_KEYWORDS: Partial<Record<BeautyCategory, string[]>> = {
  perfumes: ["perfume", "perfumes", "perfumaria", "colonia", "fragrancia"],
  skincare: ["skincare", "pele", "hidratante", "serum", "toner", "protetor solar", "coreano", "k-beauty", "kbeauty"],
  maquiagem: ["maquiagem", "makeup", "batom", "base", "paleta"],
  cabelo: ["cabelo", "capilar", "shampoo", "condicionador", "haircare"],
};

const NICHE_KEYWORDS: Record<SupplierNiche, string[]> = {
  marca_propria_atacado: [
    "marca propria",
    "atacado direto",
    "oud",
    "khamrah",
    "lattafa",
    "rasasi",
    "ajmal",
    "swiss arabian",
    "cosrx",
    "anua",
    "joseon",
  ],
  importados_originais_marca: ["original", "originais", "importado", "importados", "grife", "luxo", "designer", "paralelo"],
  geral_b2b: ["alibaba", "tradekey", "b2b", "atacado geral"],
};

/** Which beauty categories a query is specifically about. Empty means "not category-specific". */
function inferQueryCategories(normalizedQuery: string): BeautyCategory[] {
  return (Object.keys(CATEGORY_KEYWORDS) as BeautyCategory[]).filter((category) =>
    (CATEGORY_KEYWORDS[category] ?? []).some((kw) => normalizedQuery.includes(kw))
  );
}

/** Which sourcing niches a query is specifically about. Empty means "not niche-specific". */
function inferQueryNiches(normalizedQuery: string): SupplierNiche[] {
  const niches = (Object.keys(NICHE_KEYWORDS) as SupplierNiche[]).filter((niche) =>
    NICHE_KEYWORDS[niche].some((kw) => normalizedQuery.includes(kw))
  );
  // General B2B platforms (Alibaba, TradeKey) are valid channels for sourcing
  // own-brand wholesale too, so surface them alongside that niche.
  if (niches.includes("marca_propria_atacado") && !niches.includes("geral_b2b")) niches.push("geral_b2b");
  return niches;
}

function matchesQuery(lead: SupplierLead, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;

  const categories = inferQueryCategories(normalizedQuery);
  const niches = inferQueryNiches(normalizedQuery);

  if (categories.length === 0 && niches.length === 0) {
    // No structured keyword hit — a generic "beleza" query matches
    // everything; otherwise treat it as a direct name/product lookup.
    if (normalizedQuery.includes("beleza")) return true;
    const nameHit = normalize(lead.name).includes(normalizedQuery);
    const productHit = lead.productExamples.some((p) => normalize(p).includes(normalizedQuery));
    return nameHit || productHit;
  }

  // Cross-category B2B platforms stay visible whenever a category is picked.
  const categoryOk = categories.length === 0 || categories.includes(lead.category) || lead.category === "beleza_geral";
  const nicheOk = niches.length === 0 || niches.includes(lead.niche);
  return categoryOk && nicheOk;
}

/**
 * Pure computation of a SourcingOption's numbers from a lead + current
 * rates — no AI call, no reasoning. Shared by researchSuppliers (bulk, for
 * the search results) and agentOrchestrator (single lead, for the
 * onboarding pipeline) so the math never drifts between the two call sites.
 */
export function computeOption(
  lead: SupplierLead,
  usdToBrlRate: number,
  importTaxPercent: number,
  desiredResalePrice: number | undefined
): Omit<SourcingOption, "reasoning"> {
  const unitCostBrlMin = round2(lead.unitCostUsdMin * usdToBrlRate);
  const unitCostBrlMax = round2(lead.unitCostUsdMax * usdToBrlRate);
  const freightBrlPerUnit = round2(lead.freightUsdPerUnit * usdToBrlRate);
  const taxMultiplier = 1 + importTaxPercent / 100;
  // "Landed cost" = unit cost + freight, marked up by the reference import
  // tax rate — this is the automatic "lowest total cost" ranking key the
  // user asked for (not just the sticker price abroad).
  const landedCostBrlMin = round2((unitCostBrlMin + freightBrlPerUnit) * taxMultiplier);
  const landedCostBrlMax = round2((unitCostBrlMax + freightBrlPerUnit) * taxMultiplier);
  const avgLandedCostBrl = (landedCostBrlMin + landedCostBrlMax) / 2;
  const estimatedMarginPercent =
    desiredResalePrice && desiredResalePrice > 0
      ? round2(((desiredResalePrice - avgLandedCostBrl) / desiredResalePrice) * 100)
      : null;

  return {
    leadId: lead.id,
    name: lead.name,
    niche: lead.niche,
    category: lead.category,
    channel: lead.channel,
    country: lead.country,
    unitCostUsdMin: lead.unitCostUsdMin,
    unitCostUsdMax: lead.unitCostUsdMax,
    unitCostBrlMin,
    unitCostBrlMax,
    freightUsdPerUnit: lead.freightUsdPerUnit,
    freightBrlPerUnit,
    landedCostBrlMin,
    landedCostBrlMax,
    moq: lead.moq,
    leadTimeDays: lead.leadTimeDays,
    riskNotes: lead.riskNotes,
    productExamples: lead.productExamples,
    estimatedMarginPercent,
    suggestedFulfillment: suggestFulfillment(lead),
    trustTier: lead.trustTier,
    trustScore: lead.trustScore,
    trustSignals: lead.trustSignals,
  };
}

export async function researchSuppliers(
  query: string,
  usdToBrlRate: number,
  importTaxPercent: number,
  desiredResalePrice: number | undefined,
  aiProvider: AIProvider
): Promise<SourcingResearchResult> {
  const normalizedQuery = normalize(query);
  const matched = normalizedQuery ? SUPPLIER_LEADS.filter((lead) => matchesQuery(lead, normalizedQuery)) : SUPPLIER_LEADS;
  const leads = matched.length > 0 ? matched : SUPPLIER_LEADS;

  const optionsWithoutReasoning: Omit<SourcingOption, "reasoning">[] = leads.map((lead) =>
    computeOption(lead, usdToBrlRate, importTaxPercent, desiredResalePrice)
  );

  // Automatic ranking: lowest total landed cost (unit cost + freight + import
  // taxes) first — not just the cheapest sticker price abroad.
  optionsWithoutReasoning.sort((a, b) => a.landedCostBrlMin - b.landedCostBrlMin);

  const { summary, reasoningByLeadId } = await aiProvider.researchSuppliers({
    query,
    options: optionsWithoutReasoning,
  });

  const options: SourcingOption[] = optionsWithoutReasoning.map((option) => ({
    ...option,
    reasoning: reasoningByLeadId[option.leadId] ?? "",
  }));

  return { query, usdToBrlRate, importTaxPercent, summary, aiProvider: aiProvider.name, options };
}

export function listFxMethods(): FxMethod[] {
  return FX_METHODS;
}

export function findLeadById(leadId: string): SupplierLead | undefined {
  return SUPPLIER_LEADS.find((lead) => lead.id === leadId);
}
