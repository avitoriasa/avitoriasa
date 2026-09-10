import { v4 as uuid } from "uuid";
import { getMarketplaceAdapter } from "../adapters/MarketplaceAdapter.js";
import { db } from "../db.js";
import { FinancialSummary, Marketplace, Order, ProductMarketplaceConnection } from "../types.js";

const PAYOUT_DELAY_DAYS = 14; // typical marketplace settlement window (varies by real API)

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Public tracking page link, when the carrier supports a URL-based lookup.
 * Only USPS is wired today (https://tools.usps.com/tracking/) — add more
 * carriers here as needed. Returns undefined for unsupported carriers so
 * the UI can fall back to showing the plain tracking number.
 */
export function getTrackingUrl(carrier: string | undefined, trackingNumber: string | undefined): string | undefined {
  if (!carrier || !trackingNumber) return undefined;
  if (carrier.trim().toLowerCase() === "usps") {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
  }
  return undefined;
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
  const product = store.products.find((p) => p.id === connection.productId);
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
      fulfillmentMode: product?.fulfillmentMode ?? "stock",
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

/**
 * Records what you actually paid a retail source (e.g. a US site,
 * price-checked manually with a coupon/cashback tool) to fulfill one
 * dropship order, plus the estimated remessa-regime tax for that single
 * parcel — see dropshipService.estimateDropshipOrder for that estimate.
 */
export async function recordDropshipPurchase(
  orderId: string,
  sourcePurchaseCostBrl: number,
  sourceTaxEstimateBrl: number
): Promise<Order> {
  const store = await db.read();
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) throw new Error(`Pedido ${orderId} não encontrado`);

  order.sourcePurchaseCostBrl = round2(sourcePurchaseCostBrl);
  order.sourceTaxEstimateBrl = round2(sourceTaxEstimateBrl);
  order.dropshipProfitBrl = round2(order.netAmount - sourcePurchaseCostBrl - sourceTaxEstimateBrl);
  await db.save();
  return order;
}

export async function updateOrderTracking(orderId: string, carrier: string, trackingNumber: string): Promise<Order> {
  const store = await db.read();
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) throw new Error(`Pedido ${orderId} não encontrado`);

  order.trackingCarrier = carrier;
  order.trackingNumber = trackingNumber;
  order.trackingUrl = getTrackingUrl(carrier, trackingNumber);
  await db.save();
  return order;
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
