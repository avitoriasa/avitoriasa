import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type {
  DropshipEstimate,
  FxMethod,
  OnboardingPipelineResult,
  SourcingOption,
  SourcingResearchResult,
  TrustedSupplier,
} from "../types/domain";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const QUICK_FILTERS = [
  { label: "Beleza em geral", query: "beleza" },
  { label: "Perfumes", query: "perfumes" },
  { label: "Skincare", query: "skincare" },
  { label: "Maquiagem", query: "maquiagem" },
  { label: "Cabelo", query: "cabelo" },
  { label: "Marcas originais (importação paralela)", query: "originais importados" },
];

const NICHE_LABEL: Record<string, string> = {
  marca_propria_atacado: "Marca própria (atacado direto)",
  importados_originais_marca: "Marca original (importação paralela)",
  geral_b2b: "Plataforma B2B geral",
};

const CATEGORY_LABEL: Record<string, string> = {
  perfumes: "Perfumes",
  skincare: "Skincare",
  maquiagem: "Maquiagem",
  cabelo: "Cabelo",
  beleza_geral: "Beleza (geral)",
};

const FULFILLMENT_LABEL: Record<string, string> = {
  estoque: "Melhor com estoque",
  dropshipping: "Bom para dropshipping",
  ambos: "Estoque ou dropshipping",
};

const TRUST_LABEL: Record<string, string> = {
  verificado: "Confiança: verificado",
  referencia: "Confiança: referência",
  alerta: "Confiança: alerta",
};

const TRUST_CLASS: Record<string, string> = {
  verificado: "bg-emerald-100 text-emerald-700",
  referencia: "bg-slate-100 text-slate-600",
  alerta: "bg-red-100 text-red-700",
};

