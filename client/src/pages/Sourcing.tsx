import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { FxMethod, SourcingOption, SourcingResearchResult } from "../types/domain";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const QUICK_FILTERS = [
  { label: "Perfumes árabes", query: "perfumes árabes" },
  { label: "Perfumes importados originais", query: "perfumes importados originais" },
  { label: "Perfumaria em geral", query: "perfumes" },
];

const NICHE_LABEL: Record<string, string> = {
  perfumes_arabes: "Perfume árabe (marca própria)",
  perfumes_importados_originais: "Grife original (importação paralela)",
  geral_b2b: "Plataforma B2B geral",
};

export function Sourcing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("perfumes árabes");
  const [desiredResalePrice, setDesiredResalePrice] = useState("");
  const [result, setResult] = useState<SourcingResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fxMethods, setFxMethods] = useState<FxMethod[]>([]);
  const [fxUsdAmount, setFxUsdAmount] = useState("500");
  const [fxMethodId, setFxMethodId] = useState<string>("");

  useEffect(() => {
    api.listFxMethods().then((methods) => {
      setFxMethods(methods);
      if (methods.length) setFxMethodId(methods[0].id);
    });
  }, []);

  async function runSearch(q: string) {
    setQuery(q);
    setLoading(true);
    setError(null);
    try {
      const price = desiredResalePrice.trim() === "" ? undefined : Number(desiredResalePrice);
      setResult(await api.researchSuppliers(q, price));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUseOption(option: SourcingOption) {
    const avgCostBrl = (option.unitCostBrlMin + option.unitCostBrlMax) / 2;
    navigate("/products", {
      state: {
        prefill: {
          name: option.productExamples[0] ? `${option.name} — ${option.productExamples[0]}` : option.name,
          category: "perfumes",
          costBasis: Math.round(avgCostBrl * 100) / 100,
          keywords: [...option.productExamples, "perfume", "importado"],
          description: `Fornecedor: ${option.name} (${option.channel}, ${option.country}). ${option.riskNotes}`,
        },
      },
    });
  }

  const selectedFxMethod = fxMethods.find((m) => m.id === fxMethodId);
  const fxTotalBrl = useMemo(() => {
    if (!result || !selectedFxMethod) return null;
    const usd = Number(fxUsdAmount) || 0;
    const effectiveRate = result.usdToBrlRate * (1 + selectedFxMethod.typicalSpreadPercent / 100);
    return usd * effectiveRate;
  }, [result, selectedFxMethod, fxUsdAmount]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Fornecedores</h2>
        <p className="text-slate-500 text-sm mt-1">
          Pesquisa de canais de compra no atacado (foco em perfumes árabes e perfumes importados originais) para
          revender nos marketplaces conectados. Os dados de custo/MOQ são uma referência curada, não uma cotação ao
          vivo — sempre confirme preço, autenticidade e condições diretamente com o fornecedor.
        </p>
      </div>

      <section className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.query}
              onClick={() => runSearch(f.query)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                query === f.query
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-300 hover:border-indigo-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="flex flex-wrap gap-3 items-end"
        >
          <label className="flex flex-col gap-1 text-sm text-slate-700 flex-1 min-w-[220px]">
            <span>Buscar fornecedor / marca / produto</span>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700 w-52">
            <span>Preço de venda pretendido (R$, opcional)</span>
            <input
              type="number"
              step="0.01"
              className="input"
              value={desiredResalePrice}
              onChange={(e) => setDesiredResalePrice(e.target.value)}
              placeholder="para estimar margem"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Pesquisando..." : "Pesquisar"}
          </button>
        </form>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <>
          <section className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-xs text-indigo-600 mb-1">
              Análise gerada por IA · modelo: <span className="font-mono">{result.aiProvider}</span> · cotação usada:
              US$ 1 = {formatBRL(result.usdToBrlRate)}
            </p>
            <p className="text-sm text-indigo-900">{result.summary}</p>
          </section>

          <section className="grid gap-4">
            {result.options.map((option) => (
              <div key={option.leadId} className="bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {NICHE_LABEL[option.niche] ?? option.niche}
                    </span>
                    <h3 className="font-medium text-slate-900 mt-1">{option.name}</h3>
                    <p className="text-xs text-slate-500">
                      {option.channel} · {option.country}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUseOption(option)}
                    className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shrink-0"
                  >
                    Usar esta opção para criar produto
                  </button>
                </div>

                <p className="text-sm text-slate-600 mt-3">{option.reasoning}</p>

                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
                  <span>
                    Custo de referência: US$ {option.unitCostUsdMin}–{option.unitCostUsdMax} (
                    {formatBRL(option.unitCostBrlMin)}–{formatBRL(option.unitCostBrlMax)})
                  </span>
                  <span>Pedido mínimo: {option.moq} un.</span>
                  <span>Prazo estimado: {option.leadTimeDays} dias</span>
                  {option.estimatedMarginPercent !== null && (
                    <span className="font-medium text-slate-800">
                      Margem estimada: {option.estimatedMarginPercent.toFixed(0)}%
                    </span>
                  )}
                </div>

                {option.productExamples.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {option.productExamples.map((p) => (
                      <span key={p} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {p}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 mt-3">
                  ⚠ {option.riskNotes}
                </p>
              </div>
            ))}
          </section>
        </>
      )}

      <section className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="font-medium text-slate-900 mb-1">Calculadora de câmbio (referência)</h3>
        <p className="text-xs text-slate-500 mb-3">
          Compara o custo total em reais de pagar o fornecedor por diferentes métodos, usando spreads de câmbio
          típicos — não são cotações ao vivo, confirme com seu banco/fintech antes de fechar.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm text-slate-700 w-40">
            <span>Valor da compra (US$)</span>
            <input
              type="number"
              className="input"
              value={fxUsdAmount}
              onChange={(e) => setFxUsdAmount(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700 flex-1 min-w-[240px]">
            <span>Método de pagamento</span>
            <select className="input" value={fxMethodId} onChange={(e) => setFxMethodId(e.target.value)}>
              {fxMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (spread ref. {m.typicalSpreadPercent}%)
                </option>
              ))}
            </select>
          </label>
          {fxTotalBrl !== null && (
            <div className="text-sm">
              <p className="text-slate-500 text-xs">Custo total estimado</p>
              <p className="font-semibold text-slate-900">{formatBRL(fxTotalBrl)}</p>
            </div>
          )}
        </div>
        {selectedFxMethod && <p className="text-xs text-slate-500 mt-2">{selectedFxMethod.notes}</p>}
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="font-medium text-slate-900 mb-1">Checklist para importar e revender perfumes no Brasil</h3>
        <p className="text-xs text-slate-500 mb-3">
          Conteúdo informativo, não é aconselhamento jurídico/tributário — as regras mudam com frequência; confirme
          com um despachante aduaneiro/contador antes de importar em volume comercial.
        </p>
        <ul className="list-disc list-inside text-sm text-slate-700 flex flex-col gap-1.5">
          <li>CNPJ ativo e habilitação no Radar Siscomex (Receita Federal) para importar formalmente.</li>
          <li>
            Autorização de Funcionamento de Empresa (AFE) da Anvisa — exigida para importar cosméticos/perfumes para
            revenda.
          </li>
          <li>
            Classificação fiscal correta na NCM 3303 (perfumes e águas de colônia) — ela define a alíquota do Imposto
            de Importação aplicada.
          </li>
          <li>
            Tributos incidem sobre o valor aduaneiro (produto + frete + seguro): Imposto de Importação, IPI,
            PIS/COFINS (regime monofásico para perfumaria) e ICMS estadual.
          </li>
          <li>
            Regras simplificadas de "remessa conforme" (para compras de pessoa física) não valem para importação
            comercial em volume — isso exige despacho de importação formal via CNPJ.
          </li>
          <li>Para grifes originais: confirme autenticidade e rastreabilidade do lote — distribuição seletiva torna o atacado "oficial" praticamente inacessível para pequenos revendedores.</li>
        </ul>
      </section>
    </div>
  );
}
