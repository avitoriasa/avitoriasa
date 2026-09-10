import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Marketplace, OptimizationLogEntry, Product } from "../types/domain";

type RecentLog = OptimizationLogEntry & { productName: string; marketplaceName: string };

export function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [recent, setRecent] = useState<RecentLog[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [p, m, r] = await Promise.all([api.listProducts(), api.listMarketplaces(), api.recentOptimizations()]);
    setProducts(p);
    setMarketplaces(m);
    setRecent(r);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRunNow() {
    setRunning(true);
    setMessage(null);
    try {
      await api.runSweepNow();
      setMessage("Ciclo de otimização executado. Atualizando atividades...");
      await load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Visão geral</h2>
          <p className="text-slate-500 text-sm mt-1">
            Acompanhe seus produtos, conexões com marketplaces e as otimizações automáticas de SEO.
          </p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={running}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {running ? "Rodando..." : "Rodar otimização agora"}
        </button>
      </div>

      {message && <div className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">{message}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Produtos cadastrados" value={products.length} />
        <StatCard label="Marketplaces disponíveis" value={marketplaces.length} />
        <StatCard label="Otimizações registradas" value={recent.length} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="font-medium text-slate-900 mb-3">Atividade recente de otimização por IA</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma otimização ainda. Conecte um produto a um marketplace para a IA começar a ajustar título,
            descrição e SEO automaticamente.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {recent.map((log) => (
              <li key={log.id} className="py-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="font-medium text-slate-800">
                    {log.productName} <span className="text-slate-400">→</span> {log.marketplaceName}
                  </span>
                  <span className="text-slate-400 text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="text-slate-500 mt-1">{log.reason}</p>
                <p className="text-slate-700 mt-1">
                  Novo título: <span className="italic">"{log.newTitle}"</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-slate-900">Produtos</h3>
          <Link to="/products" className="text-sm text-indigo-600 hover:underline">
            Ver todos →
          </Link>
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-slate-500">Você ainda não cadastrou nenhum produto.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {products.slice(0, 5).map((p) => (
              <li key={p.id} className="py-2 text-sm flex justify-between">
                <Link to={`/products/${p.id}`} className="text-slate-800 hover:text-indigo-600">
                  {p.name}
                </Link>
                <span className="text-slate-400">{p.category}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-3xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
