import {
  AIProvider,
  ExplainRecommendationInput,
  ExplainRecommendationOutput,
  GenerateListingContentInput,
  GenerateListingContentOutput,
} from "./AIProvider.js";

/**
 * Talks to a locally-running Ollama server (https://ollama.com) hosting an
 * open-source model (e.g. llama3, mistral, qwen2). Ollama is not bundled
 * with this app — install it separately and run `ollama pull <model>`.
 * Any network/parse failure is thrown and caught by the factory in
 * src/ai/index.ts, which falls back to HeuristicProvider so the app keeps
 * working without a local model available.
 */
export class OllamaProvider implements AIProvider {
  readonly name = "ollama";

  constructor(
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  private async generateJson<T>(prompt: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: "json",
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Ollama respondeu ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as { response: string };
      return JSON.parse(data.response) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async explainRecommendation(input: ExplainRecommendationInput): Promise<ExplainRecommendationOutput> {
    const prompt = `Você é um especialista em e-commerce brasileiro. Para o produto "${input.product.name}"
(categoria: ${input.product.category}, descrição: ${input.product.description}),
explique em uma frase objetiva por que cada marketplace abaixo recebeu essa pontuação,
considerando demanda, concorrência, taxas e histórico de categoria.

Dados: ${JSON.stringify(input.ranking, null, 2)}

Responda APENAS em JSON no formato:
{"reasoningByMarketplace": {"<marketplaceId>": "<explicação em português>", ...}}`;

    return this.generateJson<ExplainRecommendationOutput>(prompt);
  }

  async generateListingContent(input: GenerateListingContentInput): Promise<GenerateListingContentOutput> {
    const prompt = `Você é um especialista em SEO para marketplaces brasileiros. Reescreva o anúncio abaixo
para maximizar cliques e conversão no marketplace "${input.marketplace.name}", mantendo veracidade.
Este é o ciclo de otimização #${input.iteration} — gere uma variação diferente das anteriores
(novo ângulo, gatilho ou palavras-chave) para evitar conteúdo repetido, o que prejudica o ranking.

Produto: ${input.product.name}
Categoria: ${input.product.category}
Descrição original: ${input.product.description}
Título atual: ${input.currentTitle}
Descrição atual: ${input.currentDescription}
Palavras-chave atuais: ${input.currentKeywords.join(", ")}

Restrições do marketplace: título até ${input.marketplace.titleMaxLength} caracteres,
descrição até ${input.marketplace.descriptionMaxLength} caracteres,
até ${input.marketplace.maxKeywords} palavras-chave.

Responda APENAS em JSON no formato:
{"title": "...", "description": "...", "keywords": ["..."], "changeReason": "..."}`;

    const result = await this.generateJson<GenerateListingContentOutput>(prompt);
    return {
      ...result,
      title: result.title.slice(0, input.marketplace.titleMaxLength),
      description: result.description.slice(0, input.marketplace.descriptionMaxLength),
      keywords: result.keywords.slice(0, input.marketplace.maxKeywords),
    };
  }
}
