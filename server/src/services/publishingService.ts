import { v4 as uuid } from "uuid";
import { getMarketplaceAdapter } from "../adapters/MarketplaceAdapter.js";
import { AIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { computePricing } from "./pricingService.js";
import { optimizeConnection } from "./seoOptimizationService.js";
import { ProductMarketplaceConnection } from "../types.js";

/**
 * Os comandos que o DONO dá sobre o que está (ou não) no ar em cada
 * marketplace: publicar, pausar, retomar e retirar. Nenhum deles é acionado
 * pela IA por conta própria — o scheduler e os agentes só criam propostas
 * (ver approvalService.ts), e é a aprovação do dono que chama estas funções.
 */

async function findConnection(connectionId: string): Promise<ProductMarketplaceConnection> {
  const store = await db.read();
  const connection = store.connections.find((c) => c.id === connectionId);
  if (!connection) throw new Error("Anúncio não encontrado");
  return connection;
}

async function saveConnection(updated: ProductMarketplaceConnection): Promise<ProductMarketplaceConnection> {
  const store = await db.read();
  store.connections = store.connections.map((c) => (c.id === updated.id ? updated : c));
  await db.save();
  return updated;
}

/**
 * Coloca um produto à venda num marketplace. Se já existir um anúncio
 * pausado/retirado para esse par produto+marketplace, ele é reativado em vez
 * de duplicado — o histórico e o id externo do anúncio são preservados.
 */
export async function publishProductToMarketplace(
  productId: string,
  marketplaceId: string,
  aiProvider: AIProvider
): Promise<ProductMarketplaceConnection> {
  const store = await db.read();
  const product = store.products.find((p) => p.id === productId);
  const marketplace = store.marketplaces.find((m) => m.id === marketplaceId);
  if (!product) throw new Error("Produto não encontrado");
  if (!marketplace) throw new Error("Marketplace não encontrado");

  const existing = store.connections.find((c) => c.productId === productId && c.marketplaceId === marketplaceId);
  if (existing?.status === "connected") {
    throw new Error(`"${product.name}" já está no ar em ${marketplace.name}`);
  }

  const connection: ProductMarketplaceConnection = existing
    ? { ...existing, status: "connected", pricing: computePricing(product.basePrice, marketplace) }
    : {
        id: uuid(),
        productId,
        marketplaceId,
        status: "connected",
        externalListingId: null,
        currentTitle: product.name,
        currentDescription: product.description,
        currentKeywords: product.keywords,
        pricing: computePricing(product.basePrice, marketplace),
        rankScore: 50,
        lastOptimizedAt: null,
        createdAt: new Date().toISOString(),
      };

  if (existing) {
    await saveConnection(connection);
  } else {
    store.connections.push(connection);
    await db.save();
  }

  // Primeira publicação do conteúdo otimizado. Best-effort: se a IA falhar, o
  // anúncio fica no ar com o texto original do produto em vez de não ir ao ar.
  try {
    await optimizeConnection(connection.id, aiProvider);
  } catch (err) {
    console.error("[publishing] Falha ao otimizar no momento da publicação:", (err as Error).message);
  }

  return findConnection(connection.id);
}

/** Tira o anúncio do ar mantendo-o cadastrado, para o dono retomar quando quiser. */
export async function pauseConnection(connectionId: string): Promise<ProductMarketplaceConnection> {
  const connection = await findConnection(connectionId);
  if (connection.status === "paused") return connection;

  const store = await db.read();
  const marketplace = store.marketplaces.find((m) => m.id === connection.marketplaceId);
  if (marketplace && connection.externalListingId) {
    const adapter = getMarketplaceAdapter(marketplace.slug);
    await adapter.unpublishListing(connection.externalListingId);
  }

  return saveConnection({ ...connection, status: "paused" });
}

/** Recoloca no ar um anúncio pausado, republicando o conteúdo atual com o preço recalculado. */
export async function resumeConnection(
  connectionId: string,
  aiProvider: AIProvider
): Promise<ProductMarketplaceConnection> {
  const connection = await findConnection(connectionId);
  const store = await db.read();
  const product = store.products.find((p) => p.id === connection.productId);
  const marketplace = store.marketplaces.find((m) => m.id === connection.marketplaceId);
  if (!product || !marketplace) throw new Error("Produto ou marketplace inválido para esse anúncio");

  await saveConnection({ ...connection, status: "connected", pricing: computePricing(product.basePrice, marketplace) });

  try {
    await optimizeConnection(connectionId, aiProvider);
  } catch (err) {
    console.error("[publishing] Falha ao otimizar ao retomar o anúncio:", (err as Error).message);
  }

  return findConnection(connectionId);
}

/** Retira o produto do marketplace de vez (o cadastro do produto continua no CRM). */
export async function removeConnection(connectionId: string): Promise<ProductMarketplaceConnection> {
  const connection = await findConnection(connectionId);
  const store = await db.read();
  const marketplace = store.marketplaces.find((m) => m.id === connection.marketplaceId);
  if (marketplace && connection.externalListingId) {
    const adapter = getMarketplaceAdapter(marketplace.slug);
    await adapter.unpublishListing(connection.externalListingId);
  }

  return saveConnection({ ...connection, status: "disconnected" });
}
