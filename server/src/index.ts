import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectionsRouter } from "./routes/connections.js";
import { marketplacesRouter } from "./routes/marketplaces.js";
import { optimizationsRouter } from "./routes/optimizations.js";
import { productsRouter } from "./routes/products.js";
import { schedulerRouter } from "./routes/scheduler.js";
import { settingsRouter } from "./routes/settings.js";
import { ensureSeedData } from "./seed.js";
import { startScheduler } from "./services/schedulerService.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/products", productsRouter);
app.use("/api/marketplaces", marketplacesRouter);
app.use("/api/connections", connectionsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/scheduler", schedulerRouter);
app.use("/api/optimizations", optimizationsRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

async function main() {
  await ensureSeedData();
  await startScheduler();
  app.listen(PORT, () => {
    console.log(`[server] Marketplace CRM API rodando em http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
