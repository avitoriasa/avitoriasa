import { v4 as uuid } from "uuid";
import { getMarketplaceAdapter } from "../adapters/MarketplaceAdapter.js";
import { AIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { computePricing } from "./pricingService.js";
import { OptimizationLogEntry, ProductMarketplaceConnection } from "../types.js";

export async function optimizeConnection(
  connectionId: string,
  aiProvider: AIProvider
): Promise<OptimizationLogEntry> {
  const store = await db.read();
  const connection = store.connections.find((c) => c.id === connectionId);
  if (!connection) throw new Error(`Conexão ${connectionId} não encontrada`);

  const product = store.products.find((p) => p.id === connection.productId);
  const marketplace = store.marketplaces.find((m) => m.id === connection.marketplaceId);
  if (!product || !marketplace) throw new Error("Produto ou marketplace inválido para essa conexão");

  const iteration = store.optimizationLogs.filter((l) => l.connectionId === connectionId).length;

  const generated = await aiProvider.generateListingContent({
    product,
    marketplace,
    currentTitle: connection.currentTitle || product.name,
    currentDescription: connection.currentDescription || product.description,
    currentKeywords: connection.currentKeywords.length ? connection.currentKeywords : product.keywords,
    iteration,
  });

  // Recompute pricing from the product's current base price in case it
  // changed since the last cycle — the marketplace fee never gets stale.
  const pricing = computePricing(product.basePrice, marketplace.feePercent);

  const adapter = getMarketplaceAdapter(marketplace.slug);
  const published = await adapter.publishListing({
    externalListingId: connection.externalListingId,
    title: generated.title,
    description: generated.description,
    keywords: generated.keywords,
    price: pricing.listingPrice,
  });

  const log: OptimizationLogEntry = {
    id: uuid(),
    connectionId,
    productId: product.id,
    marketplaceId: marketplace.id,
    previousTitle: connection.currentTitle,
    newTitle: generated.title,
    previousDescription: connection.currentDescription,
    newDescription: generated.description,
    previousKeywords: connection.currentKeywords,
    newKeywords: generated.keywords,
    reason: generated.changeReason,
    aiProvider: aiProvider.name,
    createdAt: new Date().toISOString(),
  };

  const updatedConnection: ProductMarketplaceConnection = {
    ...connection,
    externalListingId: published.externalListingId,
    currentTitle: generated.title,
    currentDescription: generated.description,
    currentKeywords: generated.keywords,
    pricing,
    lastOptimizedAt: log.createdAt,
    status: "connected",
    rankScore: Math.min(100, connection.rankScore + 2), // simulated ranking lift from freshness
  };

  store.connections = store.connections.map((c) => (c.id === connectionId ? updatedConnection : c));
  store.optimizationLogs.push(log);
  await db.save();

  return log;
}

export function isDueForOptimization(connection: ProductMarketplaceConnection, cooldownHours: number): boolean {
  if (!connection.lastOptimizedAt) return true;
  const elapsedHours = (Date.now() - new Date(connection.lastOptimizedAt).getTime()) / 3_600_000;
  return elapsedHours >= cooldownHours;
}
