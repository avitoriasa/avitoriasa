import { getMarketplaceAdapter } from "../adapters/MarketplaceAdapter.js";
import { Marketplace, PricingBreakdown, Product, ProductMarketplaceConnection } from "../types.js";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reverse pricing: the seller sets Product.basePrice as the amount they want
 * to net per sale. Marketplaces charge their fee as a percentage of the
 * published (listing) price, so we solve for the listing price that nets
 * exactly basePrice after that cut:
 *
 *   listingPrice - listingPrice * feePercent/100 = basePrice
 *   listingPrice = basePrice / (1 - feePercent/100)
 */
export function computePricing(basePrice: number, feePercent: number): PricingBreakdown {
  const safeFeePercent = Math.min(Math.max(feePercent, 0), 95);
  const listingPrice = round2(basePrice / (1 - safeFeePercent / 100));
  const feeAmount = round2(listingPrice - basePrice);
  return { basePrice: round2(basePrice), feePercent, feeAmount, listingPrice };
}

/**
 * Recomputes pricing for a connection (e.g. after the product's base price
 * changed) and pushes the new price to the marketplace, keeping the current
 * title/description/keywords untouched — this is a price-only sync, not an
 * SEO optimization cycle.
 */
export async function syncConnectionPricing(
  connection: ProductMarketplaceConnection,
  product: Product,
  marketplace: Marketplace
): Promise<PricingBreakdown> {
  const pricing = computePricing(product.basePrice, marketplace.feePercent);
  const adapter = getMarketplaceAdapter(marketplace.slug);
  await adapter.publishListing({
    externalListingId: connection.externalListingId,
    title: connection.currentTitle,
    description: connection.currentDescription,
    keywords: connection.currentKeywords,
    price: pricing.listingPrice,
  });
  return pricing;
}
