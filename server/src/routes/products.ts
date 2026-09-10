import { Router } from "express";
import { v4 as uuid } from "uuid";
import { getConfiguredAIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { generateRecommendation, getLatestRecommendation } from "../services/recommendationService.js";
import { optimizeConnection } from "../services/seoOptimizationService.js";
import { Product, ProductMarketplaceConnection } from "../types.js";

export const productsRouter = Router();

productsRouter.get("/", async (_req, res) => {
  const store = await db.read();
  res.json(store.products);
});

productsRouter.post("/", async (req, res) => {
  const { name, description, category, price, sku, keywords } = req.body ?? {};
  if (!name || !category || price === undefined || !sku) {
    return res.status(400).json({ error: "Campos obrigatórios: name, category, price, sku" });
  }

  const store = await db.read();
  const now = new Date().toISOString();
  const product: Product = {
    id: uuid(),
    name,
    description: description ?? "",
    category,
    price: Number(price),
    sku,
    keywords: Array.isArray(keywords) ? keywords : [],
    createdAt: now,
    updatedAt: now,
  };
  store.products.push(product);
  await db.save();

  try {
    const aiProvider = await getConfiguredAIProvider();
    await generateRecommendation(product.id, aiProvider);
  } catch (err) {
    console.error("[products] Falha ao gerar recomendação inicial:", (err as Error).message);
  }

  res.status(201).json(product);
});

productsRouter.get("/:id", async (req, res) => {
  const store = await db.read();
  const product = store.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Produto não encontrado" });
  res.json(product);
});

productsRouter.put("/:id", async (req, res) => {
  const store = await db.read();
  const index = store.products.findIndex((p) => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Produto não encontrado" });

  const { name, description, category, price, sku, keywords } = req.body ?? {};
  const existing = store.products[index];
  const updated: Product = {
    ...existing,
    name: name ?? existing.name,
    description: description ?? existing.description,
    category: category ?? existing.category,
    price: price !== undefined ? Number(price) : existing.price,
    sku: sku ?? existing.sku,
    keywords: Array.isArray(keywords) ? keywords : existing.keywords,
    updatedAt: new Date().toISOString(),
  };
  store.products[index] = updated;
  await db.save();
  res.json(updated);
});

productsRouter.delete("/:id", async (req, res) => {
  const store = await db.read();
  const productId = req.params.id;
  const connectionIds = store.connections.filter((c) => c.productId === productId).map((c) => c.id);

  store.products = store.products.filter((p) => p.id !== productId);
  store.connections = store.connections.filter((c) => c.productId !== productId);
  store.recommendations = store.recommendations.filter((r) => r.productId !== productId);
  store.optimizationLogs = store.optimizationLogs.filter((l) => !connectionIds.includes(l.connectionId));
  await db.save();
  res.status(204).end();
});

productsRouter.get("/:id/recommendation", async (req, res) => {
  const recommendation = await getLatestRecommendation(req.params.id);
  if (!recommendation) return res.status(404).json({ error: "Nenhuma recomendação encontrada" });
  res.json(recommendation);
});

productsRouter.post("/:id/recommendation", async (req, res) => {
  const store = await db.read();
  const product = store.products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: "Produto não encontrado" });

  try {
    const aiProvider = await getConfiguredAIProvider();
    const recommendation = await generateRecommendation(product.id, aiProvider);
    res.json(recommendation);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

productsRouter.get("/:id/connections", async (req, res) => {
  const store = await db.read();
  const connections = store.connections.filter((c) => c.productId === req.params.id);
  res.json(connections);
});

productsRouter.post("/:id/connections", async (req, res) => {
  const { marketplaceId } = req.body ?? {};
  if (!marketplaceId) return res.status(400).json({ error: "marketplaceId é obrigatório" });

  const store = await db.read();
  const product = store.products.find((p) => p.id === req.params.id);
  const marketplace = store.marketplaces.find((m) => m.id === marketplaceId);
  if (!product) return res.status(404).json({ error: "Produto não encontrado" });
  if (!marketplace) return res.status(404).json({ error: "Marketplace não encontrado" });

  const existing = store.connections.find((c) => c.productId === product.id && c.marketplaceId === marketplaceId);
  if (existing) return res.status(409).json({ error: "Produto já conectado a esse marketplace", connection: existing });

  const connection: ProductMarketplaceConnection = {
    id: uuid(),
    productId: product.id,
    marketplaceId,
    status: "connected",
    externalListingId: null,
    currentTitle: product.name,
    currentDescription: product.description,
    currentKeywords: product.keywords,
    rankScore: 50,
    lastOptimizedAt: null,
    createdAt: new Date().toISOString(),
  };
  store.connections.push(connection);
  await db.save();

  try {
    const aiProvider = await getConfiguredAIProvider();
    await optimizeConnection(connection.id, aiProvider);
  } catch (err) {
    console.error("[products] Falha na otimização inicial:", (err as Error).message);
  }

  const store2 = await db.read();
  res.status(201).json(store2.connections.find((c) => c.id === connection.id));
});
