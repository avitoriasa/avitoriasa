import { DropshipEstimate } from "../types.js";

/**
 * Reference-only threshold for Brazil's "Remessa Conforme" individual
 * remittance program: parcels up to US$50 sent through a compliant platform
 * get the federal Import Duty (II) zeroed; above that (or outside the
 * program) II applies from the first dollar. ICMS always applies regardless
 * — see server/.env.example and MARKETPLACE-CRM.md for sources.
 *
 * This models a SINGLE dropship order shipped straight to the end customer
 * — a different, simpler tax regime than the bulk commercial import used
 * for stock purchases (see pricingService/sourcingService's
 * importTaxPercent). Cross-check real numbers with a calculator like
 * tributado.net before relying on this for a real purchase.
 */
const REMESSA_CONFORME_EXEMPTION_USD = 50;
/** Reference II rate applied when a parcel falls outside the compliant exemption. */
const NON_EXEMPT_II_PERCENT = 60;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function estimateDropshipOrder(
  sourcePriceUsd: number,
  usdToBrlRate: number,
  shippingBrl: number,
  icmsPercent: number,
  isRemessaConformePlatform: boolean
): DropshipEstimate {
  const sourcePriceBrl = round2(sourcePriceUsd * usdToBrlRate);
  const iiExempt = isRemessaConformePlatform && sourcePriceUsd <= REMESSA_CONFORME_EXEMPTION_USD;
  const iiBrl = iiExempt ? 0 : round2(sourcePriceBrl * (NON_EXEMPT_II_PERCENT / 100));
  // ICMS applies on top of the price + freight + II (it's calculated "por dentro" on the full customs value in practice;
  // this is a simplified reference, not the official gross-up formula — confirm with a calculator like tributado.net).
  const icmsBrl = round2((sourcePriceBrl + shippingBrl + iiBrl) * (icmsPercent / 100));
  const totalLandedBrl = round2(sourcePriceBrl + shippingBrl + iiBrl + icmsBrl);

  return {
    sourcePriceUsd,
    sourcePriceBrl,
    shippingBrl: round2(shippingBrl),
    iiExempt,
    iiBrl,
    icmsPercent,
    icmsBrl,
    totalLandedBrl,
  };
}
