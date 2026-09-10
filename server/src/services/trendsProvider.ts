import { ALL_REGIONS, STATE_TO_REGION } from "../data/regionalReference.js";
import { CURATED_TREND_SIGNALS, genericFallbackSignal } from "../data/trendSignals.js";
import { RegionCode, RegionalSearchSignal, RisingQuery, TrendDirection, TrendSignal } from "../types.js";

/**
 * Pluggable source of Google-Trends-style search-interest data, mirroring
 * the AIProvider pattern (see ai/AIProvider.ts): a narrow interface, a
 * dependency-free default implementation, and an optional real one that a
 * ResilientTrendsProvider falls back away from on any failure.
 */
export interface TrendsProvider {
  readonly name: string;
  getSignals(keywords: string[], region: string): Promise<TrendSignal[]>;
  /** Per-macro-region search-interest breakdown for a single keyword, within `country` (e.g. "BR"). */
  getRegionalSignals(keyword: string, country: string): Promise<RegionalSearchSignal[]>;
}

function findCuratedMatch(keyword: string): TrendSignal | undefined {
  const normalized = keyword.trim().toLowerCase();
  return CURATED_TREND_SIGNALS.find(
    (signal) => signal.keyword === normalized || normalized.includes(signal.keyword) || signal.keyword.includes(normalized)
  );
}

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Default provider: looks up each keyword against the curated reference
 * dataset (data/trendSignals.ts). No network call, so it always works —
 * this is what the app runs on unless a SerpApi key is configured.
 */
export class CuratedTrendsProvider implements TrendsProvider {
  readonly name = "curado";

  async getSignals(keywords: string[], region: string): Promise<TrendSignal[]> {
    return keywords.map((keyword) => {
      const match = findCuratedMatch(keyword);
      return match ? { ...match, region } : genericFallbackSignal(keyword);
    });
  }

  async getRegionalSignals(keyword: string): Promise<RegionalSearchSignal[]> {
    const base = findCuratedMatch(keyword)?.interestScore ?? genericFallbackSignal(keyword).interestScore;
    // No live regional split without SerpApi — derive a stable, clearly-labeled
    // per-region variation from a hash of the keyword so results don't jump
    // around between calls, without pretending it's measured data.
    return ALL_REGIONS.map((region) => {
      const wobble = (hash(`${keyword}:${region}`) % 30) - 15; // -15..+14
      const interestScore = Math.max(0, Math.min(100, base + wobble));
      return { region, interestScore, source: "curado (sem repartição real por região)" };
    });
  }
}

/**
 * Free, no-key access to Google Trends' OWN backend — the same JSON
 * endpoints trends.google.com's website calls to draw its own charts, not
 * a third-party scraping service. This is what the (now-archived) pytrends
 * library wrapped for years. It's unofficial and undocumented (Google
 * could change or rate-limit it without notice, which is exactly why
 * pytrends itself bit-rotted — the wrapper stopped being updated, not that
 * Google shut the endpoint down), so every call is wrapped by
 * ResilientTrendsProvider below and falls back to the curated dataset on
 * any failure. No signup, no API key, no cost — this is the default.
 *
 * Protocol (reverse-engineered, stable for years): call `/explore` with the
 * keyword to get one "widget" per chart type (TIMESERIES, GEO_MAP,
 * RELATED_QUERIES) plus a request payload + token for each; then call the
 * matching `/widgetdata/*` endpoint with that widget's own request+token to
 * get its data. Every response is prefixed with `)]}',` (anti-JSON-hijack
 * padding) before the actual JSON.
 */
export class GoogleTrendsDirectProvider implements TrendsProvider {
  readonly name = "google_trends";

  private static readonly TIMEFRAME = "today 12-m";

  private stripXssiPrefix(text: string): string {
    const idx = text.indexOf("{");
    return idx >= 0 ? text.slice(idx) : text;
  }

