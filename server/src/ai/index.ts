import { db } from "../db.js";
import { AppSettings } from "../types.js";
import {
  AIProvider,
  AssessSupplierTrustInput,
  AssessSupplierTrustOutput,
  ExplainRecommendationInput,
  ExplainRecommendationOutput,
  GenerateListingContentInput,
  GenerateListingContentOutput,
  PlanInventoryInput,
  PlanInventoryOutput,
  ResearchSuppliersInput,
  ResearchSuppliersOutput,
} from "./AIProvider.js";
import { HeuristicProvider } from "./HeuristicProvider.js";
import { OllamaProvider } from "./OllamaProvider.js";

const heuristic = new HeuristicProvider();

/**
 * Wraps the configured provider so that any failure (Ollama not running,
 * model not pulled, network error, malformed JSON) transparently falls
 * back to the heuristic provider instead of breaking the feature. The
 * result always reports which provider actually produced it. Each AIProvider
 * method delegates to `run`, which carries the shared try/primary-then/
 * fallback-to-heuristic logic once instead of repeating it per method.
 */
class ResilientAIProvider implements AIProvider {
  name: string;

  constructor(private readonly primary: AIProvider) {
    this.name = primary.name;
  }

  private async run<T>(methodName: string, call: (provider: AIProvider) => Promise<T>): Promise<T> {
    try {
      const result = await call(this.primary);
      this.name = this.primary.name;
      return result;
    } catch (err) {
      console.warn(`[ai] Provedor "${this.primary.name}" falhou em ${methodName} (${(err as Error).message}); usando heurístico.`);
      this.name = `${heuristic.name} (fallback de ${this.primary.name})`;
      return call(heuristic);
    }
  }

  explainRecommendation(input: ExplainRecommendationInput): Promise<ExplainRecommendationOutput> {
    return this.run("explainRecommendation", (p) => p.explainRecommendation(input));
  }

  generateListingContent(input: GenerateListingContentInput): Promise<GenerateListingContentOutput> {
    return this.run("generateListingContent", (p) => p.generateListingContent(input));
  }

  researchSuppliers(input: ResearchSuppliersInput): Promise<ResearchSuppliersOutput> {
    return this.run("researchSuppliers", (p) => p.researchSuppliers(input));
  }

  assessSupplierTrust(input: AssessSupplierTrustInput): Promise<AssessSupplierTrustOutput> {
    return this.run("assessSupplierTrust", (p) => p.assessSupplierTrust(input));
  }

  planInventory(input: PlanInventoryInput): Promise<PlanInventoryOutput> {
    return this.run("planInventory", (p) => p.planInventory(input));
  }
}

export function createAIProvider(settings: AppSettings): AIProvider {
  if (settings.aiProvider === "ollama") {
    return new ResilientAIProvider(new OllamaProvider(settings.ollamaBaseUrl, settings.ollamaModel));
  }
  return heuristic;
}

export async function getConfiguredAIProvider(): Promise<AIProvider> {
  const store = await db.read();
  return createAIProvider(store.settings);
}

export type { AIProvider } from "./AIProvider.js";
