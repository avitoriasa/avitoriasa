import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  FinancialSummary,
  InventorySummary,
  Marketplace,
  Order,
  OptimizationLogEntry,
  Product,
  ProductMarketplaceConnection,
  RecommendationResult,
  StockMovement,
  TrendsAnalysisResult,
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

  async function handlePauseOrResume(connectionId: string, paused: boolean) {
    setBusyMarketplaceId(connectionId);
    try {
      if (paused) {
        await api.resumeListing(connectionId);
      } else {
        await api.pauseListing(connectionId);
      }
      await load();
    } catch (err) {
      alert((err as Error).message);
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
        <h2 className="text-2xl font-semibold text-slate-900 mt-2 flex items-center gap-2">
          {product.name}
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              product.fulfillmentMode === "dropship" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {product.fulfillmentMode === "dropship" ? "Dropshipping" : "Estoque"}
          </span>
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          {product.category} · SKU {product.sku} · líquido desejado {formatBRL(product.basePrice)}
          {product.costBasis !== undefined && (
            <>
              {" "}
              · custo de aquisição {formatBRL(product.costBasis)} · margem{" "}
              <span className="font-medium text-slate-700">
                {formatBRL(product.basePrice - product.costBasis)} (
                {(((product.basePrice - product.costBasis) / product.basePrice) * 100).toFixed(0)}%)
              </span>
            </>
          )}
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

      {product.fulfillmentMode === "stock" && <InventoryPanel productId={product.id} />}

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
                    você receber {formatBRL(entry.pricing.basePrice)} líquidos (taxa de {entry.pricing.feePercent}%
                    {entry.pricing.fixedFeeBrl > 0 ? ` + ${formatBRL(entry.pricing.fixedFeeBrl)} fixos` : ""} ={" "}
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
        {connections.filter((c) => c.status === "connected" || c.status === "paused").length === 0 ? (
          <p className="text-sm text-slate-500">
            Conecte o produto a um marketplace recomendado acima para a IA começar a otimizar título, descrição e
            palavras-chave automaticamente.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {connections
              .filter((c) => c.status === "connected" || c.status === "paused")
              .map((conn) => {
                const marketplace = marketplaces.find((m) => m.id === conn.marketplaceId);
                const paused = conn.status === "paused";
                return (
                  <li key={conn.id} className={`border rounded-md p-4 ${paused ? "border-amber-300 bg-amber-50/40" : "border-slate-200"}`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="font-medium text-slate-900 flex items-center gap-2">
                        {marketplace?.name ?? conn.marketplaceId}
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            paused ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {paused ? "Pausado" : "No ar"}
                        </span>
                      </span>
                      <div className="flex items-center gap-3 text-sm">
                        <button
                          onClick={() => handlePauseOrResume(conn.id, paused)}
                          disabled={busyMarketplaceId === conn.id}
                          className="text-amber-700 hover:underline disabled:opacity-50"
                        >
                          {busyMarketplaceId === conn.id ? "..." : paused ? "Voltar ao ar" : "Pausar"}
                        </button>
                        <button
                          onClick={() => handleOptimizeNow(conn.id)}
                          disabled={busyMarketplaceId === conn.id || paused}
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
                        Taxa do marketplace ({conn.pricing.feePercent}%
                        {conn.pricing.fixedFeeBrl > 0 ? ` + ${formatBRL(conn.pricing.fixedFeeBrl)} fixos` : ""}):{" "}
                        {formatBRL(conn.pricing.feeAmount)}
                      </span>
                      <span>
                        Você recebe: <span className="font-medium text-slate-800">{formatBRL(conn.pricing.basePrice)}</span> por
                        venda
                      </span>
                      {product.costBasis !== undefined && (
                        <span>
                          Margem sobre o custo:{" "}
                          <span className="font-medium text-slate-800">
                            {formatBRL(conn.pricing.basePrice - product.costBasis)} (
                            {(((conn.pricing.basePrice - product.costBasis) / conn.pricing.basePrice) * 100).toFixed(0)}%)
                          </span>
                        </span>
                      )}
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
                          <ul className="flex flex-col gap-3">
                            {orders[conn.id].map((order) => (
                              <OrderRow
                                key={order.id}
                                order={order}
                                onUpdated={(updated) =>
                                  setOrders((prev) => ({
                                    ...prev,
                                    [conn.id]: prev[conn.id].map((o) => (o.id === updated.id ? updated : o)),
                                  }))
                                }
                              />
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

      <TrendsPanel productId={product.id} connections={connections} marketplaces={marketplaces} />
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

const CARRIERS = ["USPS", "Correios", "DHL", "FedEx", "Outro"];

function OrderRow({ order, onUpdated }: { order: Order; onUpdated: (order: Order) => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const [carrier, setCarrier] = useState(order.trackingCarrier ?? CARRIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "");
  const [sourceCost, setSourceCost] = useState(order.sourcePurchaseCostBrl?.toString() ?? "");
  const [sourceTax, setSourceTax] = useState(order.sourceTaxEstimateBrl?.toString() ?? "");
  const [saving, setSaving] = useState<"tracking" | "purchase" | null>(null);

  async function saveTracking() {
    if (!trackingNumber.trim()) return;
    setSaving("tracking");
    try {
      onUpdated(await api.updateOrderTracking(order.id, carrier, trackingNumber.trim()));
    } finally {
      setSaving(null);
    }
  }

  async function savePurchase() {
    if (sourceCost.trim() === "") return;
    setSaving("purchase");
    try {
      onUpdated(await api.recordDropshipPurchase(order.id, Number(sourceCost), Number(sourceTax) || 0));
    } finally {
      setSaving(null);
    }
  }

  return (
    <li className="text-xs text-slate-500 border-b border-slate-100 last:border-0 pb-2">
      <div className="flex justify-between gap-3">
        <span>
          <span className="text-slate-400">{new Date(order.soldAt).toLocaleString("pt-BR")}</span> — bruto{" "}
          {formatBRL(order.grossAmount)}, taxa {formatBRL(order.feeAmount)}, líquido{" "}
          <span className="text-slate-700 font-medium">{formatBRL(order.netAmount)}</span>
          {order.fulfillmentMode === "dropship" && (
            <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">dropshipping</span>
          )}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={order.status === "paid_out" ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
            {order.status === "paid_out" ? "repassado" : "aguardando repasse"}
          </span>
          <button onClick={() => setShowDetails((v) => !v)} className="text-indigo-600 hover:underline">
            {showDetails ? "ocultar" : order.fulfillmentMode === "dropship" ? "compra/rastreio" : "rastreio"}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-2 bg-slate-50 border border-slate-200 rounded-md p-2 flex flex-col gap-2">
          {order.fulfillmentMode === "dropship" && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-0.5">
                <span>Custo pago na fonte (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  className="input !text-xs !py-1 w-28"
                  value={sourceCost}
                  onChange={(e) => setSourceCost(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Imposto estimado (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  className="input !text-xs !py-1 w-28"
                  value={sourceTax}
                  onChange={(e) => setSourceTax(e.target.value)}
                />
              </label>
              <button
                onClick={savePurchase}
                disabled={saving === "purchase"}
                className="px-2 py-1 rounded-md bg-emerald-600 text-white disabled:opacity-50"
              >
                {saving === "purchase" ? "Salvando..." : "Salvar compra"}
              </button>
              {order.dropshipProfitBrl !== undefined && (
                <span className="font-medium text-slate-700">Lucro: {formatBRL(order.dropshipProfitBrl)}</span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5">
              <span>Transportadora</span>
              <select className="input !text-xs !py-1 w-28" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span>Código de rastreio</span>
              <input
                className="input !text-xs !py-1 w-40"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </label>
            <button
              onClick={saveTracking}
              disabled={saving === "tracking"}
              className="px-2 py-1 rounded-md bg-indigo-600 text-white disabled:opacity-50"
            >
              {saving === "tracking" ? "Salvando..." : "Salvar rastreio"}
            </button>
            {order.trackingUrl && (
              <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                Rastrear pacote →
              </a>
            )}
          </div>
        </div>
      )}
    </li>
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

function InventoryPanel({ productId }: { productId: string }) {
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [showMovements, setShowMovements] = useState(false);

  const [purchaseQty, setPurchaseQty] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [busy, setBusy] = useState<"purchase" | "adjust" | "reorder" | null>(null);

  async function load() {
    const s = await api.getProductInventory(productId);
    setSummary(s);
    setReorderPoint(String(s.reorderPoint));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function loadMovements() {
    setMovements(await api.getInventoryMovements(productId));
  }

  async function toggleMovements() {
    setShowMovements((v) => !v);
    if (!movements) await loadMovements();
  }

  async function handlePurchase() {
    if (!purchaseQty || !purchaseCost) return;
    setBusy("purchase");
    try {
      await api.recordStockPurchase(productId, Number(purchaseQty), Number(purchaseCost), purchaseNote || undefined);
      setPurchaseQty("");
      setPurchaseCost("");
      setPurchaseNote("");
      await load();
      if (showMovements) await loadMovements();
    } finally {
      setBusy(null);
    }
  }

  async function handleAdjust() {
    if (adjustQty.trim() === "") return;
    setBusy("adjust");
    try {
      await api.adjustStock(productId, Number(adjustQty), adjustReason || "Ajuste manual");
      setAdjustQty("");
      setAdjustReason("");
      await load();
      if (showMovements) await loadMovements();
    } finally {
      setBusy(null);
    }
  }

  async function handleReorderPoint() {
    setBusy("reorder");
    try {
      await api.setReorderPoint(productId, Number(reorderPoint) || 0);
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!summary) return null;

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-slate-900">Estoque</h3>
        <button onClick={toggleMovements} className="text-sm text-indigo-600 hover:underline">
          {showMovements ? "Ocultar movimentações" : "Ver movimentações"}
        </button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-slate-500">Em estoque</p>
          <p className="text-2xl font-semibold text-slate-900">{summary.quantityOnHand}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Custo médio</p>
          <p className="text-lg font-medium text-slate-700">{formatBRL(summary.averageUnitCostBrl)}</p>
        </div>
        {summary.isLowStock && (
          <span className="self-center text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
            Estoque baixo (ponto de reposição: {summary.reorderPoint})
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-4">
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
          <p className="text-xs font-medium text-slate-700 mb-2">Registrar compra (entrada)</p>
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <label className="flex flex-col gap-0.5">
              <span>Quantidade</span>
              <input
                type="number"
                className="input !text-xs !py-1 w-24"
                value={purchaseQty}
                onChange={(e) => setPurchaseQty(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span>Custo/un. (R$)</span>
              <input
                type="number"
                step="0.01"
                className="input !text-xs !py-1 w-24"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-0.5 flex-1 min-w-[100px]">
              <span>Nota (opcional)</span>
              <input
                className="input !text-xs !py-1"
                value={purchaseNote}
                onChange={(e) => setPurchaseNote(e.target.value)}
              />
            </label>
            <button
              onClick={handlePurchase}
              disabled={busy === "purchase"}
              className="px-3 py-1.5 rounded-md bg-emerald-600 text-white disabled:opacity-50"
            >
              {busy === "purchase" ? "Salvando..." : "Registrar"}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            O custo médio ponderado e o custo do produto são atualizados automaticamente.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
          <p className="text-xs font-medium text-slate-700 mb-2">Ajustar estoque (contagem manual)</p>
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <label className="flex flex-col gap-0.5">
              <span>Nova quantidade</span>
              <input
                type="number"
                className="input !text-xs !py-1 w-24"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-0.5 flex-1 min-w-[100px]">
              <span>Motivo</span>
              <input
                className="input !text-xs !py-1"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="ex: contagem física, avaria"
              />
            </label>
            <button
              onClick={handleAdjust}
              disabled={busy === "adjust"}
              className="px-3 py-1.5 rounded-md bg-slate-700 text-white disabled:opacity-50"
            >
              {busy === "adjust" ? "Salvando..." : "Ajustar"}
            </button>
          </div>

          <div className="flex items-end gap-2 text-xs mt-3">
            <label className="flex flex-col gap-0.5">
              <span>Ponto de reposição</span>
              <input
                type="number"
                className="input !text-xs !py-1 w-24"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
              />
            </label>
            <button
              onClick={handleReorderPoint}
              disabled={busy === "reorder"}
              className="px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              {busy === "reorder" ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>

      {showMovements && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          {(movements?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {movements!.map((m) => (
                <li key={m.id} className="text-xs text-slate-500 flex justify-between gap-3">
                  <span>
                    <span className="text-slate-400">{new Date(m.occurredAt).toLocaleString("pt-BR")}</span> —{" "}
                    {m.type === "purchase" ? "compra" : m.type === "sale" ? "venda" : "ajuste"}: {m.quantity > 0 ? "+" : ""}
                    {m.quantity} un.
                    {m.unitCostBrl !== undefined && ` a ${formatBRL(m.unitCostBrl)}/un.`}
                    {m.note && ` — ${m.note}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

const DIRECTION_LABEL: Record<string, string> = {
  subindo: "↑ em alta",
  caindo: "↓ em queda",
  estavel: "→ estável",
};

const DIRECTION_CLASS: Record<string, string> = {
  subindo: "bg-emerald-100 text-emerald-700",
  caindo: "bg-red-100 text-red-700",
  estavel: "bg-slate-100 text-slate-600",
};

const VERDICT_LABEL: Record<string, string> = {
  priorizar: "Priorizar",
  monitorar: "Monitorar",
  baixa_prioridade: "Baixa prioridade",
};

const VERDICT_CLASS: Record<string, string> = {
  priorizar: "bg-emerald-100 text-emerald-700",
  monitorar: "bg-amber-100 text-amber-700",
  baixa_prioridade: "bg-slate-100 text-slate-600",
};

function TrendsPanel({
  productId,
  connections,
  marketplaces,
}: {
  productId: string;
  connections: ProductMarketplaceConnection[];
  marketplaces: Marketplace[];
}) {
  const [result, setResult] = useState<TrendsAnalysisResult | null>(null);
  const [marketplaceId, setMarketplaceId] = useState("");
  const [loading, setLoading] = useState(false);

  const connectedMarketplaces = connections
    .filter((c) => c.status === "connected")
    .map((c) => marketplaces.find((m) => m.id === c.marketplaceId))
    .filter((m): m is Marketplace => Boolean(m));

  async function handleAnalyze() {
    setLoading(true);
    try {
      setResult(await api.analyzeTrends(productId, marketplaceId || undefined));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="font-medium text-slate-900">Tendências de busca &amp; SEO (IA)</h3>
        <div className="flex items-center gap-2">
          {connectedMarketplaces.length > 0 && (
            <select
              className="input !text-xs !py-1"
              value={marketplaceId}
              onChange={(e) => setMarketplaceId(e.target.value)}
            >
              <option value="">Todos os marketplaces conectados</option>
              {connectedMarketplaces.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Analisando..." : "Analisar tendências"}
          </button>
        </div>
      </div>

      {!result ? (
        <p className="text-sm text-slate-500">
          Roda um agente de IA sobre um painel de interesse de busca (Google Trends, Brasil) relacionado a este
          produto: sugere palavras-chave de SEO com maior potencial, uma recomendação de onde priorizar por região e
          um rascunho de anúncio pago, com orçamento de referência. Busca dados reais direto do Google Trends, sem
          custo — se o Google limitar a requisição, cai automaticamente para um dataset curado de referência.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-400">
            Gerado em {new Date(result.generatedAt).toLocaleString("pt-BR")} · fonte de tendências:{" "}
            <span className="font-mono">{result.trendsProvider}</span> · modelo:{" "}
            <span className="font-mono">{result.aiProvider}</span>
          </p>

          <p className="text-sm text-slate-700">{result.seoSummary}</p>

          <div>
            <p className="text-xs font-medium text-slate-700 mb-2">Oportunidades de palavra-chave</p>
            <ul className="flex flex-col gap-2">
              {result.opportunities.map((opp) => (
                <li key={opp.keyword} className="border border-slate-200 rounded-md p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900 flex items-center gap-2">
                      {opp.keyword}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${DIRECTION_CLASS[opp.direction]}`}>
                        {DIRECTION_LABEL[opp.direction]}
                      </span>
                    </span>
                    <ScoreBar score={opp.combinedScore} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Interesse de busca: {opp.interestScore}/100 · Relevância para o produto: {opp.relevanceScore}/100
                  </p>
                  {opp.risingQueries.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {opp.risingQueries.map((r) => (
                        <span key={r.query} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {r.query} (+{r.growthPercent}%)
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-slate-600 mt-2">{opp.reasoning}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <p className="text-xs font-medium text-slate-700">Rascunho de anúncio pago ({result.marketplaceName})</p>
              <span className="text-xs text-slate-500">
                Orçamento sugerido: {formatBRL(result.adBudget.dailyMinBrl)} - {formatBRL(result.adBudget.dailyMaxBrl)}/dia
              </span>
            </div>
            <p className="text-sm font-medium text-slate-900">{result.adCopy.headline}</p>
            <p className="text-sm text-slate-600 mt-1">{result.adCopy.primaryText}</p>
            <p className="text-xs text-slate-500 mt-2">{result.adCopy.targetingNotes}</p>
            <p className="text-xs text-slate-400 mt-2 italic">
              Rascunho estratégico apenas — nenhuma campanha é criada ou paga automaticamente. Copie e ajuste no
              gerenciador de anúncios de cada marketplace.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
              <p className="text-xs font-medium text-slate-700">
                Onde priorizar por região (palavra-chave: "{result.regionalKeyword}")
              </p>
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                {result.trendsProvider.startsWith("google_trends")
                  ? "interesse de busca real (Google Trends)"
                  : "interesse de busca estimado (dataset curado)"}
              </span>
            </div>
            <p className="text-sm text-slate-700 mb-3">{result.regionalSummary}</p>
            <ul className="flex flex-col gap-2">
              {result.regionalRecommendations.map((r) => (
                <li key={r.region} className="border border-slate-200 rounded-md p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="font-medium text-slate-900 flex items-center gap-2">
                      {r.regionLabel}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${VERDICT_CLASS[r.verdict]}`}>
                        {VERDICT_LABEL[r.verdict]}
                      </span>
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-36 shrink-0">Busca</span>
                        <ScoreBar score={r.interestScore} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="w-36 shrink-0">Propensão de compra (est.)</span>
                        <ScoreBar score={r.purchasePropensityScore} />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{r.reasoning}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 mt-2 italic">
              "Propensão de compra" é uma estimativa que combina o interesse de busca com um índice de referência de
              e-commerce/logística por região — não existe API de vendas reais por região para um produto
              específico. Use como direção, não como dado definitivo.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
