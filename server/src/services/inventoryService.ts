import { v4 as uuid } from "uuid";
import { db } from "../db.js";
import { InventoryItem } from "../domain/InventoryItem.js";
import { inventoryRepository } from "./inventoryRepository.js";
import { StockMovement } from "../types.js";

/**
 * Application service (use cases) for the inventory bounded context —
 * orchestrates the InventoryItem entity + repository + the ripple effect
 * on Product.costBasis, but contains no business rules itself (those live
 * in the entity).
 */

export async function getInventory(productId: string): Promise<InventoryItem> {
  return (await inventoryRepository.getByProductId(productId)) ?? InventoryItem.createEmpty(productId);
}

export async function listAllInventory(): Promise<InventoryItem[]> {
  return inventoryRepository.listAll();
}

export async function recordStockPurchase(
  productId: string,
  quantity: number,
  unitCostBrl: number,
  note?: string
): Promise<InventoryItem> {
  const item = await getInventory(productId);
  item.receivePurchase(quantity, unitCostBrl);
  await inventoryRepository.save(item);

  const movement: StockMovement = {
    id: uuid(),
    productId,
    type: "purchase",
    quantity,
    unitCostBrl,
    note,
    occurredAt: new Date().toISOString(),
  };
  await inventoryRepository.appendMovement(movement);

  // Keep the product's costBasis in sync with the real weighted-average
  // cost, so the pricing/margin views elsewhere in the app stay accurate.
  const store = await db.read();
  const product = store.products.find((p) => p.id === productId);
  if (product) {
    product.costBasis = item.averageUnitCostBrl;
    await db.save();
  }

  return item;
}

/**
 * Called when a sale happens for a "stock" fulfillment product — decrements
 * inventory. No-op (not an error) when the product has no inventory record
 * yet, since that's the normal state for dropship products.
 */
export async function consumeStockForSale(productId: string, quantity = 1): Promise<void> {
  const item = await inventoryRepository.getByProductId(productId);
  if (!item) return;

  try {
    item.releaseForSale(quantity);
  } catch (err) {
    console.warn(`[inventory] Estoque insuficiente para ${productId}: ${(err as Error).message}`);
    return;
  }

  await inventoryRepository.save(item);
  const movement: StockMovement = {
    id: uuid(),
    productId,
    type: "sale",
    quantity: -quantity,
    occurredAt: new Date().toISOString(),
  };
  await inventoryRepository.appendMovement(movement);
}

export async function adjustStock(productId: string, newQuantity: number, reason: string): Promise<InventoryItem> {
  const item = await getInventory(productId);
  const delta = item.adjustQuantity(newQuantity);
  await inventoryRepository.save(item);

  if (delta !== 0) {
    const movement: StockMovement = {
      id: uuid(),
      productId,
      type: "adjustment",
      quantity: delta,
      note: reason,
      occurredAt: new Date().toISOString(),
    };
    await inventoryRepository.appendMovement(movement);
  }

  return item;
}

export async function setReorderPoint(productId: string, reorderPoint: number): Promise<InventoryItem> {
  const item = await getInventory(productId);
  item.setReorderPoint(reorderPoint);
  await inventoryRepository.save(item);
  return item;
}

export async function listMovements(productId: string): Promise<StockMovement[]> {
  return inventoryRepository.listMovements(productId);
}
