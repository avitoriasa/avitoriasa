# Marketplace CRM com IA

CRM para conectar seus produtos aos melhores marketplaces. O sistema:

1. **Recomenda o melhor marketplace** para cada produto, com um score e uma justificativa gerados por um modelo de IA (interface plugável para modelos open source via [Ollama](https://ollama.com), com um fallback heurístico que funciona sem nenhuma dependência externa).
2. **Conecta o produto** ao marketplace escolhido (adapters mockados para Mercado Livre, Shopee, Amazon Brasil, Magazine Luiza, Shein, TikTok Shop e YouTube Shopping — prontos para receber credenciais reais), já calculando o preço de publicação a partir da taxa daquele marketplace.
3. **Reotimiza continuamente** título, descrição e palavras-chave (SEO) de cada anúncio conectado, em ciclos automáticos, para evitar estagnação no ranking do marketplace.
4. **Acompanha o financeiro** de cada produto/marketplace: vendas, taxa cobrada e repasse esperado (hoje simulado, pronto para ligar às APIs reais de pedidos de cada marketplace).
5. **Pesquisa fornecedores de atacado automaticamente** (foco inicial: perfumes árabes e perfumes importados originais) via IA, ranqueando sempre pelo **menor custo total de importação** (produto + frete + impostos de referência) — não só o preço do produto no exterior —, com MOQ, prazo, margem estimada e uma calculadora de câmbio.
6. **Funciona nos dois modelos**: compre no atacado e mantenha estoque (fluxo acima), ou faça **dropshipping** — compre unidade a unidade só depois que a venda acontece, sem estoque — para os casos de ticket alto e giro baixo que realmente compensam (tipicamente grifes originais).

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

## Fornecedores (comprar no atacado para revender)

Tela **Fornecedores** (`client/src/pages/Sourcing.tsx`) para pesquisar canais de compra no atacado, hoje com foco em **perfumes árabes** e **perfumes importados originais**:

- `server/src/data/supplierLeads.ts` é uma lista curada de referência (marcas árabes de atacado direto como Lattafa, Ard Al Zaafaran, Rasasi, Swiss Arabian, Ajmal, Al Haramain, e linhas "inspired by" como Armaf/Paris Corner/Fragrance World, além de canais de importação paralela para grifes originais e plataformas B2B gerais como Alibaba/TradeKey) — **não é dado ao vivo/raspado**; os custos (incluindo frete de referência por unidade, `freightUsdPerUnit`) são faixas de referência para planejamento, sempre confirme preço/MOQ/autenticidade direto com o fornecedor antes de comprar.
- `server/src/services/sourcingService.ts` filtra esse catálogo pela busca (a busca roda automaticamente ao abrir a tela, com a query "perfumes" cobrindo todos os nichos por padrão), converte o custo e o frete para BRL usando `settings.usdToBrlRate`, aplica a alíquota de referência `settings.importTaxPercent` (II+IPI+PIS/COFINS+ICMS) para chegar no **custo total de importação por unidade** (`landedCostBrlMin/Max`), calcula a margem estimada sobre esse custo total se você informar um preço de venda pretendido, e pede à IA (`AIProvider.researchSuppliers`) apenas a análise em texto — os números vêm sempre do catálogo curado, a IA nunca inventa fornecedor ou preço.
- **A ordenação é sempre automática pelo menor custo total de importação** (não pelo menor preço de produto isoladamente) — é a opção marcada como "Menor custo total" na tela.
- Uma **calculadora de câmbio** de referência compara o custo total pagando o fornecedor por diferentes métodos (conta PJ internacional, remessa bancária, cartão corporativo, carta de crédito), usando spreads típicos (`server/src/data/fxMethods.ts`) — troque por cotações reais da sua fintech/banco quando for pagar de verdade.
- Um botão em cada opção ("Usar esta opção para criar produto") pré-preenche o formulário de novo produto com nome, categoria, custo de aquisição (o custo total de importação médio) e palavras-chave, fechando o ciclo: pesquisar fornecedor → cadastrar produto com custo → ver recomendação de marketplace e margem → conectar e vender.
- A tela também traz um checklist informativo (não é aconselhamento jurídico/tributário) sobre importação comercial de perfumes no Brasil: CNPJ + habilitação no Radar Siscomex, Autorização de Funcionamento (AFE) da Anvisa, classificação NCM 3303, e tributos sobre o valor aduaneiro (II, IPI, PIS/COFINS monofásico, ICMS) — bem diferente do regime simplificado de compras de pessoa física ("remessa conforme"), que não vale para importação comercial em volume.

Para extrapolar para outros nichos além de perfumes: adicione mais entradas a `supplierLeads.ts` (ou troque o módulo por uma integração real com uma API de sourcing B2B) — o resto do fluxo não muda.

## Estoque x Dropshipping

Cada produto tem um `fulfillmentMode`: `"stock"` (compra no atacado, guarda estoque, você mesmo despacha — o fluxo de Sourcing acima) ou `"dropship"` (sem estoque: cada pedido é comprado individualmente só depois que a venda acontece, e enviado direto ao cliente final).

- **Sugestão automática**: `sourcingService.ts` calcula um `suggestedFulfillment` ("estoque", "dropshipping" ou "ambos") por opção de fornecedor, a partir do MOQ e do nicho — MOQ baixo (≤25) + grife original tende a "dropshipping" (menos capital preso, evita comprar 12-24 unidades de um item caro e sensível a autenticidade); MOQ alto favorece "estoque". Ao clicar em "Usar esta opção para criar produto", o modo já vem pré-selecionado de acordo.
- **Regime tributário diferente**: import comercial em volume (estoque) usa o regime formal (CNPJ + Radar Siscomex + Anvisa + II/IPI/PIS-COFINS/ICMS sobre valor aduaneiro). Dropshipping — uma remessa por vez, endereçada direto ao cliente final — cai no regime simplificado de **remessa individual** (o mesmo do consumidor comum): II isento até US$ 50 via plataforma "Remessa Conforme", ICMS sempre incide. `server/src/services/dropshipService.ts` modela esse segundo regime (`estimateDropshipOrder`), separado do `importTaxPercent` usado para estoque — ver `settings.remessaIcmsPercent`, editável em Configurações.
- **Calculadora de dropshipping** (tela Fornecedores): você informa o preço de varejo (ver abaixo) e o frete estimado, marca se a compra foi feita por uma plataforma "Remessa Conforme", e o sistema estima o custo total dessa compra pontual (produto + frete + II + ICMS). É uma referência — confirme com um simulador como o [tributado.net](https://m.tributado.net) antes de fechar.
- **Achar o menor preço de varejo**: este app não tem integração automática com ferramentas de cupom/cashback — a [Honey](https://www.joinhoney.com) (extensão de navegador da PayPal) não expõe uma API pública para consulta programática de preços, então isso continua manual: você mesmo confere o menor preço com cupom antes de registrar a compra no pedido.
- **Rastreio de pedidos**: cada `Order` pode guardar `trackingCarrier`/`trackingNumber`. Para a transportadora `"USPS"`, o sistema já gera o link público de rastreio (`https://tools.usps.com/go/TrackConfirmAction?tLabels=<código>`, o mesmo formato do [rastreador oficial](https://tools.usps.com/tracking/)) — sem precisar de API key. Isso é só o link da página pública; consultar o status via API exige credenciais nas novas **USPS APIs** (o antigo Web Tools API foi desativado em 25/01/2026) — troque `ordersService.getTrackingUrl`/adicione um adapter de tracking quando for automatizar isso.
- **Lucro por pedido**: ao registrar o custo pago na fonte + imposto estimado de um pedido dropship (`PUT /api/orders/:id/dropship-purchase`), o sistema calcula `dropshipProfitBrl = líquido do marketplace − custo na fonte − imposto`, visível na tela do produto.

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
