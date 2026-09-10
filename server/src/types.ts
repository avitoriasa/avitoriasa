/**
 * "stock": você compra no atacado, guarda estoque e despacha as vendas você
 * mesmo (fluxo de Sourcing + costBasis já existente).
 * "dropship": sem estoque — cada pedido é comprado individualmente (ex.: no
 * varejo dos EUA) só depois que a venda acontece, e enviado direto ao
 * cliente final. Normalmente faz sentido para itens de ticket alto/baixo
 * giro (ex.: grifes originais) onde manter estoque não compensa.
 */
export type FulfillmentMode = "stock" | "dropship";

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  /**
   * Preço líquido que o vendedor quer receber por unidade vendida (o valor
   * publicado em cada marketplace é maior, para cobrir a taxa daquele
   * marketplace — ver PricingBreakdown / pricingService.ts).
   */
  basePrice: number;
  /** Custo de aquisição (landed cost) por unidade, se o produto veio de uma opção de fornecimento. Opcional. */
  costBasis?: number;
  fulfillmentMode: FulfillmentMode;
  sku: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Marketplace {
  id: string;
  slug: string;
  name: string;
  feePercent: number;
  /** Flat per-item fee some marketplaces charge on top of the percentage (e.g. TikTok Shop above R$50). Defaults to 0. */
  fixedFeeBrl?: number;
  titleMaxLength: number;
  descriptionMaxLength: number;
  maxKeywords: number;
  notes: string;
}

export type ConnectionStatus = "disconnected" | "connected" | "pending";

/**
 * Breakdown of how a product's desired net price (Product.basePrice)
 * translates into the price actually published on a given marketplace,
 * using reverse pricing so the seller nets exactly `basePrice` after the
 * marketplace deducts its fee: listingPrice = basePrice / (1 - feePercent/100).
 */
export interface PricingBreakdown {
  basePrice: number;
  feePercent: number;
  fixedFeeBrl: number;
  feeAmount: number;
  listingPrice: number;
}

export interface ProductMarketplaceConnection {
  id: string;
  productId: string;
  marketplaceId: string;
  status: ConnectionStatus;
  externalListingId: string | null;
  currentTitle: string;
  currentDescription: string;
  currentKeywords: string[];
  pricing: PricingBreakdown;
  rankScore: number;
  lastOptimizedAt: string | null;
  createdAt: string;
}

export interface MarketSignal {
  marketplaceId: string;
  category: string;
  demandScore: number; // 0-100, simulated buyer search demand
  competitionScore: number; // 0-100, higher = more competitors
  avgConversionRate: number; // 0-1
  categoryFit: number; // 0-100, how well this category performs on this marketplace
}

export interface RecommendationEntry {
  marketplaceId: string;
  marketplaceName: string;
  score: number;
  reasoning: string;
  breakdown: {
    demand: number;
    competition: number;
    fees: number;
    categoryFit: number;
    netMarginEstimate: number;
  };
  pricing: PricingBreakdown;
}

export interface RecommendationResult {
  id: string;
  productId: string;
  generatedAt: string;
  aiProvider: string;
  ranking: RecommendationEntry[];
  topPick: string;
}

export interface OptimizationLogEntry {
  id: string;
  connectionId: string;
  productId: string;
  marketplaceId: string;
  previousTitle: string;
  newTitle: string;
  previousDescription: string;
  newDescription: string;
  previousKeywords: string[];
  newKeywords: string[];
  reason: string;
  aiProvider: string;
  createdAt: string;
}

export type OrderStatus = "pending_payout" | "paid_out";

/**
 * A sale captured from a marketplace. Today these are simulated by
 * MarketplaceAdapter.fetchOrders (see adapters/MarketplaceAdapter.ts) so the
 * financial view works without real credentials. Swap that adapter method
 * for the marketplace's real Orders/Settlement API and this shape (and
 * everything downstream) keeps working unchanged.
 */
