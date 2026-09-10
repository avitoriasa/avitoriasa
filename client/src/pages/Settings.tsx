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
