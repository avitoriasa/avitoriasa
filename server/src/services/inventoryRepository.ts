import { db } from "../db.js";
import { InventoryItem } from "../domain/InventoryItem.js";
import { StockMovement } from "../types.js";

/**
 * Infrastructure layer for the inventory bounded context: translates
 * between the InventoryItem domain entity and its persisted
 * InventoryItemSnapshot shape in the JSON store. Application code
 * (inventoryService.ts) never touches db.ts directly for inventory data.
 */
export const inventoryRepository = {
  async getByProductId(productId: string): Promise<InventoryItem | null> {
    const store = await db.read();
    const snapshot = store.inventoryItems.find((i) => i.productId === productId);
    return snapshot ? InventoryItem.fromSnapshot(snapshot) : null;
  },

  async listAll(): Promise<InventoryItem[]> {
    const store = await db.read();
    return store.inventoryItems.map((snapshot) => InventoryItem.fromSnapshot(snapshot));
  },

  async save(item: InventoryItem): Promise<void> {
    const store = await db.read();
    const snapshot = item.toSnapshot();
    const index = store.inventoryItems.findIndex((i) => i.productId === item.productId);
    if (index === -1) store.inventoryItems.push(snapshot);
    else store.inventoryItems[index] = snapshot;
    await db.save();
  },

  async appendMovement(movement: StockMovement): Promise<void> {
    const store = await db.read();
    store.stockMovements.push(movement);
    await db.save();
  },

  async listMovements(productId: string): Promise<StockMovement[]> {
    const store = await db.read();
    return store.stockMovements
      .filter((m) => m.productId === productId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  },
};
