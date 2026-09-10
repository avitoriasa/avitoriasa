import cron from "node-cron";
import { getConfiguredAIProvider } from "../ai/index.js";
import { db } from "../db.js";
import { isDueForOptimization, optimizeConnection } from "./seoOptimizationService.js";

let task: cron.ScheduledTask | null = null;

async function runOptimizationSweep(): Promise<void> {
  const store = await db.read();
  const aiProvider = await getConfiguredAIProvider();
  const dueConnections = store.connections.filter(
    (c) => c.status === "connected" && isDueForOptimization(c, store.settings.optimizationCooldownHours)
  );

  for (const connection of dueConnections) {
    try {
      const log = await optimizeConnection(connection.id, aiProvider);
      console.log(`[scheduler] Otimizado ${connection.id}: "${log.newTitle}"`);
    } catch (err) {
      console.error(`[scheduler] Falha ao otimizar conexão ${connection.id}:`, (err as Error).message);
    }
  }
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
