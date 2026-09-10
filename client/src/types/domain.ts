/**
 * "stock": compra no atacado, guarda estoque e despacha as vendas.
 * "dropship": sem estoque — cada pedido é comprado individualmente (ex.: no
 * varejo dos EUA) só depois da venda, e enviado direto ao cliente final.
 */
export type FulfillmentMode = "stock" | "dropship";

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Preço líquido que você quer receber por unidade vendida (sem a taxa do marketplace). */
  basePrice: number;
  /** Custo de aquisição (landed cost) por unidade, se o produto veio de uma opção de fornecimento. */
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
  fixedFeeBrl?: number;
  titleMaxLength: number;
  descriptionMaxLength: number;
  maxKeywords: number;
  notes: string;
}

export type ConnectionStatus = "disconnected" | "connected" | "pending";

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
  sourcePurchaseCostBrl?: number;
  sourceTaxEstimateBrl?: number;
  dropshipProfitBrl?: number;
  trackingCarrier?: string;
  trackingNumber?: string;
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
  usdToBrlRate: number;
  importTaxPercent: number;
  remessaIcmsPercent: number;
}

export type SupplierNiche = "perfumes_arabes" | "perfumes_importados_originais" | "geral_b2b";
export type FulfillmentSuggestion = "estoque" | "dropshipping" | "ambos";

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

export interface FxMethod {
  id: string;
  name: string;
  typicalSpreadPercent: number;
  notes: string;
}

export interface DropshipEstimate {
  sourcePriceUsd: number;
  sourcePriceBrl: number;
  shippingBrl: number;
  iiExempt: boolean;
  iiBrl: number;
  icmsPercent: number;
  icmsBrl: number;
  totalLandedBrl: number;
}
