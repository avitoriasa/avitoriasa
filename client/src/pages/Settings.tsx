import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";
import type { AppSettings } from "../types/domain";

export function Settings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setMessage("Configurações salvas. O agendamento de otimização foi reiniciado.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="text-slate-500 text-sm">Carregando...</p>;

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Configurações</h2>
        <p className="text-slate-500 text-sm mt-1">
          Escolha o modelo de IA usado para recomendar marketplaces e reescrever seus anúncios, e a frequência da
          otimização automática de SEO.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-700 mb-1">Quem decide as mudanças nos anúncios</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={settings.approvalMode === "manual"}
              onChange={() => setSettings({ ...settings, approvalMode: "manual" })}
            />
            <span>
              <span className="font-medium">Eu aprovo tudo (recomendado)</span>
              <span className="block text-xs text-slate-500">
                A IA só sugere. Nenhum título, descrição ou palavra-chave muda nos seus anúncios sem você aprovar na
                Central de comando.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              className="mt-1"
              checked={settings.approvalMode === "automatico"}
              onChange={() => setSettings({ ...settings, approvalMode: "automatico" })}
            />
            <span>
              <span className="font-medium">A IA pode reotimizar sozinha</span>
              <span className="block text-xs text-slate-500">
                A IA atualiza o SEO dos anúncios que já estão no ar sem perguntar. Colocar um produto num marketplace
                novo continua exigindo a sua aprovação.
              </span>
            </span>
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-700 mb-1">Provedor de IA</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={settings.aiProvider === "heuristic"}
              onChange={() => setSettings({ ...settings, aiProvider: "heuristic" })}
            />
            Heurístico (sem dependências, funciona offline)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={settings.aiProvider === "ollama"}
              onChange={() => setSettings({ ...settings, aiProvider: "ollama" })}
            />
            Ollama — modelo de IA open source local (ex: Llama 3, Mistral)
          </label>
        </fieldset>

        {settings.aiProvider === "ollama" && (
          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-md p-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span>URL do servidor Ollama</span>
              <input
                className="input"
                value={settings.ollamaBaseUrl}
                onChange={(e) => setSettings({ ...settings, ollamaBaseUrl: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span>Modelo</span>
              <input
                className="input"
                value={settings.ollamaModel}
                onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
                placeholder="llama3, mistral, qwen2..."
              />
            </label>
            <p className="col-span-2 text-xs text-slate-500">
              Requer o Ollama instalado e rodando (<span className="font-mono">ollama serve</span>) com o modelo
              baixado (<span className="font-mono">ollama pull {settings.ollamaModel || "llama3"}</span>). Se
              indisponível, o sistema usa automaticamente o modo heurístico.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span>Intervalo do ciclo de otimização (horas)</span>
            <input
              type="number"
              min={1}
              max={23}
              className="input"
              value={settings.optimizationIntervalHours}
              onChange={(e) => setSettings({ ...settings, optimizationIntervalHours: Number(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span>Cooldown por anúncio (horas)</span>
            <input
              type="number"
              min={1}
              className="input"
              value={settings.optimizationCooldownHours}
              onChange={(e) => setSettings({ ...settings, optimizationCooldownHours: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          A cada ciclo, o sistema reotimiza automaticamente os anúncios conectados cujo cooldown já passou —
          trocando título, descrição e palavras-chave para evitar estagnação no ranking do marketplace.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span>Cotação USD → BRL (custos de fornecedores)</span>
            <input
              type="number"
              step="0.01"
              className="input"
              value={settings.usdToBrlRate}
              onChange={(e) => setSettings({ ...settings, usdToBrlRate: Number(e.target.value) })}
            />
            <span className="text-xs text-slate-400">Não é uma cotação ao vivo — atualize conforme o câmbio do dia.</span>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span>Impostos de importação (% de referência)</span>
            <input
              type="number"
              step="1"
              className="input"
              value={settings.importTaxPercent}
              onChange={(e) => setSettings({ ...settings, importTaxPercent: Number(e.target.value) })}
            />
            <span className="text-xs text-slate-400">
              Estimativa de II+IPI+PIS/COFINS+ICMS sobre custo+frete — confirme com um despachante/contador.
            </span>
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Essas duas cotações definem o custo total de importação (produto + frete + impostos) usado para ranquear
          automaticamente os fornecedores na tela de Fornecedores, priorizando sempre o menor custo total.
        </p>

        <label className="flex flex-col gap-1 text-sm text-slate-700 max-w-[260px]">
          <span>ICMS de referência p/ dropshipping (remessa individual)</span>
          <input
            type="number"
            step="1"
            className="input"
            value={settings.remessaIcmsPercent}
            onChange={(e) => setSettings({ ...settings, remessaIcmsPercent: Number(e.target.value) })}
          />
          <span className="text-xs text-slate-400">
            Regime diferente do import comercial acima — usado na calculadora de dropshipping (tela de
            Fornecedores) para estimar o imposto de uma compra individual enviada direto ao cliente. Varia por
            estado; confira em simuladores como o tributado.net.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          <span>Chave da SerpApi (opcional — alternativa paga ao Google Trends grátis)</span>
          <input
            type="password"
            autoComplete="off"
            className="input"
            value={settings.serpApiKey}
            onChange={(e) => setSettings({ ...settings, serpApiKey: e.target.value })}
            placeholder="deixe em branco para usar o Google Trends direto, sem custo"
          />
          <span className="text-xs text-slate-400">
            Por padrão (campo vazio), o painel de "Tendências &amp; SEO" de cada produto já busca interesse de busca
            real direto do próprio Google Trends, sem chave, sem cadastro e sem custo (com fallback automático para
            um dataset curado se o Google limitar a requisição). Só preencha este campo se você quiser pagar por{" "}
            <a href="https://serpapi.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              serpapi.com
            </a>{" "}
            como alternativa mais estável — não é necessário para o app funcionar com dados reais.
          </span>
        </label>

        {message && <p className="text-sm text-indigo-700">{message}</p>}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>
    </div>
  );
}