export interface Order {
  id: string;
  connectionId: string;
  productId: string;
  marketplaceId: string;
  externalOrderId: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  status: OrderStatus;
  soldAt: string;
  payoutExpectedAt: string;
  fulfillmentMode: FulfillmentMode;
  /** Dropship only: o que você pagou na fonte de varejo (ex.: preço com cupom via Honey) para atender esse pedido específico. */
  sourcePurchaseCostBrl?: number;
  /** Dropship only: estimativa de imposto de remessa (ICMS + II quando aplicável) sobre essa compra pontual. */
  sourceTaxEstimateBrl?: number;
  /** Dropship only: lucro estimado = netAmount - sourcePurchaseCostBrl - sourceTaxEstimateBrl. */
  dropshipProfitBrl?: number;
  trackingCarrier?: string;
  trackingNumber?: string;
  /** Link público de rastreio, quando o transportador suporta (ex.: USPS). */
  trackingUrl?: string;
}

export interface FinancialSummary {
  orderCount: number;
  grossTotal: number;
  feeTotal: number;
  netTotal: number;
  pendingPayout: number;
  paidOut: number;
}

export interface AppSettings {
  aiProvider: "ollama" | "heuristic";
  ollamaBaseUrl: string;
  ollamaModel: string;
  optimizationIntervalHours: number;
  optimizationCooldownHours: number;
  /**
   * Cotação USD→BRL usada para converter custos de fornecedores estrangeiros.
   * Não é uma cotação ao vivo — atualize manualmente em Configurações.
   */
  usdToBrlRate: number;
  /**
   * Estimativa grosseira da carga tributária combinada de importação comercial
   * (II + IPI + PIS/COFINS monofásico + ICMS, aplicada sobre custo + frete).
   * Varia por NCM, estado e regime tributário — não é um valor oficial;
   * confirme com um despachante aduaneiro/contador antes de importar.
   */
  importTaxPercent: number;
  /**
   * ICMS de referência para compras individuais via regime de remessa (usado
   * na calculadora de dropshipping, não no import comercial em volume).
   * Varia por estado — confirme antes de usar em produção real.
   */
  remessaIcmsPercent: number;
}

/**
 * How a sourcing channel is structured, which drives its authenticity risk:
 * "marca_propria_atacado": direct wholesale from the brand/manufacturer's
 * own line (own trademark, e.g. a Korean skincare house or an Arabic
 * perfume house) — low authenticity risk.
 * "importados_originais_marca": parallel/gray-market import of a
 * third-party brand's genuine original goods (western perfumes, prestige
 * skincare/makeup) — higher risk, since the brand didn't choose this
 * distributor; always verify authenticity and paperwork.
 * "geral_b2b": general B2B sourcing platforms (Alibaba, TradeKey) usable
 * across categories.
 */
export type SupplierNiche = "marca_propria_atacado" | "importados_originais_marca" | "geral_b2b";

/** Broad beauty category a sourcing channel serves. */
export type BeautyCategory = "perfumes" | "skincare" | "maquiagem" | "cabelo" | "beleza_geral";

/** Curated trust tier for a sourcing channel — see supplierLeads.ts for the criteria behind each tier. */
export type TrustTier = "verificado" | "referencia" | "alerta";

/**
 * Curated reference entry for a sourcing channel — NOT live/scraped data.
 * Maintained by hand in server/src/data/supplierLeads.ts. Costs are typical
 * reference ranges; always confirm current price/MOQ/terms directly with
 * the supplier before buying.
 */
export interface SupplierLead {
  id: string;
  name: string;
  niche: SupplierNiche;
  category: BeautyCategory;
  channel: string;
  country: string;
  unitCostUsdMin: number;
  unitCostUsdMax: number;
  /** Reference air-freight/courier cost per unit at this lead's typical MOQ — NOT a live quote. */
  freightUsdPerUnit: number;
  moq: number;
  leadTimeDays: number;
  riskNotes: string;
  productExamples: string[];
  trustTier: TrustTier;
  /** 0-100, curated by hand from the trust signals below — not a live score. */
  trustScore: number;
  /** Concrete, checkable reasons behind the trust tier (e.g. "Marca própria registrada", "Trade Assurance"). */
  trustSignals: string[];
}

