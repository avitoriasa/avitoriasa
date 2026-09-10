import { Router } from "express";
import { db } from "../db.js";
import { collectOrdersForConnection, summarizeOrders } from "../services/ordersService.js";

export const ordersRouter = Router();

ordersRouter.get("/connections/:id/orders", async (req, res) => {
  const store = await db.read();
  const orders = store.orders
    .filter((o) => o.connectionId === req.params.id)
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
  res.json(orders);
});

ordersRouter.post("/connections/:id/orders/simulate", async (req, res) => {
  const store = await db.read();
  const connection = store.connections.find((c) => c.id === req.params.id);
  if (!connection) return res.status(404).json({ error: "Conexão não encontrada" });
  const marketplace = store.marketplaces.find((m) => m.id === connection.marketplaceId);
  if (!marketplace) return res.status(404).json({ error: "Marketplace não encontrado" });

  try {
    const newOrders = await collectOrdersForConnection(connection, marketplace);
    res.status(201).json(newOrders);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

ordersRouter.get("/products/:id/financial-summary", async (req, res) => {
  const store = await db.read();
  const connectionIds = new Set(store.connections.filter((c) => c.productId === req.params.id).map((c) => c.id));
  const orders = store.orders.filter((o) => connectionIds.has(o.connectionId));
  res.json(summarizeOrders(orders));
});

ordersRouter.get("/financial-summary", async (_req, res) => {
  const store = await db.read();
  res.json(summarizeOrders(store.orders));
});
