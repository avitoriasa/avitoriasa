import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  Marketplace,
  OptimizationLogEntry,
  Product,
  ProductMarketplaceConnection,
  RecommendationResult,
} from "../types/domain";

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

  async function load() {
    if (!id) return;
    const [p, m, c, rec] = await Promise.all([
      api.getProduct(id),
      api.listMarketplaces(),
      api.listConnections(id),
      api.getRecommendation(id),
    ]);
    setProduct(p);
    setMarketplaces(m);
    setConnections(c);
    setRecommendation(rec);
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
          {product.category} · SKU {product.sku} · R$ {product.price.toFixed(2)}
        </p>
      </div>

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
                  </li>
                );
              })}
          </ul>
        )}
      </section>
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
