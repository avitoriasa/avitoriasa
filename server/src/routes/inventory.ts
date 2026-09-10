import { Router } from "express";
import { db } from "../db.js";
import {
  adjustStock,
  getInventory,
  listAllInventory,
  listMovements,
  recordStockPurchase,
  setReorderPoint,
} from "../services/inventoryService.js";

export const inventoryRouter = Router();

inventoryRouter.get("/inventory", async (_req, res) => {
  const [items, store] = await Promise.all([listAllInventory(), db.read()]);
  const enriched = items.map((item) => {
    const product = store.products.find((p) => p.id === item.productId);
    return {
      productId: item.productId,
      productName: product?.name ?? "Produto removido",
      sku: product?.sku ?? "",
      quantityOnHand: item.quantityOnHand,
      averageUnitCostBrl: item.averageUnitCostBrl,
      reorderPoint: item.reorderPoint,
      isLowStock: item.isLowStock,
    };
  });
  res.json(enriched);
});

inventoryRouter.get("/products/:id/inventory", async (req, res) => {
  const item = await getInventory(req.params.id);
  res.json({
    productId: item.productId,
    quantityOnHand: item.quantityOnHand,
    averageUnitCostBrl: item.averageUnitCostBrl,
    reorderPoint: item.reorderPoint,
    isLowStock: item.isLowStock,
  });
});

inventoryRouter.get("/products/:id/inventory/movements", async (req, res) => {
  res.json(await listMovements(req.params.id));
});

inventoryRouter.post("/products/:id/inventory/purchase", async (req, res) => {
  const { quantity, unitCostBrl, note } = req.body ?? {};
  if (quantity === undefined || unitCostBrl === undefined) {
    return res.status(400).json({ error: "quantity e unitCostBrl são obrigatórios" });
  }
  try {
    const item = await recordStockPurchase(req.params.id, Number(quantity), Number(unitCostBrl), note);
    res.status(201).json({ ...item.toSnapshot(), isLowStock: item.isLowStock });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

inventoryRouter.post("/products/:id/inventory/adjust", async (req, res) => {
  const { quantity, reason } = req.body ?? {};
  if (quantity === undefined) {
    return res.status(400).json({ error: "quantity é obrigatório" });
  }
  try {
    const item = await adjustStock(req.params.id, Number(quantity), reason ?? "Ajuste manual");
    res.json({ ...item.toSnapshot(), isLowStock: item.isLowStock });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

inventoryRouter.put("/products/:id/inventory/reorder-point", async (req, res) => {
  const { reorderPoint } = req.body ?? {};
  if (reorderPoint === undefined) {
    return res.status(400).json({ error: "reorderPoint é obrigatório" });
  }
  try {
    const item = await setReorderPoint(req.params.id, Number(reorderPoint));
    res.json({ ...item.toSnapshot(), isLowStock: item.isLowStock });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
