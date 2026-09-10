import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { DropshipEstimate, FxMethod, SourcingOption, SourcingResearchResult } from "../types/domain";

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

const FULFILLMENT_LABEL: Record<string, string> = {
  estoque: "Melhor com estoque",
  dropshipping: "Bom para dropshipping",
  ambos: "Estoque ou dropshipping",
};

export function Sourcing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("perfumes");
  const [desiredResalePrice, setDesiredResalePrice] = useState("");
  const [result, setResult] = useState<SourcingResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fxMethods, setFxMethods] = useState<FxMethod[]>([]);
  const [fxUsdAmount, setFxUsdAmount] = useState("500");
  const [fxMethodId, setFxMethodId] = useState<string>("");

  const [dropshipPriceUsd, setDropshipPriceUsd] = useState("40");
  const [dropshipShippingBrl, setDropshipShippingBrl] = useState("30");
  const [dropshipCompliant, setDropshipCompliant] = useState(true);
  const [dropshipEstimate, setDropshipEstimate] = useState<DropshipEstimate | null>(null);
  const [dropshipLoading, setDropshipLoading] = useState(false);

  useEffect(() => {
    api.listFxMethods().then((methods) => {
      setFxMethods(methods);
      if (methods.length) setFxMethodId(methods[0].id);
    });
  }, []);

  async function runDropshipEstimate() {
    setDropshipLoading(true);
    try {
      setDropshipEstimate(
        await api.estimateDropship(Number(dropshipPriceUsd) || 0, Number(dropshipShippingBrl) || 0, dropshipCompliant)
      );
    } finally {
      setDropshipLoading(false);
    }
  }

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
    const avgLandedCostBrl = (option.landedCostBrlMin + option.landedCostBrlMax) / 2;
    navigate("/products", {
      state: {
        prefill: {
          name: option.productExamples[0] ? `${option.name} — ${option.productExamples[0]}` : option.name,
          category: "perfumes",
          costBasis: Math.round(avgLandedCostBrl * 100) / 100,
          fulfillmentMode: option.suggestedFulfillment === "dropshipping" ? "dropship" : "stock",
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
              US$ 1 = {formatBRL(result.usdToBrlRate)} · impostos de importação (referência): {result.importTaxPercent}%
            </p>
            <p className="text-sm text-indigo-900">{result.summary}</p>
            <p className="text-xs text-indigo-500 mt-1">
              Ordenado automaticamente pelo menor custo total de importação (produto + frete + impostos de
              referência). Ajuste a cotação e os impostos em Configurações.
            </p>
          </section>

          <section className="grid gap-4">
            {result.options.map((option, idx) => (
              <div key={option.leadId} className="bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {idx === 0 && (
                        <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                          Menor custo total
                        </span>
                      )}
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {NICHE_LABEL[option.niche] ?? option.niche}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          option.suggestedFulfillment === "dropshipping"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {FULFILLMENT_LABEL[option.suggestedFulfillment]}
                      </span>
                    </div>
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
                    Produto: US$ {option.unitCostUsdMin}–{option.unitCostUsdMax} ({formatBRL(option.unitCostBrlMin)}–
                    {formatBRL(option.unitCostBrlMax)})
                  </span>
                  <span>
                    Frete (ref.): US$ {option.freightUsdPerUnit}/un. ({formatBRL(option.freightBrlPerUnit)})
                  </span>
                  <span className="font-medium text-slate-800">
                    Custo total de importação: {formatBRL(option.landedCostBrlMin)}–{formatBRL(option.landedCostBrlMax)}{" "}
                    /un.
                  </span>
                  <span>Pedido mínimo: {option.moq} un.</span>
                  <span>Prazo estimado: {option.leadTimeDays} dias</span>
                  {option.estimatedMarginPercent !== null && (
                    <span className="font-medium text-slate-800">
                      Margem estimada (sobre custo total): {option.estimatedMarginPercent.toFixed(0)}%
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
        <h3 className="font-medium text-slate-900 mb-1">Calculadora de dropshipping (compra por pedido)</h3>
        <p className="text-xs text-slate-500 mb-3">
          Para itens marcados "Bom para dropshipping" (MOQ baixo, ticket alto — normalmente grifes originais):
          compare o preço no varejo (ex.: um site dos EUA — use uma ferramenta de cupom/preço como a{" "}
          <a href="https://www.joinhoney.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
            Honey
          </a>{" "}
          para achar o menor preço antes de comprar; este app não consulta a Honey automaticamente, é manual) e
          estime o imposto de uma remessa individual — regime diferente do import comercial em volume.
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm text-slate-700 w-40">
            <span>Preço no varejo (US$)</span>
            <input
              type="number"
              className="input"
              value={dropshipPriceUsd}
              onChange={(e) => setDropshipPriceUsd(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700 w-40">
            <span>Frete estimado (R$)</span>
            <input
              type="number"
              className="input"
              value={dropshipShippingBrl}
              onChange={(e) => setDropshipShippingBrl(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={dropshipCompliant} onChange={(e) => setDropshipCompliant(e.target.checked)} />
            Comprado via plataforma "Remessa Conforme"
          </label>
          <button
            onClick={runDropshipEstimate}
            disabled={dropshipLoading}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {dropshipLoading ? "Calculando..." : "Calcular"}
          </button>
        </div>
        {dropshipEstimate && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
            <span>Produto: {formatBRL(dropshipEstimate.sourcePriceBrl)}</span>
            <span>Frete: {formatBRL(dropshipEstimate.shippingBrl)}</span>
            <span>
              Imposto de importação (II): {dropshipEstimate.iiExempt ? "isento (≤ US$50, Remessa Conforme)" : formatBRL(dropshipEstimate.iiBrl)}
            </span>
            <span>
              ICMS ({dropshipEstimate.icmsPercent}%): {formatBRL(dropshipEstimate.icmsBrl)}
            </span>
            <span className="font-medium text-slate-800">
              Custo total dessa compra: {formatBRL(dropshipEstimate.totalLandedBrl)}
            </span>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-2">
          Estimativa de referência (não oficial) — confirme com um simulador como o{" "}
          <a href="https://m.tributado.net" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
            tributado.net
          </a>{" "}
          antes de fechar a compra. Depois de comprado, registre o custo real e o código de rastreio no pedido (tela
          do produto) — para transportadora USPS, o link de rastreio usa o{" "}
          <a
            href="https://tools.usps.com/tracking/"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline"
          >
            rastreador oficial dos Correios americanos
          </a>
          .
        </p>
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
            comercial em volume (estoque) — isso exige despacho de importação formal via CNPJ. Já para
            <strong> dropshipping</strong> (compra unidade a unidade, enviada direto ao cliente final), o regime que se
            aplica é justamente esse — de remessa individual — não o de import comercial.
          </li>
          <li>Para grifes originais: confirme autenticidade e rastreabilidade do lote — distribuição seletiva torna o atacado "oficial" praticamente inacessível para pequenos revendedores.</li>
        </ul>
      </section>
    </div>
  );
}
