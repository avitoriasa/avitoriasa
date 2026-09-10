import {
  AIProvider,
  AnalyzeSeoTrendsInput,
  AnalyzeSeoTrendsOutput,
  AssessSupplierTrustInput,
  AssessSupplierTrustOutput,
  DraftAdCopyInput,
  DraftAdCopyOutput,
  ExplainRecommendationInput,
  ExplainRecommendationOutput,
  GenerateListingContentInput,
  GenerateListingContentOutput,
  PlanInventoryInput,
  PlanInventoryOutput,
  ResearchSuppliersInput,
  ResearchSuppliersOutput,
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

  async researchSuppliers(input: ResearchSuppliersInput): Promise<ResearchSuppliersOutput> {
    const prompt = `Você é um consultor de sourcing/importação para revendedores brasileiros de produtos de beleza
(perfumaria, skincare, maquiagem e cabelo).
Os dados abaixo são opções de fornecimento JÁ PESQUISADAS e JÁ ORDENADAS pelo menor custo total de
importação (landedCostBrlMin/Max = produto + frete + impostos de referência) — essa é a prioridade
automática da busca. Você NÃO deve inventar fornecedores, preços ou dados novos, nem reordenar as opções.
Cada opção já traz um campo suggestedFulfillment ("estoque", "dropshipping" ou "ambos"), calculado a partir do
MOQ e do nicho — "dropshipping" significa comprar unidade a unidade só depois que a venda acontece (sem manter
estoque), indicado para MOQ baixo e ticket alto. Sua tarefa é apenas: (1) escrever uma frase de análise
estratégica objetiva para cada opção, considerando o custo total de importação (não só o preço do produto no
exterior), o risco de autenticidade (especialmente para grifes originais importadas via mercado paralelo) e o
suggestedFulfillment já calculado, e (2) um resumo geral de estratégia de compra para a busca "${input.query}",
destacando a opção de menor custo total.

Opções (já ordenadas por landedCostBrlMin crescente): ${JSON.stringify(input.options, null, 2)}

Responda APENAS em JSON no formato:
{"summary": "...", "reasoningByLeadId": {"<leadId>": "<análise em português>", ...}}`;

    return this.generateJson<ResearchSuppliersOutput>(prompt);
  }

  async assessSupplierTrust(input: AssessSupplierTrustInput): Promise<AssessSupplierTrustOutput> {
    const prompt = `Você é um analista de confiança de fornecedores para um revendedor brasileiro de produtos de beleza.
O nível e a pontuação de confiança abaixo JÁ FORAM calculados por um critério curado — você NÃO deve mudar
o nível nem inventar uma pontuação diferente. Sua única tarefa é escrever uma recomendação prática e objetiva
em português sobre como o revendedor deve agir ao considerar esse fornecedor.

Fornecedor: ${input.leadName}
Nível de confiança: ${input.trustTier}
Pontuação: ${input.trustScore}/100
Sinais considerados: ${input.trustSignals.join("; ") || "nenhum sinal adicional"}
Observações de risco: ${input.riskNotes}

Responda APENAS em JSON no formato:
{"reasoning": "..."}`;

    return this.generateJson<AssessSupplierTrustOutput>(prompt);
  }

  async planInventory(input: PlanInventoryInput): Promise<PlanInventoryOutput> {
    const prompt = `Você é um planejador de estoque para um pequeno revendedor de produtos de beleza no Brasil.
O ponto de reposição e a quantidade de reposição abaixo JÁ FORAM calculados — você NÃO deve mudar esses números.
Sua única tarefa é explicar em português, de forma prática, por que esse plano faz sentido dado o MOQ e o
prazo de entrega do fornecedor.

Produto: ${input.productName}
MOQ do fornecedor: ${input.moq} unidades
Prazo de entrega: ${input.leadTimeDays} dias
Ponto de reposição sugerido: ${input.reorderPoint} unidades
Quantidade de reposição sugerida: ${input.reorderQuantity} unidades

Responda APENAS em JSON no formato:
{"reasoning": "..."}`;

    return this.generateJson<PlanInventoryOutput>(prompt);
  }

  async analyzeSeoTrends(input: AnalyzeSeoTrendsInput): Promise<AnalyzeSeoTrendsOutput> {
    const prompt = `Você é um analista de SEO e tendências de busca para e-commerce brasileiro.
As oportunidades de palavra-chave abaixo JÁ FORAM calculadas e ordenadas (interestScore = interesse de busca no
Google Trends para o Brasil, relevanceScore = quão aderente a palavra é a este produto específico, combinedScore =
combinação das duas). Você NÃO deve reordenar, inventar ou mudar esses números. Sua única tarefa é: (1) escrever uma
frase de análise para cada palavra-chave, considerando a direção da tendência (subindo/estável/caindo) e as buscas
relacionadas em ascensão, e (2) um resumo estratégico de como usar essas palavras no título/descrição/anúncios do
produto "${input.product.name}" (categoria: ${input.product.category}).

Oportunidades (já ordenadas por combinedScore decrescente): ${JSON.stringify(input.opportunities, null, 2)}

Responda APENAS em JSON no formato:
{"summary": "...", "reasoningByKeyword": {"<keyword>": "<análise em português>", ...}}`;

    return this.generateJson<AnalyzeSeoTrendsOutput>(prompt);
  }

  async draftAdCopy(input: DraftAdCopyInput): Promise<DraftAdCopyOutput> {
    const prompt = `Você é um redator publicitário para marketplaces brasileiros. O orçamento diário abaixo JÁ FOI
calculado (referência de 10%-30% do preço líquido do produto) — você NÃO deve mudar esses valores, apenas
mencioná-los na nota de segmentação. Sua tarefa é escrever um título curto de anúncio, um texto principal e uma nota
de segmentação de público, para veicular no marketplace "${input.marketplaceName}".

Produto: ${input.product.name}
Descrição: ${input.product.description}
Categoria: ${input.product.category}
Palavras-chave prioritárias (já calculadas por tendência+relevância): ${input.topKeywords.join(", ")}
Orçamento diário de referência: R$ ${input.budget.dailyMinBrl} a R$ ${input.budget.dailyMaxBrl}

Responda APENAS em JSON no formato:
{"headline": "...", "primaryText": "...", "targetingNotes": "..."}`;

    return this.generateJson<DraftAdCopyOutput>(prompt);
  }
}
