import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  FinancialSummary,
  Marketplace,
  Order,
  OptimizationLogEntry,
  Product,
  ProductMarketplaceConnection,
  RecommendationResult,
} from "../types/domain";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [connections, setConnections] = useState<ProductMarketplaceConnection[]>([]);
  const [recommendation, setRecommendation] = useState<RecommendationResult | undefined>(undefined);
  const [busyMarketplaceId, setBusyMarketplaceId] = useState<string | null>(null);
  const [refreshingRec, setRefreshingRec] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, OptimizationLogEntry[]>>({});
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, Order[]>>({});
  const [simulatingOrderFor, setSimulatingOrderFor] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    const [p, m, c, rec, summary] = await Promise.all([
      api.getProduct(id),
      api.listMarketplaces(),
      api.listConnections(id),
      api.getRecommendation(id),
      api.getProductFinancialSummary(id),
    ]);
    setProduct(p);
    setMarketplaces(m);
    setConnections(c);
    setRecommendation(rec);
    setFinancialSummary(summary);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleRefreshRecommendation() {
    if (!id) return;
    setRefreshingRec(true);
    try {
      setRecommendation(await api.refreshRecommendation(id));
    } finally {
      setRefreshingRec(false);
    }
  }

  async function handleConnect(marketplaceId: string) {
    if (!id) return;
    setBusyMarketplaceId(marketplaceId);
    try {
      await api.connectMarketplace(id, marketplaceId);
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyMarketplaceId(null);
    }
  }

  async function handleDisconnect(connectionId: string) {
    setBusyMarketplaceId(connectionId);
    try {
      await api.disconnectMarketplace(connectionId);
      await load();
    } finally {
      setBusyMarketplaceId(null);
    }
  }

  async function handleOptimizeNow(connectionId: string) {
    setBusyMarketplaceId(connectionId);
    try {
      await api.optimizeConnection(connectionId);
      await load();
      if (expandedHistory === connectionId) await loadHistory(connectionId);
    } finally {
      setBusyMarketplaceId(null);
    }
  }

  async function loadHistory(connectionId: string) {
    const h = await api.getHistory(connectionId);
    setHistory((prev) => ({ ...prev, [connectionId]: h }));
  }

  async function toggleHistory(connectionId: string) {
    if (expandedHistory === connectionId) {
      setExpandedHistory(null);
      return;
    }
    setExpandedHistory(connectionId);
    if (!history[connectionId]) await loadHistory(connectionId);
  }

  async function loadOrders(connectionId: string) {
    const o = await api.getConnectionOrders(connectionId);
    setOrders((prev) => ({ ...prev, [connectionId]: o }));
  }

  async function toggleOrders(connectionId: string) {
    if (expandedOrders === connectionId) {
      setExpandedOrders(null);
      return;
    }
    setExpandedOrders(connectionId);
    if (!orders[connectionId]) await loadOrders(connectionId);
  }

  async function handleSimulateOrder(connectionId: string) {
    setSimulatingOrderFor(connectionId);
    try {
      const created = await api.simulateOrder(connectionId);
      if (created.length === 0) {
        alert("Nenhuma venda simulada dessa vez (tente novamente — é probabilístico).");
      }
      if (id) setFinancialSummary(await api.getProductFinancialSummary(id));
      if (expandedOrders === connectionId) await loadOrders(connectionId);
    } finally {
      setSimulatingOrderFor(null);
    }
  }

  if (!product) return <p className="text-slate-500 text-sm">Carregando...</p>;

  const connectedMarketplaceIds = new Set(connections.filter((c) => c.status === "connected").map((c) => c.marketplaceId));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/products" className="text-sm text-indigo-600 hover:underline">
          ← Voltar para produtos
        </Link>
        <h2 className="text-2xl font-semibold text-slate-900 mt-2">{product.name}</h2>
        <p className="text-slate-500 text-sm mt-1">
          {product.category} · SKU {product.sku} · líquido desejado {formatBRL(product.basePrice)}
        </p>
      </div>

      {financialSummary && financialSummary.orderCount > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FinancialStat label="Vendas" value={String(financialSummary.orderCount)} />
          <FinancialStat label="Bruto vendido" value={formatBRL(financialSummary.grossTotal)} />
          <FinancialStat label="A receber (pendente)" value={formatBRL(financialSummary.pendingPayout)} />
          <FinancialStat label="Já repassado" value={formatBRL(financialSummary.paidOut)} />
        </section>
      )}

      <section className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-slate-900">Recomendação de melhor marketplace (IA)</h3>
          <button
            onClick={handleRefreshRecommendation}
            disabled={refreshingRec}
            className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
          >
            {refreshingRec ? "Recalculando..." : "Recalcular"}
          </button>
        </div>
        {!recommendation ? (
          <p className="text-sm text-slate-500">Nenhuma recomendação gerada ainda.</p>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Gerado em {new Date(recommendation.generatedAt).toLocaleString("pt-BR")} · modelo:{" "}
              <span className="font-mono">{recommendation.aiProvider}</span>
            </p>
            <ul className="flex flex-col gap-3">
              {recommendation.ranking.map((entry, idx) => (
                <li key={entry.marketplaceId} className={`rounded-md border p-3 ${idx === 0 ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 flex items-center gap-2">
                      {idx === 0 && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">Melhor opção</span>}
                      {entry.marketplaceName}
                    </span>
                    <div className="flex items-center gap-3">
                      <ScoreBar score={entry.score} />
                      {connectedMarketplaceIds.has(entry.marketplaceId) ? (
                        <span className="text-xs text-emerald-600 font-medium">Conectado</span>
                      ) : (
                        <button
                          onClick={() => handleConnect(entry.marketplaceId)}
                          disabled={busyMarketplaceId === entry.marketplaceId}
                          className="text-xs px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {busyMarketplaceId === entry.marketplaceId ? "Conectando..." : "Conectar"}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{entry.reasoning}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Publicar por <span className="font-medium text-slate-700">{formatBRL(entry.pricing.listingPrice)}</span> para
                    você receber {formatBRL(entry.pricing.basePrice)} líquidos (taxa de {entry.pricing.feePercent}% ={" "}
                    {formatBRL(entry.pricing.feeAmount)}).
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="font-medium text-slate-900 mb-3">Marketplaces conectados</h3>
        {connections.filter((c) => c.status === "connected").length === 0 ? (
          <p className="text-sm text-slate-500">
            Conecte o produto a um marketplace recomendado acima para a IA começar a otimizar título, descrição e
            palavras-chave automaticamente.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {connections
              .filter((c) => c.status === "connected")
              .map((conn) => {
                const marketplace = marketplaces.find((m) => m.id === conn.marketplaceId);
                return (
                  <li key={conn.id} className="border border-slate-200 rounded-md p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">{marketplace?.name ?? conn.marketplaceId}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <button
                          onClick={() => handleOptimizeNow(conn.id)}
                          disabled={busyMarketplaceId === conn.id}
                          className="text-indigo-600 hover:underline disabled:opacity-50"
                        >
                          {busyMarketplaceId === conn.id ? "Otimizando..." : "Otimizar agora"}
                        </button>
                        <button onClick={() => toggleHistory(conn.id)} className="text-slate-500 hover:underline">
                          {expandedHistory === conn.id ? "Ocultar histórico" : "Ver histórico"}
                        </button>
                        <button onClick={() => toggleOrders(conn.id)} className="text-slate-500 hover:underline">
                          {expandedOrders === conn.id ? "Ocultar pedidos" : "Ver pedidos"}
                        </button>
                        <button
                          onClick={() => handleDisconnect(conn.id)}
                          disabled={busyMarketplaceId === conn.id}
                          className="text-red-600 hover:underline disabled:opacity-50"
                        >
                          Desconectar
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-800 mt-2 font-medium">{conn.currentTitle}</p>
                    <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{conn.currentDescription}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {conn.currentKeywords.map((k) => (
                        <span key={k} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {k}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
                      <span>
                        Preço publicado: <span className="font-medium text-slate-800">{formatBRL(conn.pricing.listingPrice)}</span>
                      </span>
                      <span>
                        Taxa do marketplace ({conn.pricing.feePercent}%): {formatBRL(conn.pricing.feeAmount)}
                      </span>
                      <span>
                        Você recebe: <span className="font-medium text-slate-800">{formatBRL(conn.pricing.basePrice)}</span> por
                        venda
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-2">
                      Última otimização:{" "}
                      {conn.lastOptimizedAt ? new Date(conn.lastOptimizedAt).toLocaleString("pt-BR") : "nunca"} · Score
                      de ranking simulado: {conn.rankScore}/100
                    </p>

                    {expandedHistory === conn.id && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        {(history[conn.id]?.length ?? 0) === 0 ? (
                          <p className="text-xs text-slate-400">Sem histórico ainda.</p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {history[conn.id].map((log) => (
                              <li key={log.id} className="text-xs text-slate-500">
                                <span className="text-slate-400">{new Date(log.createdAt).toLocaleString("pt-BR")}</span>{" "}
                                — {log.reason}
                                <br />
                                <span className="text-slate-600">Novo título: "{log.newTitle}"</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {expandedOrders === conn.id && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-slate-500">
                            Pedidos são simulados a cada ciclo de otimização (0-2 por conexão). Use o botão para
                            simular uma venda agora, sem esperar o ciclo automático.
                          </p>
                          <button
                            onClick={() => handleSimulateOrder(conn.id)}
                            disabled={simulatingOrderFor === conn.id}
                            className="shrink-0 text-xs px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {simulatingOrderFor === conn.id ? "Simulando..." : "Simular venda"}
                          </button>
                        </div>
                        {(orders[conn.id]?.length ?? 0) === 0 ? (
                          <p className="text-xs text-slate-400">Nenhum pedido ainda.</p>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {orders[conn.id].map((order) => (
                              <li key={order.id} className="text-xs text-slate-500 flex justify-between gap-3">
                                <span>
                                  <span className="text-slate-400">{new Date(order.soldAt).toLocaleString("pt-BR")}</span>{" "}
                                  — bruto {formatBRL(order.grossAmount)}, taxa {formatBRL(order.feeAmount)}, líquido{" "}
                                  <span className="text-slate-700 font-medium">{formatBRL(order.netAmount)}</span>
                                </span>
                                <span
                                  className={
                                    order.status === "paid_out"
                                      ? "text-emerald-600 font-medium whitespace-nowrap"
                                      : "text-amber-600 font-medium whitespace-nowrap"
                                  }
                                >
                                  {order.status === "paid_out" ? "repassado" : "aguardando repasse"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}

function FinancialStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-indigo-600" style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{score.toFixed(0)}</span>
    </div>
  );
}
