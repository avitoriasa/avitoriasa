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

export type SupplierNiche = "marca_propria_atacado" | "importados_originais_marca" | "geral_b2b";
export type BeautyCategory = "perfumes" | "skincare" | "maquiagem" | "cabelo" | "beleza_geral";
export type TrustTier = "verificado" | "referencia" | "alerta";
export type FulfillmentSuggestion = "estoque" | "dropshipping" | "ambos";

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

export type StockMovementType = "purchase" | "sale" | "adjustment";

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  unitCostBrl?: number;
  note?: string;
  occurredAt: string;
}

export interface InventorySummary {
  productId: string;
  productName?: string;
  sku?: string;
  quantityOnHand: number;
  averageUnitCostBrl: number;
  reorderPoint: number;
  isLowStock: boolean;
}

export interface SupplierTrustAssessment {
  leadId: string;
  trustTier: TrustTier;
  trustScore: number;
  reasoning: string;
}

export interface InventoryPlan {
  reorderPoint: number;
  reorderQuantity: number;
  reasoning: string;
}

export interface OnboardingPipelineResult {
  option: SourcingOption;
  trustAssessment: SupplierTrustAssessment;
  inventoryPlan: InventoryPlan | null;
  aiProvider: string;
}

export type TrendDirection = "subindo" | "estavel" | "caindo";

export interface RisingQuery {
  query: string;
  growthPercent: number;
}

export interface TrendSignal {
  keyword: string;
  region: string;
  interestScore: number;
  direction: TrendDirection;
  risingQueries: RisingQuery[];
  source: string;
  updatedAt: string;
}

export interface SeoOpportunity {
  keyword: string;
  interestScore: number;
  relevanceScore: number;
  combinedScore: number;
  direction: TrendDirection;
  risingQueries: RisingQuery[];
  reasoning: string;
}

export interface AdBudgetSuggestion {
  dailyMinBrl: number;
  dailyMaxBrl: number;
  rationale: string;
}

export interface AdCopyBrief {
  headline: string;
  primaryText: string;
  targetingNotes: string;
  suggestedKeywords: string[];
}

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
