import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Product } from "../types/domain";

const emptyForm = { name: "", description: "", category: "", price: "", sku: "", keywords: "" };

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setProducts(await api.listProducts());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createProduct({
        name: form.name,
        description: form.description,
        category: form.category,
        price: Number(form.price),
        sku: form.sku,
        keywords: form.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      });
      setForm(emptyForm);
      setShowForm(false);
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
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          {showForm ? "Cancelar" : "Novo produto"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-5 grid grid-cols-2 gap-4">
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
          <Field label="Preço (R$)" required>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />
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
          <div className="col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar produto"}
            </button>
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
                {p.category} · SKU {p.sku} · R$ {p.price.toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link to={`/products/${p.id}`} className="text-sm text-indigo-600 hover:underline">
                Ver detalhes
              </Link>
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
