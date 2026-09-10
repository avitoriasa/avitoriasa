import cron from "node-cron";
import { getConfiguredAIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { proposePublishForIdleProducts, proposeSeoUpdate } from "./approvalService.js";
import { collectOrdersForConnection, maturePendingPayouts } from "./ordersService.js";
import { isDueForOptimization, optimizeConnection } from "./seoOptimizationService.js";

let task: cron.ScheduledTask | null = null;

async function runOptimizationSweep(): Promise<void> {
  const store = await db.read();
  const aiProvider = await getConfiguredAIProvider();
  const manualMode = store.settings.approvalMode === "manual";
  const connectedConnections = store.connections.filter((c) => c.status === "connected");
  const dueConnections = connectedConnections.filter((c) =>
    isDueForOptimization(c, store.settings.optimizationCooldownHours)
  );

  for (const connection of dueConnections) {
    try {
      if (manualMode) {
        // Modo manual: a IA só deixa a proposta pronta na central de comando;
        // o anúncio no marketplace continua exatamente como está.
        const approval = await proposeSeoUpdate(connection.id, aiProvider);
        if (approval) console.log(`[scheduler] Proposta de SEO aguardando aprovação: ${approval.summary}`);
      } else {
        const log = await optimizeConnection(connection.id, aiProvider);
        console.log(`[scheduler] Otimizado ${connection.id}: "${log.newTitle}"`);
      }
    } catch (err) {
      console.error(`[scheduler] Falha ao processar conexão ${connection.id}:`, (err as Error).message);
    }
  }

  // Publicar num marketplace novo sempre depende do dono, nos dois modos.
  try {
    const proposed = await proposePublishForIdleProducts(aiProvider);
    if (proposed) console.log(`[scheduler] ${proposed} sugestão(ões) de publicação aguardando aprovação`);
  } catch (err) {
    console.error("[scheduler] Falha ao sugerir publicações:", (err as Error).message);
  }

  // Poll every connected marketplace for new sales, independent of the SEO
  // cooldown — orders can come in at any time.
  for (const connection of connectedConnections) {
    const marketplace = store.marketplaces.find((m) => m.id === connection.marketplaceId);
    if (!marketplace) continue;
    try {
      const newOrders = await collectOrdersForConnection(connection, marketplace);
      if (newOrders.length) console.log(`[scheduler] ${newOrders.length} novo(s) pedido(s) em ${connection.id}`);
    } catch (err) {
      console.error(`[scheduler] Falha ao buscar pedidos da conexão ${connection.id}:`, (err as Error).message);
    }
  }

  const matured = await maturePendingPayouts();
  if (matured) console.log(`[scheduler] ${matured} repasse(s) marcado(s) como pago(s)`);
}

function cronExpressionForHours(hours: number): string {
  const clamped = Math.min(23, Math.max(1, Math.round(hours)));
  return `0 */${clamped} * * *`;
}

export async function startScheduler(): Promise<void> {
  const store = await db.read();
  const expression = cronExpressionForHours(store.settings.optimizationIntervalHours);

  if (task) task.stop();
  task = cron.schedule(expression, () => {
    runOptimizationSweep().catch((err) => console.error("[scheduler] Erro no ciclo de otimização:", err));
  });

  console.log(`[scheduler] Otimização automática de SEO agendada: "${expression}" (cooldown por anúncio: ${store.settings.optimizationCooldownHours}h)`);
}

export async function restartScheduler(): Promise<void> {
  await startScheduler();
}

export async function runOptimizationSweepNow(): Promise<void> {
  await runOptimizationSweep();
}
