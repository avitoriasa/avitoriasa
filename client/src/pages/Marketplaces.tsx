import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Marketplace } from "../types/domain";

export function Marketplaces() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);

  useEffect(() => {
    api.listMarketplaces().then(setMarketplaces);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Marketplaces suportados</h2>
        <p className="text-slate-500 text-sm mt-1">
          Regras de cada marketplace usadas pela IA para calcular a recomendação e respeitar limites de SEO.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {marketplaces.map((m) => (
          <div key={m.id} className="bg-white rounded-lg border border-slate-200 p-5">
            <h3 className="font-medium text-slate-900">{m.name}</h3>
            <p className="text-sm text-slate-500 mt-1">{m.notes}</p>
            <dl className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-600">
              <dt className="text-slate-400">Taxa</dt>
              <dd>{m.feePercent}%</dd>
              <dt className="text-slate-400">Título máx.</dt>
              <dd>{m.titleMaxLength} caracteres</dd>
              <dt className="text-slate-400">Descrição máx.</dt>
              <dd>{m.descriptionMaxLength} caracteres</dd>
              <dt className="text-slate-400">Palavras-chave máx.</dt>
              <dd>{m.maxKeywords}</dd>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
