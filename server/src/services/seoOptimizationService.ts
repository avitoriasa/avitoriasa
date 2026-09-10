import { v4 as uuid } from "uuid";
import { getMarketplaceAdapter } from "../adapters/MarketplaceAdapter.js";
import { AIProvider } from "../ai/index.js";
import { GenerateListingContentOutput } from "../ai/AIProvider.js";
import { db } from "../db.js";
import { computePricing } from "./pricingService.js";
import { Marketplace, OptimizationLogEntry, Product, ProductMarketplaceConnection } from "../types.js";

interface ConnectionContext {
  connection: ProductMarketplaceConnection;
  product: Product;
  marketplace: Marketplace;
  /** Quantas vezes esse anúncio já foi otimizado — usado para variar a copy a cada ciclo. */
  iteration: number;
}

async function loadConnectionContext(connectionId: string): Promise<ConnectionContext> {
  const store = await db.read();
  const connection = store.connections.find((c) => c.id === connectionId);
  if (!connection) throw new Error(`Conexão ${connectionId} não encontrada`);

  const product = store.products.find((p) => p.id === connection.productId);
  const marketplace = store.marketplaces.find((m) => m.id === connection.marketplaceId);
  if (!product || !marketplace) throw new Error("Produto ou marketplace inválido para essa conexão");

  const iteration = store.optimizationLogs.filter((l) => l.connectionId === connectionId).length;
  return { connection, product, marketplace, iteration };
}

/**
 * Gera a nova versão do anúncio SEM publicar nada — é o passo usado quando o
 * app está em modo de aprovação manual: a proposta fica guardada para o dono
 * decidir (ver approvalService.ts) e só vira realidade em applyListingUpdate.
 */
export async function generateListingUpdate(
  connectionId: string,
  aiProvider: AIProvider
): Promise<GenerateListingContentOutput> {
  const { connection, product, marketplace, iteration } = await loadConnectionContext(connectionId);

  return aiProvider.generateListingContent({
    product,
    marketplace,
    currentTitle: connection.currentTitle || product.name,
    currentDescription: connection.currentDescription || product.description,
    currentKeywords: connection.currentKeywords.length ? connection.currentKeywords : product.keywords,
    iteration,
  });
}

/** Publica de fato uma versão já gerada (e, em modo manual, já aprovada pelo dono). */
export async function applyListingUpdate(
  connectionId: string,
  generated: GenerateListingContentOutput,
  aiProviderName: string
): Promise<OptimizationLogEntry> {
  const store = await db.read();
  const { connection, product, marketplace } = await loadConnectionContext(connectionId);

  // Recompute pricing from the product's current base price in case it
  // changed since the last cycle — the marketplace fee never gets stale.
  const pricing = computePricing(product.basePrice, marketplace);

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
    aiProvider: aiProviderName,
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

/** Gera e publica numa tacada — usado no modo automático e no botão "Otimizar agora" do dono. */
export async function optimizeConnection(
  connectionId: string,
  aiProvider: AIProvider
): Promise<OptimizationLogEntry> {
  const generated = await generateListingUpdate(connectionId, aiProvider);
  return applyListingUpdate(connectionId, generated, aiProvider.name);
}

export function isDueForOptimization(connection: ProductMarketplaceConnection, cooldownHours: number): boolean {
  if (!connection.lastOptimizedAt) return true;
  const elapsedHours = (Date.now() - new Date(connection.lastOptimizedAt).getTime()) / 3_600_000;
  return elapsedHours >= cooldownHours;
}