export function Sourcing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("beleza");
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

  const [trustedSuppliers, setTrustedSuppliers] = useState<TrustedSupplier[]>([]);
  const [savingTrustedId, setSavingTrustedId] = useState<string | null>(null);
  const [pipelineByLeadId, setPipelineByLeadId] = useState<Record<string, OnboardingPipelineResult>>({});
  const [pipelineLoadingId, setPipelineLoadingId] = useState<string | null>(null);

  useEffect(() => {
    api.listFxMethods().then((methods) => {
      setFxMethods(methods);
      if (methods.length) setFxMethodId(methods[0].id);
    });
    loadTrustedSuppliers();
  }, []);

  async function loadTrustedSuppliers() {
    setTrustedSuppliers(await api.listTrustedSuppliers());
  }

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
          category: option.category,
          costBasis: Math.round(avgLandedCostBrl * 100) / 100,
          fulfillmentMode: option.suggestedFulfillment === "dropshipping" ? "dropship" : "stock",
          keywords: [...option.productExamples, CATEGORY_LABEL[option.category] ?? option.category, "importado"],
          description: `Fornecedor: ${option.name} (${option.channel}, ${option.country}). ${option.riskNotes}`,
        },
      },
    });
  }

  async function handleSaveTrusted(option: SourcingOption) {
    setSavingTrustedId(option.leadId);
    try {
      await api.addTrustedSupplier({
        name: option.name,
        category: option.category,
        channel: option.channel,
        country: option.country,
        trustNotes: `Confiança curada: ${option.trustTier} (${option.trustScore}/100). ${option.trustSignals.join("; ")}`,
        sourceLeadId: option.leadId,
      });
      await loadTrustedSuppliers();
    } finally {
      setSavingTrustedId(null);
    }
  }

  async function handleRemoveTrusted(id: string) {
    await api.removeTrustedSupplier(id);
    await loadTrustedSuppliers();
  }

  async function handleRunPipeline(option: SourcingOption) {
    setPipelineLoadingId(option.leadId);
    try {
      const price = desiredResalePrice.trim() === "" ? undefined : Number(desiredResalePrice);
      const pipeline = await api.runOnboardingPipeline(option.leadId, price);
      setPipelineByLeadId((prev) => ({ ...prev, [option.leadId]: pipeline }));
    } finally {
      setPipelineLoadingId(null);
    }
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
          Pesquisa de canais de compra confiáveis no ramo da beleza (perfumaria, skincare, maquiagem, cabelo — com
          foco em produtos de marca) para dropshipping ou estoque nos marketplaces conectados. Os dados de custo/MOQ
          são uma referência curada, não uma cotação ao vivo — sempre confirme preço, autenticidade e condições
          diretamente com o fornecedor.
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
            {result.options.map((option, idx) => {
              const pipeline = pipelineByLeadId[option.leadId];
              const alreadyTrusted = trustedSuppliers.some((t) => t.sourceLeadId === option.leadId);
              return (
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
                          {CATEGORY_LABEL[option.category] ?? option.category}
                        </span>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TRUST_CLASS[option.trustTier]}`}>
                          {TRUST_LABEL[option.trustTier]} ({option.trustScore}/100)
                        </span>
                      </div>
                      <h3 className="font-medium text-slate-900 mt-1">{option.name}</h3>
                      <p className="text-xs text-slate-500">
                        {option.channel} · {option.country}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button
                        onClick={() => handleUseOption(option)}
                        className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        Usar esta opção para criar produto
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRunPipeline(option)}
                          disabled={pipelineLoadingId === option.leadId}
                          className="text-xs px-3 py-1.5 rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                        >
                          {pipelineLoadingId === option.leadId ? "Rodando esteira..." : "Rodar esteira (IA)"}
                        </button>
                        <button
                          onClick={() => handleSaveTrusted(option)}
                          disabled={savingTrustedId === option.leadId || alreadyTrusted}
                          className="text-xs px-3 py-1.5 rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {alreadyTrusted
                            ? "Já é confiável"
                            : savingTrustedId === option.leadId
                              ? "Salvando..."
                              : "Salvar como confiável"}
                        </button>
                      </div>
                    </div>
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

                  {pipeline && (
                    <div className="mt-3 border-t border-slate-100 pt-3 flex flex-col gap-2">
                      <p className="text-xs text-slate-400">
                        Esteira multiagente (IA: <span className="font-mono">{pipeline.aiProvider}</span>)
                      </p>
                      <div className="bg-indigo-50 border border-indigo-100 rounded-md p-2 text-xs text-indigo-900">
                        <span className="font-medium">Agente de confiança: </span>
                        {pipeline.trustAssessment.reasoning}
                      </div>
                      {pipeline.inventoryPlan ? (
                        <div className="bg-sky-50 border border-sky-100 rounded-md p-2 text-xs text-sky-900">
                          <span className="font-medium">Agente de estoque: </span>
                          {pipeline.inventoryPlan.reasoning}
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-2 text-xs text-slate-500">
                          Sem plano de estoque — esta opção é indicada para dropshipping (sem manter inventário).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}

      {trustedSuppliers.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-medium text-slate-900 mb-1">Meus fornecedores confiáveis</h3>
          <p className="text-xs text-slate-500 mb-3">
            Sua lista própria de fornecedores vetados — separada do catálogo de referência acima.
          </p>
          <ul className="flex flex-col divide-y divide-slate-100">
            {trustedSuppliers.map((s) => (
              <li key={s.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {s.name} <span className="text-xs text-slate-400">({CATEGORY_LABEL[s.category] ?? s.category})</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.channel} · {s.country}
                  </p>
                  {s.trustNotes && <p className="text-xs text-slate-500 mt-1">{s.trustNotes}</p>}
                </div>
                <button onClick={() => handleRemoveTrusted(s.id)} className="text-xs text-red-600 hover:underline shrink-0">
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </section>
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
          Para itens marcados "Bom para dropshipping" (MOQ baixo, ticket alto — normalmente marcas originais):
          compare o preço no varejo (ex.: um site dos EUA — use uma ferramenta de cupom/preço, como a Honey, para
          achar o menor preço antes de comprar; isso é manual, o app não consulta nenhuma ferramenta externa
          automaticamente) e estime o imposto de uma remessa individual — regime diferente do import comercial em
          volume.
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
          Estimativa de referência (não oficial) — confirme com um simulador de imposto de importação antes de
          fechar a compra. Depois de comprado, registre o custo real e o código de rastreio no pedido (tela do
          produto) — para transportadora USPS, o app já gera o link de rastreio automaticamente.
        </p>
      </section>

      <section className="bg-white rounded-lg border border-slate-200 p-5">
        <h3 className="font-medium text-slate-900 mb-1">Checklist para importar e revender produtos de beleza no Brasil</h3>
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
            Classificação fiscal correta na NCM (3303 para perfumes; skincare/maquiagem/cabelo têm NCMs próprios em
            3304/3305) — ela define a alíquota do Imposto de Importação aplicada.
          </li>
          <li>
            Tributos incidem sobre o valor aduaneiro (produto + frete + seguro): Imposto de Importação, IPI,
            PIS/COFINS (regime monofásico para perfumaria/cosméticos) e ICMS estadual.
          </li>
          <li>
            Regras simplificadas de "remessa conforme" (para compras de pessoa física) não valem para importação
            comercial em volume (estoque) — isso exige despacho de importação formal via CNPJ. Já para
            <strong> dropshipping</strong> (compra unidade a unidade, enviada direto ao cliente final), o regime que se
            aplica é justamente esse — de remessa individual — não o de import comercial.
          </li>
          <li>
            Para marcas originais via importação paralela: confirme autenticidade e rastreabilidade do lote —
            distribuição seletiva/exclusiva torna o atacado "oficial" praticamente inacessível para pequenos
            revendedores. Prefira fornecedores marcados "confiança: verificado" e mantenha sua própria lista de
            fornecedores confiáveis acima.
          </li>
        </ul>
      </section>
    </div>
  );
}
