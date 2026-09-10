import type {
  AppSettings,
  FinancialSummary,
  FxMethod,
  Marketplace,
  OptimizationLogEntry,
  Order,
  Product,
  ProductMarketplaceConnection,
  RecommendationResult,
  SourcingResearchResult,
} from "../types/domain";

export interface ProductInput {
  name: string;
  description: string;
  category: string;
  basePrice: number;
  /** Pass null to clear a previously-set cost basis. */
  costBasis?: number | null;
  sku: string;
  keywords: string[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listProducts: () => request<Product[]>("/products"),
  createProduct: (payload: ProductInput) =>
    request<Product>("/products", { method: "POST", body: JSON.stringify(payload) }),
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  updateProduct: (id: string, payload: Partial<ProductInput>) =>
    request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteProduct: (id: string) => request<void>(`/products/${id}`, { method: "DELETE" }),

  listMarketplaces: () => request<Marketplace[]>("/marketplaces"),

  getRecommendation: (productId: string) =>
    request<RecommendationResult>(`/products/${productId}/recommendation`).catch(() => undefined),
  refreshRecommendation: (productId: string) =>
    request<RecommendationResult>(`/products/${productId}/recommendation`, { method: "POST" }),

  listConnections: (productId: string) =>
    request<ProductMarketplaceConnection[]>(`/products/${productId}/connections`),
  connectMarketplace: (productId: string, marketplaceId: string) =>
    request<ProductMarketplaceConnection>(`/products/${productId}/connections`, {
      method: "POST",
      body: JSON.stringify({ marketplaceId }),
    }),
  disconnectMarketplace: (connectionId: string) =>
    request<ProductMarketplaceConnection>(`/connections/${connectionId}`, { method: "DELETE" }),
  optimizeConnection: (connectionId: string) =>
    request<OptimizationLogEntry>(`/connections/${connectionId}/optimize`, { method: "POST" }),
  getHistory: (connectionId: string) =>
    request<OptimizationLogEntry[]>(`/connections/${connectionId}/history`),

  getSettings: () => request<AppSettings>("/settings"),
  updateSettings: (payload: Partial<AppSettings>) =>
    request<AppSettings>("/settings", { method: "PUT", body: JSON.stringify(payload) }),

  runSweepNow: () => request<{ ok: true }>("/scheduler/run-now", { method: "POST" }),

  recentOptimizations: () =>
    request<(OptimizationLogEntry & { productName: string; marketplaceName: string })[]>(
      "/optimizations/recent"
    ),

  getConnectionOrders: (connectionId: string) => request<Order[]>(`/connections/${connectionId}/orders`),
  simulateOrder: (connectionId: string) =>
    request<Order[]>(`/connections/${connectionId}/orders/simulate`, { method: "POST" }),
  getProductFinancialSummary: (productId: string) =>
    request<FinancialSummary>(`/products/${productId}/financial-summary`),
  getGlobalFinancialSummary: () => request<FinancialSummary>("/financial-summary"),

  listFxMethods: () => request<FxMethod[]>("/sourcing/fx-methods"),
  researchSuppliers: (query: string, desiredResalePrice?: number) =>
    request<SourcingResearchResult>("/sourcing/research", {
      method: "POST",
      body: JSON.stringify({ query, desiredResalePrice }),
    }),
};
