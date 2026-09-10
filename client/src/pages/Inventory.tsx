import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { InventorySummary } from "../types/domain";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function Inventory() {
  const [items, setItems] = useState<InventorySummary[] | null>(null);

  useEffect(() => {
    api.listInventory().then(setItems);
  }, []);

  const lowStockCount = items?.filter((i) => i.isLowStock).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Estoque</h2>
        <p className="text-slate-500 text-sm mt-1">
          Controle de estoque dos produtos que você compra no atacado e guarda (modo "estoque"). Produtos em
          dropshipping não aparecem aqui — não há inventário para eles. Registre compras e ajustes na tela de cada
          produto.
        </p>
      </div>

      {items && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Produtos com estoque" value={String(items.length)} />
          <StatCard label="Unidades em mãos" value={String(items.reduce((sum, i) => sum + i.quantityOnHand, 0))} />
          <StatCard label="Com estoque baixo" value={String(lowStockCount)} highlight={lowStockCount > 0} />
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {items === null ? (
          <p className="p-5 text-sm text-slate-500">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            Nenhum produto em modo "estoque" ainda. Crie ou edite um produto e escolha "Estoque" em "Como você vai
            vender?", depois registre a primeira compra na tela do produto.
          </p>
        ) : (
          items.map((item) => (
            <div key={item.productId} className="p-4 flex items-center justify-between">
              <div>
                <Link to={`/products/${item.productId}`} className="font-medium text-slate-900 hover:text-indigo-600">
                  {item.productName}
                </Link>
                <p className="text-sm text-slate-500">
                  SKU {item.sku} · custo médio {formatBRL(item.averageUnitCostBrl)} · ponto de reposição{" "}
                  {item.reorderPoint}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {item.isLowStock && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Estoque baixo</span>
                )}
                <span className="text-lg font-semibold text-slate-900">{item.quantityOnHand}</span>
                <span className="text-xs text-slate-400">un.</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-5 ${highlight ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-semibold mt-1 ${highlight ? "text-red-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}
