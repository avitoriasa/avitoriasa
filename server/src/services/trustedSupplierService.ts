import { v4 as uuid } from "uuid";
import { db } from "../db.js";
import { TrustedSupplier } from "../types.js";

/**
 * The user's own vetted supplier list — distinct from the curated reference
 * catalog in supplierLeads.ts. This is where "meus importadores precisam
 * ser de confiança" lives as data the user controls directly, optionally
 * seeded from a SourcingOption.
 */
export async function listTrustedSuppliers(): Promise<TrustedSupplier[]> {
  const store = await db.read();
  return store.trustedSuppliers;
}

export async function addTrustedSupplier(input: Omit<TrustedSupplier, "id" | "addedAt">): Promise<TrustedSupplier> {
  const store = await db.read();
  const supplier: TrustedSupplier = { ...input, id: uuid(), addedAt: new Date().toISOString() };
  store.trustedSuppliers.push(supplier);
  await db.save();
  return supplier;
}

export async function removeTrustedSupplier(id: string): Promise<void> {
  const store = await db.read();
  store.trustedSuppliers = store.trustedSuppliers.filter((s) => s.id !== id);
  await db.save();
}
