import { v4 as uuid } from "uuid";
import { AIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { publishProductToMarketplace } from "./publishingService.js";
import { generateListingUpdate, applyListingUpdate } from "./seoOptimizationService.js";
import { generateRecommendation, getLatestRecommendation } from "./recommendationService.js";
import { ApprovalRequest, ApprovalStatus } from "../types.js";

/**
 * A fila de decisões do dono. Toda mudança que a IA quer fazer no que está
 * à venda passa por aqui primeiro: o agente cria a proposta com os números
 * já calculados e a justificativa, e nada acontece no marketplace até o dono
 * aprovar. Recusar simplesmente descarta a proposta — o anúncio segue como
 * está, e uma nova proposta só aparece no ciclo seguinte.
 */

export async function listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
  const store = await db.read();
  const all = status ? store.approvals.filter((a) => a.status === status) : store.approvals;
  return [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function hasPendingFor(predicate: (approval: ApprovalRequest) => boolean): Promise<boolean> {
  const store = await db.read();
  return store.approvals.some((a) => a.status === "pendente" && predicate(a));
}

async function persist(approval: ApprovalRequest): Promise<ApprovalRequest> {
  const store = await db.read();
  store.approvals.push(approval);
  await db.save();
  return approval;
}

/**
 * Propõe reescrever um anúncio que já está no ar. Não duplica: se já existe
 * uma proposta pendente para o mesmo anúncio, devolve null e o ciclo segue.
 */
export async function proposeSeoUpdate(connectionId: string, aiProvider: AIProvider): Promise<ApprovalRequest | null> {
  if (await hasPendingFor((a) => a.type === "otimizar_seo" && a.payload.connectionId === connectionId)) return null;

  const store = await db.read();
  const connection = store.connections.find((c) => c.id === connectionId);
  if (!connection || connection.status !== "connected") return null;

  const product = store.products.find((p) => p.id === connection.productId);
  const marketplace = store.marketplaces.find((m) => m.id === connection.marketplaceId);
  if (!product || !marketplace) return null;

  const generated = await generateListingUpdate(connectionId, aiProvider);

  return persist({
    id: uuid(),
    type: "otimizar_seo",
    status: "pendente",
    productId: product.id,
    productName: product.name,
    summary: `Atualizar o anúncio de "${product.name}" em ${marketplace.name}`,
    aiReasoning: generated.changeReason,
    createdAt: new Date().toISOString(),
    decidedAt: null,
    outcome: null,
    payload: {
      connectionId,
      marketplaceId: marketplace.id,
      marketplaceName: marketplace.name,
      previousTitle: connection.currentTitle,
      newTitle: generated.title,
      previousDescription: connection.currentDescription,
      newDescription: generated.description,
      previousKeywords: connection.currentKeywords,
      newKeywords: generated.keywords,
    },
  });
}

/**
 * Propõe colocar um produto à venda no marketplace mais bem ranqueado para
 * ele que ainda não tem anúncio ativo. Essa decisão nunca é automática, nem
 * no modo automático: é o dono quem escolhe o que vai pro ar.
 */
export async function proposePublish(productId: string, aiProvider: AIProvider): Promise<ApprovalRequest | null> {
  const store = await db.read();
  const product = store.products.find((p) => p.id === productId);
  if (!product) return null;

  const recommendation = (await getLatestRecommendation(productId)) ?? (await generateRecommendation(productId, aiProvider));
  if (!recommendation) return null;

  const activeMarketplaceIds = new Set(
    store.connections.filter((c) => c.productId === productId && c.status !== "disconnected").map((c) => c.marketplaceId)
  );
  const candidate = recommendation.ranking.find((entry) => !activeMarketplaceIds.has(entry.marketplaceId));
  if (!candidate) return null;

  if (
    await hasPendingFor(
      (a) => a.type === "publicar" && a.productId === productId && a.payload.marketplaceId === candidate.marketplaceId
    )
  ) {
    return null;
  }

  return persist({
    id: uuid(),
    type: "publicar",
    status: "pendente",
    productId: product.id,
    productName: product.name,
    summary: `Publicar "${product.name}" em ${candidate.marketplaceName}`,
    aiReasoning: candidate.reasoning,
    createdAt: new Date().toISOString(),
    decidedAt: null,
    outcome: null,
    payload: {
      marketplaceId: candidate.marketplaceId,
      marketplaceName: candidate.marketplaceName,
      recommendationScore: candidate.score,
      listingPrice: candidate.pricing.listingPrice,
      netPrice: candidate.pricing.basePrice,
    },
  });
}

/** Aplica de verdade o que o dono aprovou. */
export async function approveRequest(approvalId: string, aiProvider: AIProvider): Promise<ApprovalRequest> {
  const store = await db.read();
  const approval = store.approvals.find((a) => a.id === approvalId);
  if (!approval) throw new Error("Decisão não encontrada");
  if (approval.status !== "pendente") throw new Error("Essa decisão já foi tomada");

  let outcome: string;
  if (approval.type === "publicar") {
    const connection = await publishProductToMarketplace(approval.productId, approval.payload.marketplaceId, aiProvider);
    outcome = `Publicado em ${approval.payload.marketplaceName} por R$ ${connection.pricing.listingPrice.toFixed(2)}.`;
  } else {
    const log = await applyListingUpdate(
      approval.payload.connectionId,
      {
        title: approval.payload.newTitle,
        description: approval.payload.newDescription,
        keywords: approval.payload.newKeywords,
        changeReason: approval.aiReasoning,
      },
      aiProvider.name
    );
    outcome = `Anúncio atualizado em ${approval.payload.marketplaceName}: "${log.newTitle}".`;
  }

  // Reler o store: publicar/aplicar já gravaram no disco no meio do caminho.
  const fresh = await db.read();
  const target = fresh.approvals.find((a) => a.id === approvalId)!;
  target.status = "aprovado";
  target.decidedAt = new Date().toISOString();
  target.outcome = outcome;
  await db.save();
  return target;
}

/** Descarta a proposta — nada muda no marketplace. */
export async function rejectRequest(approvalId: string): Promise<ApprovalRequest> {
  const store = await db.read();
  const approval = store.approvals.find((a) => a.id === approvalId);
  if (!approval) throw new Error("Decisão não encontrada");
  if (approval.status !== "pendente") throw new Error("Essa decisão já foi tomada");

  approval.status = "recusado";
  approval.decidedAt = new Date().toISOString();
  approval.outcome = "Recusado pelo dono — nada foi alterado no marketplace.";
  await db.save();
  return approval;
}

/**
 * Varre o catálogo e monta a fila de decisões: sugere publicar produtos que
 * ainda não estão à venda em nenhum lugar. As propostas de SEO nascem no
 * ciclo do scheduler (ver schedulerService.ts), quando o cooldown do anúncio
 * vence.
 */
export async function proposePublishForIdleProducts(aiProvider: AIProvider): Promise<number> {
  const store = await db.read();
  const idleProducts = store.products.filter(
    (p) => !store.connections.some((c) => c.productId === p.id && c.status !== "disconnected")
  );

  let created = 0;
  for (const product of idleProducts) {
    try {
      if (await proposePublish(product.id, aiProvider)) created++;
    } catch (err) {
      console.error(`[approvals] Falha ao propor publicação de ${product.name}:`, (err as Error).message);
    }
  }
  return created;
}
