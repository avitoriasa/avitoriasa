export interface PublishListingInput {
  externalListingId: string | null;
  title: string;
  description: string;
  keywords: string[];
  price: number;
}

export interface PublishListingResult {
  externalListingId: string;
  publishedAt: string;
}

export interface FetchOrdersInput {
  externalListingId: string | null;
  /** Current listing price — mock orders "sell" at this price. */
  listingPrice: number;
}

export interface FetchedOrder {
  externalOrderId: string;
  grossAmount: number;
  soldAt: string;
}

/**
 * Boundary to a real marketplace's seller API. Every method here is a mock
 * that simulates a call and returns a plausible result, so the CRM is fully
 * usable without live credentials. To go live for a given marketplace:
 *
 *   1. Add API credentials to .env (e.g. MERCADOLIVRE_ACCESS_TOKEN).
 *   2. Replace the body of connect()/publishListing()/fetchOrders() below
 *      with real HTTP calls to that marketplace's seller API (e.g. Mercado
 *      Livre's Orders API, Amazon's SP-API Orders + Finances API, Shopee's
 *      Order API).
 *   3. Keep the method signatures — the rest of the app only depends on
 *      this interface.
 */
export interface MarketplaceAdapter {
  readonly slug: string;
  connect(credentials: Record<string, string>): Promise<{ connected: true }>;
  publishListing(input: PublishListingInput): Promise<PublishListingResult>;
  fetchOrders(input: FetchOrdersInput): Promise<FetchedOrder[]>;
}

class MockMarketplaceAdapter implements MarketplaceAdapter {
  constructor(public readonly slug: string) {}

  async connect(_credentials: Record<string, string>): Promise<{ connected: true }> {
    // TODO: replace with a real OAuth/token exchange call for `this.slug`.
    return { connected: true };
  }

  async publishListing(input: PublishListingInput): Promise<PublishListingResult> {
    // TODO: replace with a real "update listing" API call for `this.slug`
    // (title, description, keywords AND price all belong to the same
    // "update item" request on most marketplace seller APIs).
    const externalListingId = input.externalListingId ?? `${this.slug}-${Date.now().toString(36)}`;
    return { externalListingId, publishedAt: new Date().toISOString() };
  }

  async fetchOrders(input: FetchOrdersInput): Promise<FetchedOrder[]> {
    // TODO: replace with a real "list orders since last sync" API call for
    // `this.slug`. Until then, simulate 0-2 sales per poll at the current
    // listing price so the financial view has something to show.
    const roll = Math.random();
    const count = roll < 0.5 ? 0 : roll < 0.85 ? 1 : 2;
    const orders: FetchedOrder[] = [];
    for (let i = 0; i < count; i++) {
      orders.push({
        externalOrderId: `${this.slug}-ord-${Date.now().toString(36)}-${i}`,
        grossAmount: input.listingPrice,
        soldAt: new Date().toISOString(),
      });
    }
    return orders;
  }
}

const adapters = new Map<string, MarketplaceAdapter>();

export function getMarketplaceAdapter(slug: string): MarketplaceAdapter {
  if (!adapters.has(slug)) {
    adapters.set(slug, new MockMarketplaceAdapter(slug));
  }
  return adapters.get(slug)!;
}