/** Whether a lead's typical MOQ/ticket make it better suited to holding stock, per-order dropshipping, or either. */
export type FulfillmentSuggestion = "estoque" | "dropshipping" | "ambos";

/** A SupplierLead enriched with BRL conversion, landed cost, margin estimate and AI reasoning. */
export interface SourcingOption {
  leadId: string;
  name: string;
  niche: SupplierNiche;
  category: BeautyCategory;
  channel: string;
  country: string;
  unitCostUsdMin: number;
  unitCostUsdMax: number;
  unitCostBrlMin: number;
  unitCostBrlMax: number;
  freightUsdPerUnit: number;
  freightBrlPerUnit: number;
  /** unitCost + freight, marked up by the reference import tax rate — the "menor custo" ranking key. */
  landedCostBrlMin: number;
  landedCostBrlMax: number;
  moq: number;
  leadTimeDays: number;
  riskNotes: string;
  productExamples: string[];
  estimatedMarginPercent: number | null;
  suggestedFulfillment: FulfillmentSuggestion;
  trustTier: TrustTier;
  trustScore: number;
  trustSignals: string[];
  reasoning: string;
}

/**
 * A supplier the USER has vetted and chosen to keep — distinct from the
 * curated reference catalog (SupplierLead): this is the user's own trusted
 * list, seeded optionally from a SourcingOption or entered by hand.
 */
export interface TrustedSupplier {
  id: string;
  name: string;
  category: BeautyCategory;
  channel: string;
  country: string;
  trustNotes: string;
  sourceLeadId?: string;
  addedAt: string;
}

export interface SourcingResearchResult {
  query: string;
  usdToBrlRate: number;
  importTaxPercent: number;
  summary: string;
  aiProvider: string;
  options: SourcingOption[];
}

/** Reference-only comparison of ways to pay an overseas supplier. Spreads are typical figures, not live rates. */
export interface FxMethod {
  id: string;
  name: string;
  typicalSpreadPercent: number;
  notes: string;
}

/**
 * Estimate for fulfilling a single dropship order: buy at retail abroad
 * (e.g. a US site, price-checked manually via a coupon/price tool) and ship
 * straight to the end customer, taxed under Brazil's individual/remessa
 * regime — a different, simpler regime than the bulk commercial import used
 * for stock. See sourcingService.estimateDropshipOrder for the formula.
 */
export interface DropshipEstimate {
  sourcePriceUsd: number;
  sourcePriceBrl: number;
  shippingBrl: number;
  /** Whether this parcel qualifies for the II-exempt compliant remessa program (≤ US$50, compliant platform). */
  iiExempt: boolean;
  iiBrl: number;
  icmsPercent: number;
  icmsBrl: number;
  totalLandedBrl: number;
}

export type StockMovementType = "purchase" | "sale" | "adjustment";

/** Immutable historical record of a change in stock — the audit trail behind InventoryItem's current balance. */
export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  /** Positive for stock coming in (purchase), negative for stock going out (sale/adjustment-down). */
  quantity: number;
  /** Only meaningful for "purchase" — what you paid per unit for this batch. */
  unitCostBrl?: number;
  note?: string;
  occurredAt: string;
}

/** Persisted shape of the InventoryItem entity (see domain/InventoryItem.ts for the behavior/invariants). */
export interface InventoryItemSnapshot {
  productId: string;
  quantityOnHand: number;
  /** Weighted-average unit cost across all purchases received so far. */
  avgUnitCostBrl: number;
  reorderPoint: number;
  updatedAt: string;
}

