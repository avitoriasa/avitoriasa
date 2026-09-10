import { InventoryItemSnapshot } from "../types.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Aggregate root for a product's stock position (the "controle de
 * estoques" the user asked for). Enforces the invariants that matter for
 * inventory accounting so callers can't corrupt them by hand:
 *   - quantity on hand never goes negative;
 *   - the average unit cost is always a weighted average across everything
 *     received, recomputed on every purchase — never edited directly.
 *
 * This is domain logic with no framework/persistence concerns; see
 * services/inventoryRepository.ts for how it's loaded/saved and
 * services/inventoryService.ts for the use-cases that drive it.
 */
export class InventoryItem {
  private constructor(
    private readonly _productId: string,
    private _quantityOnHand: number,
    private _avgUnitCostBrl: number,
    private _reorderPoint: number,
    private _updatedAt: string
  ) {}

  static createEmpty(productId: string): InventoryItem {
    return new InventoryItem(productId, 0, 0, 0, new Date().toISOString());
  }

  static fromSnapshot(snapshot: InventoryItemSnapshot): InventoryItem {
    return new InventoryItem(
      snapshot.productId,
      snapshot.quantityOnHand,
      snapshot.avgUnitCostBrl,
      snapshot.reorderPoint,
      snapshot.updatedAt
    );
  }

  get productId(): string {
    return this._productId;
  }

  get quantityOnHand(): number {
    return this._quantityOnHand;
  }

  get averageUnitCostBrl(): number {
    return this._avgUnitCostBrl;
  }

  get reorderPoint(): number {
    return this._reorderPoint;
  }

  get isLowStock(): boolean {
    return this._quantityOnHand <= this._reorderPoint;
  }

  /** Stock coming in from a purchase — recomputes the weighted-average cost. */
  receivePurchase(quantity: number, unitCostBrl: number): void {
    if (quantity <= 0) throw new Error("Quantidade recebida deve ser maior que zero");
    if (unitCostBrl < 0) throw new Error("Custo unitário não pode ser negativo");
    const totalCostBefore = this._avgUnitCostBrl * this._quantityOnHand;
    const totalCostIncoming = unitCostBrl * quantity;
    this._quantityOnHand += quantity;
    this._avgUnitCostBrl = round2((totalCostBefore + totalCostIncoming) / this._quantityOnHand);
    this._touch();
  }

  /**
   * Stock going out from a sale. Throws if it would go negative — callers
   * should catch and treat that as "out of stock" rather than let the
   * balance drift below zero.
   */
  releaseForSale(quantity: number): void {
    if (quantity <= 0) throw new Error("Quantidade de saída deve ser maior que zero");
    if (quantity > this._quantityOnHand) {
      throw new Error(`Estoque insuficiente: ${this._quantityOnHand} em mãos, ${quantity} solicitado`);
    }
    this._quantityOnHand -= quantity;
    this._touch();
  }

  /**
   * Manual correction (e.g. after a physical count) — bypasses the
   * weighted-average cost logic on purpose, since a count doesn't tell you
   * what the missing/extra units cost. Returns the delta applied, for the
   * caller to log as a StockMovement.
   */
  adjustQuantity(newQuantity: number): number {
    if (newQuantity < 0) throw new Error("Estoque não pode ser ajustado para um valor negativo");
    const delta = newQuantity - this._quantityOnHand;
    this._quantityOnHand = newQuantity;
    this._touch();
    return delta;
  }

  setReorderPoint(reorderPoint: number): void {
    if (reorderPoint < 0) throw new Error("Ponto de reposição não pode ser negativo");
    this._reorderPoint = reorderPoint;
    this._touch();
  }

  private _touch(): void {
    this._updatedAt = new Date().toISOString();
  }

  toSnapshot(): InventoryItemSnapshot {
    return {
      productId: this._productId,
      quantityOnHand: this._quantityOnHand,
      avgUnitCostBrl: this._avgUnitCostBrl,
      reorderPoint: this._reorderPoint,
      updatedAt: this._updatedAt,
    };
  }
}
