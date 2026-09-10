import { CURATED_TREND_SIGNALS, genericFallbackSignal } from "../data/trendSignals.js";
import { RisingQuery, TrendDirection, TrendSignal } from "../types.js";

/**
 * Pluggable source of Google-Trends-style search-interest data, mirroring
 * the AIProvider pattern (see ai/AIProvider.ts): a narrow interface, a
 * dependency-free default implementation, and an optional real one that a
 * ResilientTrendsProvider falls back away from on any failure.
 */
export interface TrendsProvider {
  readonly name: string;
  getSignals(keywords: string[], region: string): Promise<TrendSignal[]>;
}

function findCuratedMatch(keyword: string): TrendSignal | undefined {
  const normalized = keyword.trim().toLowerCase();
  return CURATED_TREND_SIGNALS.find(
    (signal) => signal.keyword === normalized || normalized.includes(signal.keyword) || signal.keyword.includes(normalized)
  );
}

/**
 * Default provider: looks up each keyword against the curated reference
 * dataset (data/trendSignals.ts). No network call, so it always works —
 * this is what the app runs on unless SERPAPI_KEY is configured.
 */
export class CuratedTrendsProvider implements TrendsProvider {
  readonly name = "curado";

  async getSignals(keywords: string[], region: string): Promise<TrendSignal[]> {
    return keywords.map((keyword) => {
      const match = findCuratedMatch(keyword);
      return match ? { ...match, region } : genericFallbackSignal(keyword);
    });
  }
}

interface SerpApiTimelinePoint {
  values: { value: number }[];
}

interface SerpApiRelatedQuery {
  query: string;
  value?: number | string;
}

/**
 * Real Google Trends data via SerpApi's `google_trends` engine
 * (https://serpapi.com/google-trends-api) — a paid third-party API with a
 * free tier, used because there is no official public Google Trends API.
 * Requires SERPAPI_KEY in the environment; throws on any failure (missing
 * key, HTTP error, unexpected shape) so the resilient wrapper below falls
 * back to CuratedTrendsProvider instead of breaking the feature.
 */
export class SerpApiTrendsProvider implements TrendsProvider {
  readonly name = "google_trends";

  constructor(private readonly apiKey: string) {}

  private direction(points: SerpApiTimelinePoint[]): TrendDirection {
    if (points.length < 2) return "estavel";
    const first = points[0]?.values?.[0]?.value ?? 0;
    const last = points[points.length - 1]?.values?.[0]?.value ?? 0;
    if (last > first * 1.15) return "subindo";
    if (last < first * 0.85) return "caindo";
    return "estavel";
  }

  async getSignals(keywords: string[], region: string): Promise<TrendSignal[]> {
    const results: TrendSignal[] = [];
    for (const keyword of keywords) {
      const timelineUrl = new URL("https://serpapi.com/search.json");
      timelineUrl.searchParams.set("engine", "google_trends");
      timelineUrl.searchParams.set("q", keyword);
      timelineUrl.searchParams.set("geo", region);
      timelineUrl.searchParams.set("data_type", "TIMESERIES");
      timelineUrl.searchParams.set("api_key", this.apiKey);

      const relatedUrl = new URL("https://serpapi.com/search.json");
      relatedUrl.searchParams.set("engine", "google_trends");
      relatedUrl.searchParams.set("q", keyword);
      relatedUrl.searchParams.set("geo", region);
      relatedUrl.searchParams.set("data_type", "RELATED_QUERIES");
      relatedUrl.searchParams.set("api_key", this.apiKey);

      const [timelineRes, relatedRes] = await Promise.all([fetch(timelineUrl), fetch(relatedUrl)]);
      if (!timelineRes.ok) throw new Error(`SerpApi (timeline) respondeu ${timelineRes.status}`);
      if (!relatedRes.ok) throw new Error(`SerpApi (related) respondeu ${relatedRes.status}`);

      const timelineData = (await timelineRes.json()) as {
        interest_over_time?: { timeline_data?: SerpApiTimelinePoint[] };
      };
      const relatedData = (await relatedRes.json()) as {
        related_queries?: { rising?: SerpApiRelatedQuery[] };
      };

      const points = timelineData.interest_over_time?.timeline_data ?? [];
      const interestScore = points.length ? points[points.length - 1]?.values?.[0]?.value ?? 40 : 40;
      const risingQueries: RisingQuery[] = (relatedData.related_queries?.rising ?? []).slice(0, 5).map((r) => ({
        query: r.query,
        growthPercent: typeof r.value === "number" ? r.value : Number(String(r.value).replace(/[^0-9]/g, "")) || 0,
      }));

      results.push({
        keyword,
        region,
        interestScore,
        direction: this.direction(points),
        risingQueries,
        source: "google_trends",
        updatedAt: new Date().toISOString(),
      });
    }
    return results;
  }
}

const curated = new CuratedTrendsProvider();

/**
 * Wraps the configured provider so a SerpApi failure (no key, rate limit,
 * network error) falls back to the curated dataset instead of breaking the
 * feature — same shape as ResilientAIProvider in ai/index.ts.
 */
class ResilientTrendsProvider implements TrendsProvider {
  name: string;

  constructor(private readonly primary: TrendsProvider) {
    this.name = primary.name;
  }

  async getSignals(keywords: string[], region: string): Promise<TrendSignal[]> {
    try {
      const result = await this.primary.getSignals(keywords, region);
      this.name = this.primary.name;
      return result;
    } catch (err) {
      console.warn(`[trends] Provedor "${this.primary.name}" falhou (${(err as Error).message}); usando dataset curado.`);
      this.name = `${curated.name} (fallback de ${this.primary.name})`;
      return curated.getSignals(keywords, region);
    }
  }
}

export function getConfiguredTrendsProvider(): TrendsProvider {
  const apiKey = process.env.SERPAPI_KEY;
  if (apiKey) {
    return new ResilientTrendsProvider(new SerpApiTrendsProvider(apiKey));
  }
  return curated;
}
