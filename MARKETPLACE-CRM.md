# Marketplace CRM com IA

CRM para conectar seus produtos aos melhores marketplaces. O sistema:

1. **Recomenda o melhor marketplace** para cada produto, com um score e uma justificativa gerados por um modelo de IA (interface plugável para modelos open source via [Ollama](https://ollama.com), com um fallback heurístico que funciona sem nenhuma dependência externa).
2. **Conecta o produto** ao marketplace escolhido (adapters mockados para Mercado Livre, Shopee, Amazon Brasil, Magazine Luiza e Shein — prontos para receber credenciais reais), já calculando o preço de publicação a partir da taxa daquele marketplace.
3. **Reotimiza continuamente** título, descrição e palavras-chave (SEO) de cada anúncio conectado, em ciclos automáticos, para evitar estagnação no ranking do marketplace.
4. **Acompanha o financeiro** de cada produto/marketplace: vendas, taxa cobrada e repasse esperado (hoje simulado, pronto para ligar às APIs reais de pedidos de cada marketplace).

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

## Precificação (preço + taxa do marketplace)

Cada produto tem um `basePrice`: o valor líquido que você quer receber por unidade vendida. Cada marketplace conectado tem sua própria `feePercent`. O preço realmente publicado no marketplace (`listingPrice`) é calculado por **precificação reversa** (`server/src/services/pricingService.ts`), para que, depois do marketplace descontar a taxa dele, sobre exatamente o `basePrice`:

```
listingPrice = basePrice / (1 - feePercent / 100)
```

Exemplo: produto com preço líquido de R$ 300 num marketplace com taxa de 14% é publicado por **R$ 348,84** (R$ 48,84 de taxa) — o vendedor recebe R$ 300,00 líquidos.

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
