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

export type SupplierNiche = "perfumes_arabes" | "perfumes_importados_originais" | "geral_b2b";

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
}

/** Whether a lead's typical MOQ/ticket make it better suited to holding stock, per-order dropshipping, or either. */
export type FulfillmentSuggestion = "estoque" | "dropshipping" | "ambos";

/** A SupplierLead enriched with BRL conversion, landed cost, margin estimate and AI reasoning. */
export interface SourcingOption {
  leadId: string;
  name: string;
  niche: SupplierNiche;
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
  reasoning: string;
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
