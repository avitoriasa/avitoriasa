export interface PublishListingInput {
  externalListingId: string | null;
  title: string;
  description: string;
  keywords: string[];
}

export interface PublishListingResult {
  externalListingId: string;
  publishedAt: string;
}

/**
 * Boundary to a real marketplace's seller API. Every method here is a mock
 * that simulates a call and returns a plausible result, so the CRM is fully
 * usable without live credentials. To go live for a given marketplace:
 *
 *   1. Add API credentials to .env (e.g. MERCADOLIVRE_ACCESS_TOKEN).
 *   2. Replace the body of connect()/publishListing() below with real HTTP
 *      calls to that marketplace's seller API.
 *   3. Keep the method signatures — the rest of the app only depends on
 *      this interface.
 */
export interface MarketplaceAdapter {
  readonly slug: string;
  connect(credentials: Record<string, string>): Promise<{ connected: true }>;
  publishListing(input: PublishListingInput): Promise<PublishListingResult>;
}

class MockMarketplaceAdapter implements MarketplaceAdapter {
  constructor(public readonly slug: string) {}

  async connect(_credentials: Record<string, string>): Promise<{ connected: true }> {
    // TODO: replace with a real OAuth/token exchange call for `this.slug`.
    return { connected: true };
  }

  async publishListing(input: PublishListingInput): Promise<PublishListingResult> {
    // TODO: replace with a real "update listing" API call for `this.slug`.
    const externalListingId = input.externalListingId ?? `${this.slug}-${Date.now().toString(36)}`;
    return { externalListingId, publishedAt: new Date().toISOString() };
  }
}

const adapters = new Map<string, MarketplaceAdapter>();

export function getMarketplaceAdapter(slug: string): MarketplaceAdapter {
  if (!adapters.has(slug)) {
    adapters.set(slug, new MockMarketplaceAdapter(slug));
  }
  return adapters.get(slug)!;
}
