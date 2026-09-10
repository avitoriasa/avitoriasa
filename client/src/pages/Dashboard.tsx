import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ApprovalRequest, CommandCenterSummary, ListingOverview } from "../types/domain";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Central de comando: a tela onde o dono decide o que vai (ou sai) do
 * marketplace. Tudo que a IA quer fazer aparece aqui como um pedido de
 * aprovação — nada é aplicado sem o clique dele.
 */
export function Dashboard() {
  const [data, setData] = useState<CommandCenterSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function load() {
    setData(await api.getCommandCenter());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecision(approval: ApprovalRequest, decision: "aprovar" | "recusar") {
    setBusyId(approval.id);
    setMessage(null);
    try {
      const result =
        decision === "aprovar" ? await api.approveRequest(approval.id) : await api.rejectRequest(approval.id);
      setMessage(result.outcome ?? "Decisão registrada.");
      await load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleListingCommand(listing: ListingOverview, command: "pausar" | "retomar") {
    setBusyId(listing.connectionId);
    setMessage(null);
    try {
      if (command === "pausar") {
        await api.pauseListing(listing.connectionId);
        setMessage(`"${listing.productName}" foi pausado em ${listing.marketplaceName}.`);
      } else {
        await api.resumeListing(listing.connectionId);
        setMessage(`"${listing.productName}" voltou ao ar em ${listing.marketplaceName}.`);
      }
      await load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCheckForSuggestions() {
    setChecking(true);
    setMessage(null);
    try {
      const { created } = await api.refreshApprovals();
      setMessage(
        created > 0
          ? `${created} nova(s) sugestão(ões) aguardando sua decisão.`
          : "Nenhuma sugestão nova por enquanto — tudo que a IA tinha a propor já está na lista."
      );
      await load();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  if (!data) return <p className="text-slate-500 text-sm">Carregando...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Central de comando</h2>
          <p className="text-slate-500 text-sm mt-1">
            A IA pesquisa, calcula e sugere. Quem decide o que entra ou sai do marketplace é você.
          </p>
        </div>
        <button
          onClick={handleCheckForSuggestions}
          disabled={checking}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {checking ? "Procurando..." : "Procurar novas sugestões"}
        </button>
      </div>

      {message && (
        <div className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">{message}</div>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-slate-900">
            Esperando sua decisão
            {data.pendingApprovals.length > 0 && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {data.pendingApprovals.length}
              </span>
            )}
          </h3>
          <span className="text-xs text-slate-400">
            Modo:{" "}
            {data.approvalMode === "manual"
              ? "manual — nada muda sem você aprovar"
              : "automático — a IA reotimiza sozinha os anúncios no ar"}
          </span>
        </div>

        {data.pendingApprovals.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-5 text-sm text-slate-500">
            Nada pendente. Quando a IA tiver algo a propor — publicar um produto num marketplace ou melhorar um
            anúncio que já está no ar — aparece aqui para você aprovar ou recusar.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.pendingApprovals.map((approval) => (
              <li key={approval.id} className="bg-white rounded-lg border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          approval.type === "publicar"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                      >
                        {approval.type === "publicar" ? "Publicar no marketplace" : "Melhorar anúncio no ar"}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(approval.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="font-medium text-slate-900 mt-2">{approval.summary}</p>
                    <p className="text-sm text-slate-600 mt-1">{approval.aiReasoning}</p>

                    {approval.type === "publicar" ? (
                      <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600 flex flex-wrap gap-x-6 gap-y-1">
                        <span>
                          Preço publicado:{" "}
                          <span className="font-medium text-slate-800">{formatBRL(approval.payload.listingPrice)}</span>
                        </span>
                        <span>
                          Você recebe:{" "}
                          <span className="font-medium text-slate-800">{formatBRL(approval.payload.netPrice)}</span>
                        </span>
                        <span>Score do marketplace: {approval.payload.recommendationScore.toFixed(0)}/100</span>
                      </div>
                    ) : (
                      <div className="mt-3 bg-slate-50 border border-slate-200 rounded-md p-3 text-xs">
                        <p className="text-slate-500">
                          Título atual: <span className="text-slate-700">"{approval.payload.previousTitle}"</span>
                        </p>
                        <p className="text-slate-500 mt-1">
                          Título proposto:{" "}
                          <span className="text-slate-900 font-medium">"{approval.payload.newTitle}"</span>
                        </p>
                        <p className="text-slate-500 mt-1">
                          Novas palavras-chave: {approval.payload.newKeywords.join(", ")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleDecision(approval, "aprovar")}
                      disabled={busyId === approval.id}
                      className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busyId === approval.id ? "Aplicando..." : "Aprovar"}
                    </button>
                    <button
                      onClick={() => handleDecision(approval, "recusar")}
                      disabled={busyId === approval.id}
                      className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="No ar agora" value={String(data.liveListings.length)} />
        <StatCard label="Pausados" value={String(data.pausedListings.length)} />
        <StatCard label="Produtos cadastrados" value={String(data.productCount)} />
        <StatCard label="A receber" value={formatBRL(data.financial.pendingPayout)} />
      </div>

      {data.lowStockAlerts.length > 0 && (
        <section className="bg-white rounded-lg border border-red-200 p-5">
          <h3 className="font-medium text-slate-900 mb-2">Estoque acabando</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {data.lowStockAlerts.map((alert) => (
              <li key={alert.productId} className="flex justify-between gap-3">
                <Link to={`/products/${alert.productId}`} className="text-slate-800 hover:text-indigo-600">
                  {alert.productName}
                </Link>
                <span className="text-red-600">
                  {alert.quantityOnHand} un. (repor a partir de {alert.reorderPoint})
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-2">
            Registre a compra na tela do produto para o estoque e o custo médio voltarem a ficar corretos.
          </p>
        </section>
      )}

      <ListingSection
        title="No ar agora"
        emptyText="Nenhum produto à venda ainda. Aprove uma sugestão de publicação acima, ou publique manualmente pela tela do produto."
        listings={data.liveListings}
        busyId={busyId}
        actionLabel="Pausar"
        onAction={(listing) => handleListingCommand(listing, "pausar")}
      />

      {data.pausedListings.length > 0 && (
        <ListingSection
          title="Pausados por você"
          emptyText=""
          listings={data.pausedListings}
          busyId={busyId}
          actionLabel="Voltar ao ar"
          onAction={(listing) => handleListingCommand(listing, "retomar")}
        />
      )}

      {data.recentDecisions.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="font-medium text-slate-900 mb-3">Suas últimas decisões</h3>
          <ul className="flex flex-col divide-y divide-slate-100">
            {data.recentDecisions.map((decision) => (
              <li key={decision.id} className="py-2 text-sm flex justify-between gap-4">
                <span className="text-slate-700">
                  <span
                    className={decision.status === "aprovado" ? "text-emerald-600 font-medium" : "text-slate-500 font-medium"}
                  >
                    {decision.status === "aprovado" ? "Aprovado" : "Recusado"}
                  </span>{" "}
                  — {decision.summary}
                  {decision.outcome && <span className="block text-xs text-slate-400 mt-0.5">{decision.outcome}</span>}
                </span>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {decision.decidedAt ? new Date(decision.decidedAt).toLocaleString("pt-BR") : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ListingSection({
  title,
  emptyText,
  listings,
  busyId,
  actionLabel,
  onAction,
}: {
  title: string;
  emptyText: string;
  listings: ListingOverview[];
  busyId: string | null;
  actionLabel: string;
  onAction: (listing: ListingOverview) => void;
}) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-5">
      <h3 className="font-medium text-slate-900 mb-3">{title}</h3>
      {listings.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {listings.map((listing) => (
            <li key={listing.connectionId} className="py-3 flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <Link to={`/products/${listing.productId}`} className="font-medium text-slate-800 hover:text-indigo-600">
                  {listing.productName}
                </Link>
                <span className="text-slate-400"> em </span>
                <span className="text-slate-700">{listing.marketplaceName}</span>
                <p className="text-xs text-slate-500 mt-1">"{listing.currentTitle}"</p>
                <p className="text-xs text-slate-400 mt-1">
                  Publicado por {formatBRL(listing.listingPrice)} · você recebe {formatBRL(listing.netPrice)} ·
                  atualizado{" "}
                  {listing.lastOptimizedAt ? new Date(listing.lastOptimizedAt).toLocaleDateString("pt-BR") : "nunca"}
                </p>
              </div>
              <button
                onClick={() => onAction(listing)}
                disabled={busyId === listing.connectionId}
                className="shrink-0 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {busyId === listing.connectionId ? "..." : actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
