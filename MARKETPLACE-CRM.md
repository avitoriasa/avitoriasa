# Marketplace CRM com IA

CRM para conectar seus produtos aos melhores marketplaces. **O dono só gerencia e dá o comando**: a IA pesquisa, calcula e sugere, mas nada entra ou sai de um marketplace sem ele aprovar na [Central de comando](#central-de-comando-o-dono-decide-a-ia-executa). O sistema:

1. **Recomenda o melhor marketplace** para cada produto, com um score e uma justificativa gerados por um modelo de IA (interface plugável para modelos open source via [Ollama](https://ollama.com), com um fallback heurístico que funciona sem nenhuma dependência externa).
2. **Conecta o produto** ao marketplace escolhido (adapters mockados para Mercado Livre, Shopee, Amazon Brasil, Magazine Luiza, Shein, TikTok Shop e YouTube Shopping — prontos para receber credenciais reais), já calculando o preço de publicação a partir da taxa daquele marketplace.
3. **Reotimiza continuamente** título, descrição e palavras-chave (SEO) de cada anúncio conectado, em ciclos automáticos, para evitar estagnação no ranking do marketplace.
4. **Acompanha o financeiro** de cada produto/marketplace: vendas, taxa cobrada e repasse esperado (hoje simulado, pronto para ligar às APIs reais de pedidos de cada marketplace).
5. **Pesquisa fornecedores confiáveis de beleza automaticamente** (perfumaria, skincare, maquiagem, cabelo — com foco em produtos de marca) via IA, ranqueando sempre pelo **menor custo total de importação** (produto + frete + impostos de referência) e mostrando o **nível de confiança** de cada canal, com MOQ, prazo, margem estimada e uma calculadora de câmbio.
6. **Funciona nos dois modelos, com dropshipping como padrão**: compre por pedido só depois que a venda acontece (sem comprar antes) — e, quando você preferir comprar no atacado e manter estoque, o **controle de estoques** entra automaticamente em ação.
7. **Multiagentes de IA** rodam uma "esteira" por opção de fornecedor escolhida: um agente analisa a confiança do fornecedor e, se fizer sentido manter estoque, outro agente sugere o plano de reposição — cada agente usa o modelo configurado (heurístico ou Ollama/Llama).
8. **Analisa tendências de busca (Google Trends, Brasil) e sugere SEO/anúncios pagos**: um agente de IA cruza o interesse de busca de palavras-chave relacionadas ao produto com a aderência ao próprio produto, ranqueia as melhores oportunidades e rascunha um anúncio pago com orçamento de referência — para colar no gerenciador de anúncios de cada marketplace, não para disparar campanha sozinho.

## Central de comando (o dono decide, a IA executa)

A tela inicial do app é a **Central de comando**: é lá que o dono toca o negócio sem precisar entender nada de técnico. O princípio é um só — **a IA pesquisa, calcula e sugere; quem manda o produto pro ar (ou tira) é o dono**.

**O que aparece na tela:**

1. **Esperando sua decisão** — cada coisa que a IA quer fazer vira um cartão com dois botões, **Aprovar** e **Recusar**:
   - *Publicar no marketplace*: "Publicar 'Perfume Árabe Khamrah' em Shein", já mostrando por quanto seria publicado, quanto o dono recebe líquido e a pontuação daquele marketplace para o produto.
   - *Melhorar anúncio no ar*: mostra o título atual e o título proposto lado a lado, com as novas palavras-chave e o motivo da IA.
   
   Enquanto o cartão estiver pendente, **nada muda no marketplace**. Recusar descarta a proposta e o anúncio segue exatamente como estava.
2. **No ar agora / Pausados por você** — a lista do que está à venda, com botão **Pausar** (tira do ar sem apagar) e **Voltar ao ar**. Anúncio pausado não recebe proposta de otimização nem novos pedidos.
3. **Estoque acabando** — alerta dos produtos em modo estoque que bateram o ponto de reposição.
4. **Suas últimas decisões** — o histórico do que ele aprovou/recusou e o que aconteceu depois de cada decisão.

**Quem decide as mudanças** (tela de Configurações):

- **"Eu aprovo tudo" (padrão)** — a IA só propõe. Nenhum título, descrição ou palavra-chave muda sozinho.
- **"A IA pode reotimizar sozinha"** — a IA atualiza o SEO dos anúncios que já estão no ar sem perguntar.

**Colocar um produto num marketplace novo sempre exige aprovação do dono, nos dois modos** — é a decisão que muda o que está à venda, então nunca é automática. O ciclo automático (`schedulerService.ts`) respeita isso: em modo manual ele chama `approvalService.proposeSeoUpdate` em vez de `optimizeConnection`, e propostas duplicadas para o mesmo anúncio não são criadas.

Onde isso vive no código: `services/approvalService.ts` (fila de decisões), `services/publishingService.ts` (os comandos do dono: publicar/pausar/retomar/retirar) e `seoOptimizationService.ts`, que foi separado em `generateListingUpdate` (só gera a proposta, não publica) e `applyListingUpdate` (publica de fato, depois do aval).

## Estrutura

```
server/   API (Node + TypeScript + Express), persistência em arquivo JSON
client/   Frontend (React + Vite + TypeScript + Tailwind)
```

## Como rodar

### 1. Backend

```bash
cd server
npm install
cp .env.example .env   # opcional, ajuste conforme necessário
npm run dev             # http://localhost:4000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev              # http://localhost:5173 (proxy de /api para o backend)
```

Abra `http://localhost:5173`, cadastre um produto, veja a recomendação de marketplace, conecte-o e acompanhe as otimizações automáticas de SEO no histórico.

## Como funciona a IA

- **Modo padrão (`AI_PROVIDER=heuristic`)**: um gerador determinístico baseado em regras (demanda/concorrência/taxas/afinidade de categoria simuladas + rotação de ângulos de copy) — funciona 100% offline, sem custo e sem instalar nada.
- **Modo `AI_PROVIDER=ollama`**: conecta a um servidor [Ollama](https://ollama.com) local rodando um modelo open source (Llama 3, Mistral, Qwen2, etc.) para gerar as justificativas de recomendação e reescrever os anúncios. Se o Ollama estiver indisponível, o sistema cai automaticamente no modo heurístico (ver `server/src/ai/index.ts`).

Para usar Ollama:

```bash
# instale o Ollama (https://ollama.com) e baixe um modelo
ollama pull llama3
ollama serve

# no server/.env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
```

A troca de provedor pode ser feita também pela tela de **Configurações** no app.

## Como plugar marketplaces reais

Cada marketplace hoje usa um adapter mockado (`server/src/adapters/MarketplaceAdapter.ts`) que simula a conexão e a publicação do anúncio, e um simulador de sinais de mercado (`server/src/services/marketSignals.ts`) que gera demanda/concorrência plausíveis por categoria.

Para integrar de verdade:

1. Adicione as credenciais da API do marketplace (token OAuth, client id/secret) nas variáveis de ambiente do `server/.env`.
2. Em `MarketplaceAdapter.ts`, substitua o corpo de `connect()` e `publishListing()` pela chamada HTTP real da API de vendedor daquele marketplace (ex.: Mercado Livre, Amazon Selling Partner API).
3. Em `marketSignals.ts`, troque os dados simulados pela chamada real de tendências/demanda daquele marketplace, mantendo o formato `MarketSignal`.

O restante do sistema (recomendação, otimização, scheduler, rotas, frontend) não precisa mudar — tudo depende apenas dessas interfaces.

### TikTok Shop e YouTube Shopping — particularidades

- **TikTok Shop**: taxa por faixa de preço (pesquisado em set/2026): abaixo de R$ 50 é 10% sem taxa fixa; a partir de R$ 50 é 6% + R$ 6 fixos por item. O catálogo assume a segunda faixa (`feePercent: 6`, `fixedFeeBrl: 6`) por ser a mais comum em perfumaria — confirme no painel de vendedor, pois a estrutura muda com frequência.
- **YouTube Shopping (Programa de Afiliados)**: não é um marketplace tradicional. Você precisa de loja própria conectada ao Google Merchant Center (hoje, via Shopify) — a venda acontece no seu site, não "dentro" do YouTube. O `feePercent` aqui representa a **comissão que você mesmo define** para pagar aos criadores que marcam seu produto em vídeos (a média do programa é ~15%), não uma taxa cobrada pela plataforma. O repasse da comissão aos criadores é feito via AdSense, 60-120 dias após a compra.

## Precificação (preço + taxa do marketplace)

Cada produto tem um `basePrice`: o valor líquido que você quer receber por unidade vendida. Cada marketplace conectado tem sua própria `feePercent` e, opcionalmente, uma `fixedFeeBrl` (taxa fixa por item, ex.: TikTok Shop). O preço realmente publicado no marketplace (`listingPrice`) é calculado por **precificação reversa** (`server/src/services/pricingService.ts`), para que, depois do marketplace descontar taxa + fixo, sobre exatamente o `basePrice`:

```
listingPrice = (basePrice + fixedFeeBrl) / (1 - feePercent / 100)
```

Exemplo: produto com preço líquido de R$ 300 num marketplace com taxa de 14% (sem taxa fixa) é publicado por **R$ 348,84** (R$ 48,84 de taxa) — o vendedor recebe R$ 300,00 líquidos. Com taxa fixa (ex.: TikTok Shop, R$ 100 líquidos, 6% + R$ 6): publica por **R$ 112,77**.

Esse breakdown (preço base, taxa, preço publicado) aparece:
- em cada marketplace do ranking de recomendação;
- em cada conexão ativa na tela do produto.

Se você editar o preço líquido do produto (`PUT /api/products/:id`), o preço publicado de **todas as conexões ativas** é recalculado e reenviado ao adapter do marketplace na hora — não espera o próximo ciclo de SEO.

## Financeiro (pedidos e repasses)

Não é necessário integrar a uma plataforma de pagamento à parte para receber o valor das vendas: cada marketplace processa o pagamento do comprador e credita o líquido (já descontada a taxa) numa carteira/saldo próprio do vendedor dentro daquele marketplace (ex.: Mercado Pago no Mercado Livre). O saque dali para sua conta bancária é feito na própria plataforma do marketplace — este CRM não move dinheiro.

O que o CRM oferece é uma **visão financeira consolidada**, hoje simulada e pronta para virar integração real:

- `server/src/adapters/MarketplaceAdapter.ts` expõe `fetchOrders(...)`, mockado para gerar 0-2 vendas por consulta ao preço de publicação atual. Troque por uma chamada real à API de pedidos de cada marketplace (ex.: Orders API do Mercado Livre, SP-API da Amazon, Order API da Shopee) e o resto do sistema não muda.
- `server/src/services/ordersService.ts` calcula bruto/taxa/líquido de cada pedido e simula o repasse amadurecendo pedidos "pendentes" para "pagos" após ~14 dias (ajuste `PAYOUT_DELAY_DAYS` ou troque pela data real de liquidação da API do marketplace).
- O scheduler já busca novos pedidos e amadurece repasses a cada ciclo; também dá para forçar uma venda simulada pelo botão **"Simular venda"** na tela do produto (ou `POST /api/connections/:id/orders/simulate`), útil para testar sem esperar o ciclo automático.
- O resumo financeiro (bruto, taxas, pendente, repassado) aparece na tela do produto e no Dashboard.

## Fornecedores (beleza: perfumaria, skincare, maquiagem, cabelo)

Tela **Fornecedores** (`client/src/pages/Sourcing.tsx`) para pesquisar canais de compra confiáveis no ramo da beleza, com foco em produtos de marca:

- `server/src/data/supplierLeads.ts` é uma lista curada de referência — hoje com marcas próprias de atacado direto (perfumaria árabe como Lattafa/Ard Al Zaafaran/Rasasi/Swiss Arabian/Ajmal/Al Haramain, linhas "inspired by" como Armaf/Paris Corner/Fragrance World, K-beauty como COSRX/Anua/Beauty of Joseon), canais de **importação paralela de marcas originais** (perfumes de grife, skincare/haircare profissional, maquiagem ocidental) e plataformas B2B gerais (Alibaba/TradeKey) — **não é dado ao vivo/raspado**; os custos (incluindo frete de referência por unidade, `freightUsdPerUnit`) são faixas de referência, sempre confirme preço/MOQ/autenticidade direto com o fornecedor antes de comprar.
- Cada fornecedor tem uma **categoria** (`perfumes`/`skincare`/`maquiagem`/`cabelo`/`beleza_geral`), um **nicho** (`marca_propria_atacado`, `importados_originais_marca` ou `geral_b2b`) e um **nível de confiança curado** (`trustTier`: verificado/referência/alerta, `trustScore` 0-100, `trustSignals`: motivos concretos) — é assim que "meus importadores precisam ser de confiança" fica visível na busca, não só uma nota de risco solta.
- `server/src/services/sourcingService.ts` filtra esse catálogo pela busca (roda automaticamente ao abrir a tela, com a query "beleza" cobrindo todas as categorias por padrão — use os filtros rápidos ou digite "skincare"/"maquiagem"/"cabelo"/"perfumes" para restringir), converte o custo e o frete para BRL usando `settings.usdToBrlRate`, aplica a alíquota de referência `settings.importTaxPercent` para chegar no **custo total de importação por unidade** (`landedCostBrlMin/Max`), calcula a margem estimada sobre esse custo total se você informar um preço de venda pretendido, e pede à IA (`AIProvider.researchSuppliers`) apenas a análise em texto — os números vêm sempre do catálogo curado, a IA nunca inventa fornecedor, preço ou nível de confiança.
- **A ordenação é sempre automática pelo menor custo total de importação** (não pelo menor preço de produto isoladamente) — é a opção marcada como "Menor custo total" na tela.
- **Meus fornecedores confiáveis**: além do catálogo de referência, você mantém sua própria lista (`TrustedSupplier`, `server/src/services/trustedSupplierService.ts`) — "Salvar como confiável" em qualquer opção da busca, ou cadastre a mão via API. É separada do catálogo curado de propósito: é a sua palavra final sobre quem você confia.
- Uma **calculadora de câmbio** de referência compara o custo total pagando o fornecedor por diferentes métodos (conta PJ internacional, remessa bancária, cartão corporativo, carta de crédito), usando spreads típicos (`server/src/data/fxMethods.ts`) — troque por cotações reais da sua fintech/banco quando for pagar de verdade.
- Um botão em cada opção ("Usar esta opção para criar produto") pré-preenche o formulário de novo produto com nome, categoria, custo de aquisição (o custo total de importação médio), modo de venda sugerido (dropshipping ou estoque) e palavras-chave, fechando o ciclo: pesquisar fornecedor → cadastrar produto com custo → ver recomendação de marketplace e margem → conectar e vender.
- A tela também traz um checklist informativo (não é aconselhamento jurídico/tributário) sobre importação comercial de produtos de beleza no Brasil: CNPJ + habilitação no Radar Siscomex, Autorização de Funcionamento (AFE) da Anvisa, classificação NCM (3303 perfumes; 3304/3305 skincare/maquiagem/cabelo), e tributos sobre o valor aduaneiro (II, IPI, PIS/COFINS monofásico, ICMS) — bem diferente do regime simplificado de compras de pessoa física ("remessa conforme"), que não vale para importação comercial em volume.

Para extrapolar para outras categorias: adicione mais entradas a `supplierLeads.ts` (ou troque o módulo por uma integração real com uma API de sourcing B2B) — o resto do fluxo não muda.

## Multiagentes de IA (a "esteira" de onboarding)

Botão **"Rodar esteira (IA)"** em cada opção da busca de fornecedores dispara um pipeline multiagente (`server/src/services/agentOrchestrator.ts`), usando o provedor de IA configurado (heurístico por padrão, ou um modelo Ollama/Llama quando configurado em Configurações):

1. **Agente de confiança** (`AIProvider.assessSupplierTrust`) — recebe o `trustTier`/`trustScore`/`trustSignals` já curados e escreve uma recomendação prática de como agir; não pode mudar o nível nem inventar uma pontuação.
2. **Agente de estoque** (`AIProvider.planInventory`) — só roda quando a opção não é puramente indicada para dropshipping. `reorderPoint`/`reorderQuantity` são calculados deterministicamente a partir do MOQ e do prazo de entrega do fornecedor; o agente só explica o plano.

Cada agente recebe apenas os números que precisa e nunca os recalcula — o mesmo padrão usado em `researchSuppliers`/`explainRecommendation`/`generateListingContent`. Isso significa que trocar o modelo (heurístico ↔ Ollama/Llama ↔ outro modelo) muda a qualidade do texto explicativo, nunca os números que embasam a decisão.

## Estoque x Dropshipping

Cada produto tem um `fulfillmentMode`: `"dropship"` (padrão — sem estoque: cada pedido é comprado individualmente só depois que a venda acontece, e enviado direto ao cliente final; é o modelo priorizado, cortando a etapa de "comprar primeiro para depois vender") ou `"stock"` (compra no atacado, guarda estoque, você mesmo despacha — e aí o **controle de estoques** abaixo entra em ação automaticamente).

- **Sugestão automática**: `sourcingService.ts` calcula um `suggestedFulfillment` ("estoque", "dropshipping" ou "ambos") por opção de fornecedor, a partir do MOQ e do nicho — MOQ baixo (≤25) + grife original tende a "dropshipping" (menos capital preso, evita comprar 12-24 unidades de um item caro e sensível a autenticidade); MOQ alto favorece "estoque". Ao clicar em "Usar esta opção para criar produto", o modo já vem pré-selecionado de acordo.
- **Regime tributário diferente**: import comercial em volume (estoque) usa o regime formal (CNPJ + Radar Siscomex + Anvisa + II/IPI/PIS-COFINS/ICMS sobre valor aduaneiro). Dropshipping — uma remessa por vez, endereçada direto ao cliente final — cai no regime simplificado de **remessa individual** (o mesmo do consumidor comum): II isento até US$ 50 via plataforma "Remessa Conforme", ICMS sempre incide. `server/src/services/dropshipService.ts` modela esse segundo regime (`estimateDropshipOrder`), separado do `importTaxPercent` usado para estoque — ver `settings.remessaIcmsPercent`, editável em Configurações.
- **Calculadora de dropshipping** (tela Fornecedores): você informa o preço de varejo (ver abaixo) e o frete estimado, marca se a compra foi feita por uma plataforma "Remessa Conforme", e o sistema estima o custo total dessa compra pontual (produto + frete + II + ICMS). É uma referência — confirme com um simulador como o [tributado.net](https://m.tributado.net) antes de fechar.
- **Achar o menor preço de varejo**: este app não tem integração automática com ferramentas de cupom/cashback — a [Honey](https://www.joinhoney.com) (extensão de navegador da PayPal) não expõe uma API pública para consulta programática de preços, então isso continua manual: você mesmo confere o menor preço com cupom antes de registrar a compra no pedido.
- **Rastreio de pedidos**: cada `Order` pode guardar `trackingCarrier`/`trackingNumber`. Para a transportadora `"USPS"`, o sistema já gera o link público de rastreio (`https://tools.usps.com/go/TrackConfirmAction?tLabels=<código>`, o mesmo formato do [rastreador oficial](https://tools.usps.com/tracking/)) — sem precisar de API key. Isso é só o link da página pública; consultar o status via API exige credenciais nas novas **USPS APIs** (o antigo Web Tools API foi desativado em 25/01/2026) — troque `ordersService.getTrackingUrl`/adicione um adapter de tracking quando for automatizar isso.
- **Lucro por pedido**: ao registrar o custo pago na fonte + imposto estimado de um pedido dropship (`PUT /api/orders/:id/dropship-purchase`), o sistema calcula `dropshipProfitBrl = líquido do marketplace − custo na fonte − imposto`, visível na tela do produto.

## Controle de estoques

Só existe para produtos em modo `"stock"` — quando você decide comprar antes para revender. Tela **Estoque** no menu (visão de todos os produtos com estoque) + uma seção dedicada na página de cada produto (registrar compra, ajustar por contagem física, definir ponto de reposição, ver o histórico de movimentações).

- `server/src/domain/InventoryItem.ts` é a entidade de domínio (sem nenhuma dependência de Express/JSON) que garante as regras do estoque por conta própria: a quantidade nunca fica negativa, e o custo médio é sempre recalculado como **média ponderada** a cada compra recebida — nunca editado à mão. `receivePurchase`, `releaseForSale` e `adjustQuantity` são os únicos jeitos de mudar o saldo, e cada um valida sua própria regra antes de aplicar a mudança.
- `server/src/services/inventoryRepository.ts` é a camada de infraestrutura: só ela sabe que a persistência é um arquivo JSON, traduzindo entre a entidade e o formato salvo (`InventoryItemSnapshot`).
- `server/src/services/inventoryService.ts` é a camada de aplicação (casos de uso): `recordStockPurchase`, `consumeStockForSale`, `adjustStock`, `setReorderPoint`. Uma compra de estoque também atualiza `Product.costBasis` para o novo custo médio, mantendo a margem exibida no produto sempre correta.
- Toda venda de um produto em modo `"stock"` decrementa o estoque automaticamente (`ordersService.ts` chama `consumeStockForSale` ao registrar cada pedido) — se o saldo for insuficiente, a venda é registrada mas o estoque não fica negativo (fica um aviso no log do servidor); produtos em dropshipping não têm registro de estoque, então nada acontece para eles.

## Tendências de busca, SEO e anúncios pagos (agente de IA)

Na página de um produto, o botão **"Analisar tendências"** roda um agente de IA que:

1. Monta uma lista de palavras-chave a partir do próprio produto (categoria, palavras-chave cadastradas, termos do nome) — `server/src/services/seoTrendsService.ts#buildKeywordCandidates`.
2. Busca o interesse de busca (0-100, escala do próprio Google Trends) e as buscas relacionadas em ascensão para cada palavra-chave, na região Brasil — `server/src/services/trendsProvider.ts`.
3. Calcula, de forma determinística, a relevância de cada palavra-chave para aquele produto específico (sobreposição de termos com nome/descrição/categoria) e uma pontuação combinada (interesse × relevância) — `seoTrendsService.ts#computeSeoOpportunities`.
4. Só então chama a IA (heurística ou Ollama/Llama) para escrever a análise em português de cada oportunidade e um resumo estratégico, e para rascunhar um título/texto/segmentação de anúncio — a IA nunca inventa nem reordena os números acima, apenas explica e cria a copy (mesmo padrão usado no resto do app: números determinísticos, IA só narra).
5. O orçamento diário sugerido para o anúncio também é calculado por fórmula (10%-30% do preço líquido do produto, entre R$ 10 e R$ 300) — não por IA.

**Importante sobre a fonte de dados de tendências**: não existe uma API pública oficial do Google Trends com self-service gratuito (a Google anunciou uma API oficial em 2025, mas segue em alpha fechada por convite). Existem, porém, dois caminhos **sem custo**, e o app usa o primeiro por padrão:

1. **`GoogleTrendsDirectProvider` (padrão, sem chave, sem cadastro, sem custo)** — bate direto nos próprios endpoints JSON que o site trends.google.com usa para desenhar os gráficos dele mesmo (`/trends/api/explore` + `/trends/api/widgetdata/*`), o mesmo protocolo que a biblioteca `pytrends` (arquivada em 2025) usava por baixo dos panos. Não é uma API oficial/documentada — o Google pode mudar ou limitar isso sem aviso, e é exatamente por isso que a lib pytrends parou de ser atualizada (o wrapper que ficou desatualizado, não o endpoint que sumiu). Por isso toda chamada tem fallback automático.
2. **`CuratedTrendsProvider` (fallback)** — dataset de referência curado à mão (`server/src/data/trendSignals.ts`) para termos de beleza/perfumaria, usado sempre que a opção 1 falhar (limite de requisições, mudança no formato da resposta, indisponibilidade) — sinalizado como `source: "curado"` no resultado, para deixar claro que não é dado ao vivo.

Se preferir uma alternativa **paga** e mais estável, crie uma conta em [serpapi.com](https://serpapi.com) e cole a chave no campo "Chave da SerpApi" da tela de **Configurações** (ou na variável `SERPAPI_KEY` do `.env`) — isso passa a usar `SerpApiTrendsProvider` no lugar do acesso direto gratuito, mas não é necessário para o app funcionar com dados reais. O campo `trendsProvider` no resultado sempre diz qual dos três (`google_trends`, `google_trends_serpapi` ou `curado`) realmente respondeu.

Não consegui validar uma chamada real ao `trends.google.com` a partir do sandbox onde desenvolvo isso (a rede daqui bloqueia esse domínio, o mesmo motivo pelo qual não pude testar a SerpApi antes) — o protocolo implementado é o mesmo, estável há anos, que o pytrends usava; vale confirmar que funciona no seu ambiente com acesso normal à internet.

**Importante sobre os anúncios pagos**: nenhuma plataforma de anúncios de marketplace está integrada (sem OAuth, sem criação de campanha, sem gasto automático). O resultado é só um rascunho de copy + orçamento de referência para você colar manualmente no gerenciador de anúncios de cada marketplace.

### Recomendação por região (busca x propensão de compra)

O painel também quebra a palavra-chave de maior oportunidade por macro-região do Brasil (Norte, Nordeste, Centro-Oeste, Sudeste, Sul), respondendo diretamente à pergunta "essa região tem tendência de alta busca ou alta compra pelo produto?":

- **Interesse de busca por região**: dado real do Google Trends por padrão (acesso direto e gratuito, ou via SerpApi se você configurou a chave paga) — "interest by region", agregado por estado brasileiro em macro-região (`server/src/data/regionalReference.ts#STATE_TO_REGION`). Só cai para uma variação estimada e claramente sinalizada (`source: "curado (sem repartição real por região)"`) se ambas as fontes reais falharem.
- **Propensão de compra**: aqui é onde a promessa de dado real tem um limite honesto — **não existe nenhuma API, paga ou gratuita, que informe volume de compra real por região para um produto arbitrário**. O que o app calcula é uma estimativa (`seoTrendsService.computePurchasePropensity`) combinando o interesse de busca (real ou curado) com um índice de referência de infraestrutura de e-commerce/logística por região (`REGION_ECOMMERCE_WEIGHT`, curado a partir de dados públicos amplamente divulgados de concentração do faturamento de e-commerce no Sudeste). O resultado deixa isso explícito em toda parte (label "estimada" na UI, disclaimer no rodapé do painel, e no texto que a própria IA escreve).
- A partir dos dois números (busca real + compra estimada), um veredito determinístico classifica cada região como **priorizar** (ambos altos), **monitorar** (só um dos dois é alto — é exatamente aqui que aparece "busca alta mas compra baixa" ou o contrário) ou **baixa prioridade** (ambos baixos). A IA só entra depois, para explicar a divergência em português e recomendar onde focar — nunca para mudar os números.

## Arquitetura (DDD e por que só nos módulos novos)

Os módulos adicionados nesta rodada (estoque, fornecedores confiáveis, agentes) seguem DDD de propósito: **domínio** (entidade com invariantes, sem dependência de framework) → **aplicação** (casos de uso que orquestram a entidade + repositório) → **infraestrutura** (tradução para o armazenamento JSON) → **rotas** (adaptador HTTP fino). `InventoryItem` é o exemplo mais claro disso.

Isso **não foi aplicado retroativamente** ao resto do código (produtos, marketplaces, precificação, SEO, pedidos) — reescrever tudo isso em DDD "puro" agora seria um projeto à parte, com risco real de quebrar o que já funciona, sem necessidade imediata (esses módulos já são bem separados em camadas rotas → serviços → dados, só não isolam a entidade de domínio da persistência da mesma forma). Se fizer sentido continuar a migração depois, o padrão a seguir é o de `inventory/`: extrair a entidade com suas regras para `domain/`, o acesso a dados para um repositório dedicado, e deixar o `service` atual como a camada de aplicação por cima disso.

## Otimização automática (SEO sempre em evolução)

Um job (`server/src/services/schedulerService.ts`, via `node-cron`) roda periodicamente (configurável em **Configurações**) e, para cada anúncio conectado cujo "cooldown" já passou, gera uma nova variação de título/descrição/palavras-chave via IA e a publica no adapter do marketplace, registrando tudo no histórico do produto. Isso simula a manutenção contínua de SEO para não deixar o anúncio "estagnar" no ranking.

Também é possível disparar manualmente:
- **"Otimizar agora"** em uma conexão específica (tela do produto).
- **"Rodar otimização agora"** no Dashboard, que roda o ciclo completo imediatamente.

## Principais endpoints da API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET/POST | `/api/products` | listar/criar produtos |
| GET/PUT/DELETE | `/api/products/:id` | detalhe/editar/remover |
| GET/POST | `/api/products/:id/recommendation` | ver/recalcular recomendação de marketplace |
| GET/POST | `/api/products/:id/connections` | listar/conectar marketplaces |
| POST | `/api/connections/:id/optimize` | forçar reotimização de SEO |
| GET | `/api/connections/:id/history` | histórico de otimizações |
| DELETE | `/api/connections/:id` | desconectar |
| GET | `/api/marketplaces` | catálogo de marketplaces suportados |
| GET/PUT | `/api/settings` | configurações de IA e agendamento |
| POST | `/api/scheduler/run-now` | rodar o ciclo de otimização imediatamente |
| GET | `/api/connections/:id/orders` | pedidos de uma conexão |
| POST | `/api/connections/:id/orders/simulate` | simular uma venda agora |
| GET | `/api/products/:id/financial-summary` | resumo financeiro do produto |
| GET | `/api/financial-summary` | resumo financeiro global |
| GET | `/api/sourcing/fx-methods` | métodos de câmbio de referência |
| POST | `/api/sourcing/research` | pesquisar fornecedores por nicho/consulta |
| POST | `/api/sourcing/dropship-estimate` | estimar custo total de uma compra dropship pontual |
| PUT | `/api/orders/:id/tracking` | salvar transportadora/código de rastreio de um pedido |
| PUT | `/api/orders/:id/dropship-purchase` | registrar custo/imposto pago e calcular lucro de um pedido dropship |
| GET/POST/DELETE | `/api/trusted-suppliers` | listar/salvar/remover fornecedores da sua lista de confiança |
| POST | `/api/agents/onboard` | rodar a esteira multiagente (confiança + plano de estoque) para uma opção de fornecedor |
| GET | `/api/inventory` | visão geral do estoque de todos os produtos em modo "stock" |
| GET | `/api/products/:id/inventory` | saldo de estoque de um produto |
| GET | `/api/products/:id/inventory/movements` | histórico de movimentações de estoque |
| POST | `/api/products/:id/inventory/purchase` | registrar entrada de estoque (compra) |
| POST | `/api/products/:id/inventory/adjust` | ajustar estoque manualmente (contagem física) |
| PUT | `/api/products/:id/inventory/reorder-point` | definir o ponto de reposição |
| POST | `/api/trends/analyze` | rodar o agente de tendências/SEO/anúncios pagos para um produto |
| GET | `/api/command-center` | tudo da tela inicial do dono numa chamada (pendências, no ar, pausados, alertas, financeiro) |
| GET | `/api/approvals` | fila de decisões (aprovadas, recusadas e pendentes) |
| POST | `/api/approvals/refresh` | pedir à IA que monte agora novas sugestões de publicação |
| POST | `/api/approvals/:id/approve` | aprovar — só aqui a mudança chega ao marketplace |
| POST | `/api/approvals/:id/reject` | recusar — nada é alterado |
| POST | `/api/connections/:id/pause` | tirar o anúncio do ar temporariamente |
| POST | `/api/connections/:id/resume` | recolocar no ar um anúncio pausado |
