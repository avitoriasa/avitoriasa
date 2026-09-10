import { v4 as uuid } from "uuid";
import { MARKETPLACE_CATALOG } from "./data/marketplaces.js";
import { db } from "./db.js";

export async function ensureSeedData(): Promise<void> {
  const store = await db.read();
  if (store.marketplaces.length === 0) {
    store.marketplaces = MARKETPLACE_CATALOG.map((m) => ({ ...m, id: uuid() }));
    await db.save();
    console.log(`[seed] ${store.marketplaces.length} marketplaces cadastrados.`);
  }
}
