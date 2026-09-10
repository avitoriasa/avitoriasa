import { Router } from "express";
import { db } from "../db.js";
import { listApprovals } from "../services/approvalService.js";
import { listAllInventory } from "../services/inventoryService.js";
import { summarizeOrders } from "../services/ordersService.js";
import { CommandCenterSummary, ListingOverview, LowStockAlert } from "../types.js";

export const commandCenterRouter = Router();

/**
 * Tudo que a tela inicial do dono precisa numa única chamada: o que espera
 * decisão dele, o que está no ar agora, o que ele pausou, o que está
 * acabando no estoque e o resumo do dinheiro.
 */
commandCenterRouter.get("/", async (_req, res) => {
  const store = await db.read();

  const toOverview = (connectionId: string): ListingOverview | null => {
    const connection = store.connections.find((c) => c.id === connectionId);
    if (!connection) return null;
    const product = store.products.find((p) => p.id === connection.productId);
    const marketplace = store.marketplaces.find((m) => m.id === connection.marketplaceId);
    if (!product || !marketplace) return null;
    return {
      connectionId: connection.id,
      productId: product.id,
      productName: product.name,
      marketplaceId: marketplace.id,
      marketplaceName: marketplace.name,
      status: connection.status,
      listingPrice: connection.pricing.listingPrice,
      netPrice: connection.pricing.basePrice,
      currentTitle: connection.currentTitle,
      rankScore: connection.rankScore,
      lastOptimizedAt: connection.lastOptimizedAt,
    };
  };

  const overviewsFor = (status: string): ListingOverview[] =>
    store.connections
      .filter((c) => c.status === status)
      .map((c) => toOverview(c.id))
      .filter((o): o is ListingOverview => o !== null);

  const inventory = await listAllInventory();
  const lowStockAlerts: LowStockAlert[] = inventory
    .filter((item) => item.isLowStock)
    .map((item) => {
      const product = store.products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        productName: product?.name ?? "Produto removido",
        quantityOnHand: item.quantityOnHand,
        reorderPoint: item.reorderPoint,
      };
    });

  const allApprovals = await listApprovals();
  const summary: CommandCenterSummary = {
    approvalMode: store.settings.approvalMode,
    pendingApprovals: allApprovals.filter((a) => a.status === "pendente"),
    recentDecisions: allApprovals.filter((a) => a.status !== "pendente").slice(0, 10),
    liveListings: overviewsFor("connected"),
    pausedListings: overviewsFor("paused"),
    lowStockAlerts,
    financial: summarizeOrders(store.orders),
    productCount: store.products.length,
  };

  res.json(summary);
});