/** Output of the "trust analyst" agent — AI-written reasoning over a curated, already-computed trust tier/score. */
export interface SupplierTrustAssessment {
  leadId: string;
  trustTier: TrustTier;
  trustScore: number;
  reasoning: string;
}

/** Output of the "inventory planner" agent for a stock-mode product. */
export interface InventoryPlan {
  reorderPoint: number;
  reorderQuantity: number;
  reasoning: string;
}

/**
 * Result of running the full multi-agent onboarding pipeline for a chosen
 * SourcingOption: sourcing (already done) -> trust assessment -> inventory
 * plan (only when the suggested fulfillment isn't pure dropshipping). This
 * is the "esteira" (conveyor belt) the user asked for — each stage is a
 * distinct agent call, orchestrated by agentOrchestrator.ts.
 */
export interface OnboardingPipelineResult {
  option: SourcingOption;
  trustAssessment: SupplierTrustAssessment;
  inventoryPlan: InventoryPlan | null;
  aiProvider: string;
}

/** Whether a keyword's search interest is rising, flat or falling — see trendsProvider.ts. */
export type TrendDirection = "subindo" | "estavel" | "caindo";

/** A related search query gaining traction alongside a tracked keyword. */
export interface RisingQuery {
  query: string;
  /** Approximate growth vs. the prior period. Reference figure, not a live measurement unless SerpApi is configured. */
  growthPercent: number;
}

/**
 * Search-interest signal for one keyword in one region. By default this
 * comes from a curated reference dataset (data/trendSignals.ts) — there is
 * no official free Google Trends API. When SERPAPI_KEY is configured,
 * SerpApiTrendsProvider fetches real Google Trends data instead (see
 * services/trendsProvider.ts); either way the shape below is what the rest
 * of the pipeline consumes, and `source` says which one produced it.
 */
export interface TrendSignal {
  keyword: string;
  region: string;
  /** 0-100, Google Trends' own relative-interest scale (or a curated estimate). */
  interestScore: number;
  direction: TrendDirection;
  risingQueries: RisingQuery[];
  /** "google_trends" (real, via SerpApi) or "curado" (reference dataset, no live data). */
  source: string;
  updatedAt: string;
}

/**
 * A keyword ranked as an SEO opportunity for one product: interestScore
 * comes straight from a TrendSignal, relevanceScore is computed
 * deterministically (word-overlap against the product's own name/
 * description/category/keywords — see seoTrendsService.ts), and
 * combinedScore blends both. reasoning is the only AI-written field here.
 */
export interface SeoOpportunity {
  keyword: string;
  interestScore: number;
  relevanceScore: number;
  combinedScore: number;
  direction: TrendDirection;
  risingQueries: RisingQuery[];
  reasoning: string;
}

/**
 * Deterministic starting budget range for paid ads on a marketplace,
 * derived from the product's own net price (see seoTrendsService.
 * suggestAdBudget) — not a bid/spend automation, just a reference the
 * seller can start from and adjust by hand in that marketplace's own ads
 * manager.
 */
export interface AdBudgetSuggestion {
  dailyMinBrl: number;
  dailyMaxBrl: number;
  rationale: string;
}

/**
 * AI-drafted creative brief for a paid listing/ad — copy only. No
 * marketplace ad-platform is integrated here (no OAuth, no spend, no
 * campaign creation): this is a starting point to paste into that
 * marketplace's own ads manager.
 */
export interface AdCopyBrief {
  headline: string;
  primaryText: string;
  targetingNotes: string;
  suggestedKeywords: string[];
}

/** Full result of the "trends & SEO/ads" agent for one product (routes/trends.ts). */
export interface TrendsAnalysisResult {
  productId: string;
  marketplaceId: string | null;
  marketplaceName: string;
  region: string;
  generatedAt: string;
  signals: TrendSignal[];
  opportunities: SeoOpportunity[];
  seoSummary: string;
  adBudget: AdBudgetSuggestion;
  adCopy: AdCopyBrief;
  aiProvider: string;
  trendsProvider: string;
}
