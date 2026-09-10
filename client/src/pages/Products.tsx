import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { FulfillmentMode, Product } from "../types/domain";

const emptyForm = {
  name: "",
  description: "",
  category: "",
  basePrice: "",
  costBasis: "",
  fulfillmentMode: "dropship" as FulfillmentMode,
  sku: "",
  keywords: "",
};

export interface ProductPrefill {
  name?: string;
  category?: string;
  costBasis?: number;
  fulfillmentMode?: FulfillmentMode;
  keywords?: string[];
  description?: string;
}

export function Products() {
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setProducts(await api.listProducts());
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const prefill = (location.state as { prefill?: ProductPrefill } | null)?.prefill;
    if (!prefill) return;
    setForm({
      ...emptyForm,
      name: prefill.name ?? "",
      category: prefill.category ?? "",
      description: prefill.description ?? "",
      costBasis: prefill.costBasis !== undefined ? String(prefill.costBasis) : "",
      fulfillmentMode: prefill.fulfillmentMode ?? "dropship",
      keywords: (prefill.keywords ?? []).join(", "),
    });
    setEditingId(null);
    setMode("create");
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  function openCreateForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMode(mode === "create" ? "closed" : "create");
  }

  function openEditForm(p: Product) {
    setForm({
      name: p.name,
      description: p.description,
      category: p.category,
      basePrice: String(p.basePrice),
      costBasis: p.costBasis !== undefined ? String(p.costBasis) : "",
      fulfillmentMode: p.fulfillmentMode,
      sku: p.sku,
      keywords: p.keywords.join(", "),
    });
    setEditingId(p.id);
    setMode("edit");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      basePrice: Number(form.basePrice),
      costBasis: form.costBasis.trim() === "" ? null : Number(form.costBasis),
      fulfillmentMode: form.fulfillmentMode,
      sku: form.sku,
      keywords: form.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    };
    try {
      if (mode === "edit" && editingId) {
        await api.updateProduct(editingId, payload);
      } else {
        await api.createProduct(payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      setMode("closed");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este produto e todas as conexões/históricos associados?")) return;
    await api.deleteProduct(id);
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Produtos</h2>
          <p className="text-slate-500 text-sm mt-1">
            Cadastre um produto para receber a recomendação de melhor marketplace e ativar a otimização de SEO.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          {mode === "create" ? "Cancelar" : "Novo produto"}
        </button>
      </div>

      {mode !== "closed" && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-5 grid grid-cols-2 gap-4">
          <h3 className="col-span-2 font-medium text-slate-900 -mb-2">
            {mode === "edit" ? "Editar produto" : "Novo produto"}
          </h3>
          <Field label="Nome" required>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Categoria" required>
            <input
              className="input"
              placeholder="ex: eletrônicos, moda, casa, esporte, beleza"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
            />
          </Field>
          <Field label="Preço líquido desejado (R$)" required>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.basePrice}
              onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
              placeholder="quanto você quer receber por unidade, já sem a taxa"
              required
            />
            {mode === "edit" && (
              <span className="text-xs text-slate-400">
                Ao salvar, o preço publicado em cada marketplace conectado é recalculado automaticamente.
              </span>
            )}
          </Field>
          <Field label="Custo de aquisição (R$, opcional)">
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.costBasis}
              onChange={(e) => setForm({ ...form, costBasis: e.target.value })}
              placeholder="quanto você pagou por unidade (ver Fornecedores)"
            />
            {form.basePrice && form.costBasis && (
              <span className="text-xs text-slate-400">
                Margem estimada: R$ {(Number(form.basePrice) - Number(form.costBasis)).toFixed(2)} (
                {(((Number(form.basePrice) - Number(form.costBasis)) / Number(form.basePrice)) * 100).toFixed(0)}% sobre
                o líquido)
              </span>
            )}
          </Field>
          <Field label="Como você vai vender?" full>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={form.fulfillmentMode === "dropship"}
                  onChange={() => setForm({ ...form, fulfillmentMode: "dropship" })}
                />
                Dropshipping (compro por pedido, sem comprar primeiro)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={form.fulfillmentMode === "stock"}
                  onChange={() => setForm({ ...form, fulfillmentMode: "stock" })}
                />
                Estoque (compro no atacado antes e guardo — ativa o controle de estoque)
              </label>
            </div>
          </Field>
          <Field label="SKU" required>
            <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          </Field>
          <Field label="Palavras-chave (separadas por vírgula)" full>
            <input
              className="input"
              value={form.keywords}
              onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              placeholder="ex: tenis, corrida, esportivo"
            />
          </Field>
          <Field label="Descrição" full>
            <textarea
              className="input min-h-24"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
          <div className="col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Salvar produto"}
            </button>
            {mode === "edit" && (
              <button
                type="button"
                onClick={() => {
                  setMode("closed");
                  setEditingId(null);
                }}
                className="text-sm text-slate-500 hover:underline"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
        {products.length === 0 && <p className="p-5 text-sm text-slate-500">Nenhum produto cadastrado ainda.</p>}
        {products.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between">
            <div>
              <Link to={`/products/${p.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                {p.name}
              </Link>
              <p className="text-sm text-slate-500">
                <span
                  className={`inline-block text-xs px-2 py-0.5 rounded-full mr-1 ${
                    p.fulfillmentMode === "dropship" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {p.fulfillmentMode === "dropship" ? "Dropshipping" : "Estoque"}
                </span>
                {p.category} · SKU {p.sku} · líquido desejado R$ {p.basePrice.toFixed(2)}
                {p.costBasis !== undefined && (
                  <>
                    {" "}
                    · custo R$ {p.costBasis.toFixed(2)} · margem R${" "}
                    {(p.basePrice - p.costBasis).toFixed(2)} (
                    {(((p.basePrice - p.costBasis) / p.basePrice) * 100).toFixed(0)}%)
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link to={`/products/${p.id}`} className="text-sm text-indigo-600 hover:underline">
                Ver detalhes
              </Link>
              <button onClick={() => openEditForm(p)} className="text-sm text-slate-600 hover:underline">
                Editar
              </button>
              <button onClick={() => handleDelete(p.id)} className="text-sm text-red-600 hover:underline">
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  full,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm text-slate-700 ${full ? "col-span-2" : ""}`}>
      <span>
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
