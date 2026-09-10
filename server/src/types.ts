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
}
