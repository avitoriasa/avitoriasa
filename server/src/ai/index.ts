import { db } from "../db.js";
import { AppSettings } from "../types.js";
import {
  AIProvider,
  ExplainRecommendationInput,
  ExplainRecommendationOutput,
  GenerateListingContentInput,
  GenerateListingContentOutput,
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
 * result always reports which provider actually produced it.
 */
class ResilientAIProvider implements AIProvider {
  name: string;

  constructor(private readonly primary: AIProvider) {
    this.name = primary.name;
  }

  async explainRecommendation(input: ExplainRecommendationInput): Promise<ExplainRecommendationOutput> {
    try {
      const result = await this.primary.explainRecommendation(input);
      this.name = this.primary.name;
      return result;
    } catch (err) {
      console.warn(`[ai] Provedor "${this.primary.name}" falhou (${(err as Error).message}); usando heurístico.`);
      this.name = `${heuristic.name} (fallback de ${this.primary.name})`;
      return heuristic.explainRecommendation(input);
    }
  }

  async generateListingContent(input: GenerateListingContentInput): Promise<GenerateListingContentOutput> {
    try {
      const result = await this.primary.generateListingContent(input);
      this.name = this.primary.name;
      return result;
    } catch (err) {
      console.warn(`[ai] Provedor "${this.primary.name}" falhou (${(err as Error).message}); usando heurístico.`);
      this.name = `${heuristic.name} (fallback de ${this.primary.name})`;
      return heuristic.generateListingContent(input);
    }
  }

  async researchSuppliers(input: ResearchSuppliersInput): Promise<ResearchSuppliersOutput> {
    try {
      const result = await this.primary.researchSuppliers(input);
      this.name = this.primary.name;
      return result;
    } catch (err) {
      console.warn(`[ai] Provedor "${this.primary.name}" falhou (${(err as Error).message}); usando heurístico.`);
      this.name = `${heuristic.name} (fallback de ${this.primary.name})`;
      return heuristic.researchSuppliers(input);
    }
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