  private async fetchGoogle<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`https://trends.google.com/trends/api/${path}`);
    url.searchParams.set("hl", "pt-BR");
    url.searchParams.set("tz", "180");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketplaceCRM/1.0)" },
    });
    if (!res.ok) throw new Error(`Google Trends respondeu ${res.status}`);
    const text = await res.text();
    return JSON.parse(this.stripXssiPrefix(text)) as T;
  }

  private async explore(keyword: string, geo: string): Promise<{ id: string; token: string; request: unknown }[]> {
    const req = JSON.stringify({
      comparisonItem: [{ keyword, geo, time: GoogleTrendsDirectProvider.TIMEFRAME }],
      category: 0,
      property: "",
    });
    const data = await this.fetchGoogle<{ widgets?: { id: string; token: string; request: unknown }[] }>("explore", { req });
    return data.widgets ?? [];
  }

  private direction(points: { value: number[] }[]): TrendDirection {
    if (points.length < 2) return "estavel";
    const first = points[0]?.value?.[0] ?? 0;
    const last = points[points.length - 1]?.value?.[0] ?? 0;
    if (last > first * 1.15) return "subindo";
    if (last < first * 0.85) return "caindo";
    return "estavel";
  }

  async getSignals(keywords: string[], region: string): Promise<TrendSignal[]> {
    const results: TrendSignal[] = [];
    for (const keyword of keywords) {
      const widgets = await this.explore(keyword, region);
      const timeseriesWidget = widgets.find((w) => w.id === "TIMESERIES");
      const relatedWidget = widgets.find((w) => w.id === "RELATED_QUERIES");
      if (!timeseriesWidget) throw new Error(`Sem dados de série temporal para "${keyword}"`);

      const timelineData = await this.fetchGoogle<{ default?: { timelineData?: { value: number[] }[] } }>(
        "widgetdata/multiline",
        { req: JSON.stringify(timeseriesWidget.request), token: timeseriesWidget.token }
      );
      const points = timelineData.default?.timelineData ?? [];
      const interestScore = points.length ? points[points.length - 1]?.value?.[0] ?? 40 : 40;

      let risingQueries: RisingQuery[] = [];
      if (relatedWidget) {
        const relatedData = await this.fetchGoogle<{
          default?: { rankedList?: { rankedKeyword?: { query: string; value: number; formattedValue?: string }[] }[] };
        }>("widgetdata/relatedsearches", { req: JSON.stringify(relatedWidget.request), token: relatedWidget.token });
        // rankedList[1] is the "rising" list (rankedList[0] is "top"); "Breakout" (>5000%) has no numeric value.
        const rising = relatedData.default?.rankedList?.[1]?.rankedKeyword ?? [];
        risingQueries = rising.slice(0, 5).map((r) => ({
          query: r.query,
          growthPercent: r.formattedValue === "Breakout" ? 5000 : r.value ?? 0,
        }));
      }

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

  /** "Interest by region" via the GEO_MAP widget — real per-state breakdown, bucketed into macro-regions. */
  async getRegionalSignals(keyword: string, country: string): Promise<RegionalSearchSignal[]> {
    const widgets = await this.explore(keyword, country);
    const geoWidget = widgets.find((w) => w.id === "GEO_MAP");
    if (!geoWidget) throw new Error(`Sem dados de região para "${keyword}"`);

    const data = await this.fetchGoogle<{ default?: { geoMapData?: { geoCode: string; value: number[] }[] } }>(
      "widgetdata/comparedgeo",
      { req: JSON.stringify(geoWidget.request), token: geoWidget.token }
    );
    const entries = data.default?.geoMapData ?? [];

    const sums: Record<RegionCode, { total: number; count: number }> = {
      norte: { total: 0, count: 0 },
      nordeste: { total: 0, count: 0 },
      centro_oeste: { total: 0, count: 0 },
      sudeste: { total: 0, count: 0 },
      sul: { total: 0, count: 0 },
    };

    for (const entry of entries) {
      // Google returns geo codes like "BR-SP" for state-level results.
      const uf = entry.geoCode?.split("-")[1]?.toUpperCase();
      const region = uf ? STATE_TO_REGION[uf] : undefined;
      if (!region) continue;
      sums[region].total += entry.value?.[0] ?? 0;
      sums[region].count += 1;
    }

    return ALL_REGIONS.map((region) => ({
      region,
      interestScore: sums[region].count > 0 ? Math.round(sums[region].total / sums[region].count) : 0,
      source: "google_trends",
    }));
  }
}

interface SerpApiTimelinePoint {
  values: { value: number }[];
}

interface SerpApiRelatedQuery {
  query: string;
  value?: number | string;
}

interface SerpApiGeoMapEntry {
  geo: string;
  extracted_value?: number;
  value?: string;
}

/**
 * Real Google Trends data via SerpApi's `google_trends` engine
 * (https://serpapi.com/google-trends-api) — a PAID third-party API (has a
 * free tier). Optional: use this only if you want a more stable/maintained
 * alternative to GoogleTrendsDirectProvider above and are fine paying past
 * the free tier. Requires an API key; throws on any failure (missing/
 * invalid key, HTTP error, unexpected shape) so the resilient wrapper below
 * falls back to CuratedTrendsProvider instead of breaking the feature.
 */
export class SerpApiTrendsProvider implements TrendsProvider {
  readonly name = "google_trends_serpapi";

  constructor(private readonly apiKey: string) {}

  private direction(points: SerpApiTimelinePoint[]): TrendDirection {
    if (points.length < 2) return "estavel";
    const first = points[0]?.values?.[0]?.value ?? 0;
    const last = points[points.length - 1]?.values?.[0]?.value ?? 0;
    if (last > first * 1.15) return "subindo";
    if (last < first * 0.85) return "caindo";
    return "estavel";
  }

  private async fetchJson<T>(params: Record<string, string>): Promise<T> {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_trends");
    url.searchParams.set("api_key", this.apiKey);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SerpApi respondeu ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async getSignals(keywords: string[], region: string): Promise<TrendSignal[]> {
    const results: TrendSignal[] = [];
    for (const keyword of keywords) {
      const [timelineData, relatedData] = await Promise.all([
        this.fetchJson<{ interest_over_time?: { timeline_data?: SerpApiTimelinePoint[] } }>({
          q: keyword,
          geo: region,
          data_type: "TIMESERIES",
        }),
        this.fetchJson<{ related_queries?: { rising?: SerpApiRelatedQuery[] } }>({
          q: keyword,
          geo: region,
          data_type: "RELATED_QUERIES",
        }),
      ]);

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

  /**
   * "Interest by region" for one keyword (https://serpapi.com/google-trends-interest-by-region):
   * data_type=GEO_MAP_0 + region=REGION returns per-state values within
   * `country`. States are bucketed into Brazilian macro-regions and
   * averaged — a real (not estimated) search-interest split.
   */
  async getRegionalSignals(keyword: string, country: string): Promise<RegionalSearchSignal[]> {
    const data = await this.fetchJson<{ interest_by_region?: SerpApiGeoMapEntry[] }>({
      q: keyword,
      geo: country,
      region: "REGION",
      data_type: "GEO_MAP_0",
    });
    const entries = data.interest_by_region ?? [];

    const sums: Record<RegionCode, { total: number; count: number }> = {
      norte: { total: 0, count: 0 },
      nordeste: { total: 0, count: 0 },
      centro_oeste: { total: 0, count: 0 },
      sudeste: { total: 0, count: 0 },
      sul: { total: 0, count: 0 },
    };

    for (const entry of entries) {
      // SerpApi returns geo codes like "BR-SP" for state-level results.
      const uf = entry.geo?.split("-")[1]?.toUpperCase();
      const region = uf ? STATE_TO_REGION[uf] : undefined;
      if (!region) continue;
      const value = entry.extracted_value ?? Number(String(entry.value).replace(/[^0-9]/g, "")) ?? 0;
      sums[region].total += value;
      sums[region].count += 1;
    }

    return ALL_REGIONS.map((region) => ({
      region,
      interestScore: sums[region].count > 0 ? Math.round(sums[region].total / sums[region].count) : 0,
      source: "google_trends",
    }));
  }
}

const curated = new CuratedTrendsProvider();

/**
 * Wraps the configured provider so a SerpApi failure (no/invalid key, rate
 * limit, network error) falls back to the curated dataset instead of
 * breaking the feature — same shape as ResilientAIProvider in ai/index.ts.
 */
class ResilientTrendsProvider implements TrendsProvider {
  name: string;

  constructor(private readonly primary: TrendsProvider) {
    this.name = primary.name;
  }

  private async run<T>(methodName: string, call: (provider: TrendsProvider) => Promise<T>): Promise<T> {
    try {
      const result = await call(this.primary);
      this.name = this.primary.name;
      return result;
    } catch (err) {
      console.warn(`[trends] Provedor "${this.primary.name}" falhou em ${methodName} (${(err as Error).message}); usando dataset curado.`);
      this.name = `${curated.name} (fallback de ${this.primary.name})`;
      return call(curated);
    }
  }

  getSignals(keywords: string[], region: string): Promise<TrendSignal[]> {
    return this.run("getSignals", (p) => p.getSignals(keywords, region));
  }

  getRegionalSignals(keyword: string, country: string): Promise<RegionalSearchSignal[]> {
    return this.run("getRegionalSignals", (p) => p.getRegionalSignals(keyword, country));
  }
}

/**
 * Default: free direct access to Google's own Trends backend (no key, no
 * cost) — falls back to the curated dataset on any failure. Only switches
 * to SerpApi (paid) if the caller configured an API key (AppSettings.
 * serpApiKey, or the SERPAPI_KEY env var as a secondary source) — that's an
 * explicit opt-in for extra reliability, never required.
 */
export function getConfiguredTrendsProvider(serpApiKey?: string): TrendsProvider {
  const key = serpApiKey || process.env.SERPAPI_KEY;
  if (key) {
    return new ResilientTrendsProvider(new SerpApiTrendsProvider(key));
  }
  return new ResilientTrendsProvider(new GoogleTrendsDirectProvider());
}
