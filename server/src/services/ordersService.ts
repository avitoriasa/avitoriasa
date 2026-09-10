import { v4 as uuid } from "uuid";
import { getMarketplaceAdapter } from "../adapters/MarketplaceAdapter.js";
import { db } from "../db.js";
import { FinancialSummary, Marketplace, Order, ProductMarketplaceConnection } from "../types.js";

const PAYOUT_DELAY_DAYS = 14; // typical marketplace settlement window (varies by real API)

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Polls the marketplace adapter for new sales on a connection and appends
 * them as Orders with the fee/net split already computed. Replace
 * MarketplaceAdapter.fetchOrders with a real "list orders" call and this
 * function keeps working unchanged.
 */
export async function collectOrdersForConnection(
  connection: ProductMarketplaceConnection,
  marketplace: Marketplace
): Promise<Order[]> {
  const adapter = getMarketplaceAdapter(marketplace.slug);
  const fetched = await adapter.fetchOrders({
    externalListingId: connection.externalListingId,
    listingPrice: connection.pricing.listingPrice,
  });
  if (fetched.length === 0) return [];

  const store = await db.read();
  const newOrders: Order[] = fetched.map((f) => {
    const feeAmount = round2(f.grossAmount * (marketplace.feePercent / 100));
    return {
      id: uuid(),
      connectionId: connection.id,
      productId: connection.productId,
      marketplaceId: connection.marketplaceId,
      externalOrderId: f.externalOrderId,
      grossAmount: round2(f.grossAmount),
      feeAmount,
      netAmount: round2(f.grossAmount - feeAmount),
      status: "pending_payout",
      soldAt: f.soldAt,
      payoutExpectedAt: new Date(Date.now() + PAYOUT_DELAY_DAYS * 24 * 3_600_000).toISOString(),
    };
  });

  store.orders.push(...newOrders);
  await db.save();
  return newOrders;
}

/** Marks orders whose simulated settlement date has passed as paid out. */
export async function maturePendingPayouts(): Promise<number> {
  const store = await db.read();
  const now = Date.now();
  let matured = 0;
  store.orders = store.orders.map((order) => {
    if (order.status === "pending_payout" && new Date(order.payoutExpectedAt).getTime() <= now) {
      matured++;
      return { ...order, status: "paid_out" as const };
    }
    return order;
  });
  if (matured > 0) await db.save();
  return matured;
}

export function summarizeOrders(orders: Order[]): FinancialSummary {
  return orders.reduce<FinancialSummary>(
    (acc, o) => ({
      orderCount: acc.orderCount + 1,
      grossTotal: round2(acc.grossTotal + o.grossAmount),
      feeTotal: round2(acc.feeTotal + o.feeAmount),
      netTotal: round2(acc.netTotal + o.netAmount),
      pendingPayout: round2(acc.pendingPayout + (o.status === "pending_payout" ? o.netAmount : 0)),
      paidOut: round2(acc.paidOut + (o.status === "paid_out" ? o.netAmount : 0)),
    }),
    { orderCount: 0, grossTotal: 0, feeTotal: 0, netTotal: 0, pendingPayout: 0, paidOut: 0 }
  );
}
