import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AppSettings,
  ApprovalRequest,
  InventoryItemSnapshot,
  Marketplace,
  OptimizationLogEntry,
  Order,
  Product,
  ProductMarketplaceConnection,
  RecommendationResult,
  StockMovement,
  TrustedSupplier,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data-store");
const DB_FILE = path.join(DATA_DIR, "db.json");

interface Schema {
  products: Product[];
  marketplaces: Marketplace[];
  connections: ProductMarketplaceConnection[];
  recommendations: RecommendationResult[];
  optimizationLogs: OptimizationLogEntry[];
  orders: Order[];
  trustedSuppliers: TrustedSupplier[];
  inventoryItems: InventoryItemSnapshot[];
  stockMovements: StockMovement[];
  approvals: ApprovalRequest[];
  settings: AppSettings;
}

const defaultSettings: AppSettings = {
  aiProvider: (process.env.AI_PROVIDER as "ollama" | "heuristic") || "heuristic",
  // Padrão: nada muda nos anúncios sem o dono aprovar na central de comando.
  approvalMode: process.env.APPROVAL_MODE === "automatico" ? "automatico" : "manual",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3",
  optimizationIntervalHours: Number(process.env.OPTIMIZATION_INTERVAL_HOURS) || 6,
  optimizationCooldownHours: Number(process.env.OPTIMIZATION_COOLDOWN_HOURS) || 24,
  // Placeholder — não é uma cotação ao vivo. Atualize em Configurações ou via USD_TO_BRL_RATE.
  usdToBrlRate: Number(process.env.USD_TO_BRL_RATE) || 5.3,
  // Estimativa grosseira (II+IPI+PIS/COFINS+ICMS sobre custo+frete) — confirme com despachante/contador.
  importTaxPercent: Number(process.env.IMPORT_TAX_PERCENT) || 60,
  // ICMS de referência sobre remessas individuais (regime distinto da importação comercial em volume).
  remessaIcmsPercent: Number(process.env.REMESSA_ICMS_PERCENT) || 17,
  // Chave da SerpApi para dados reais do Google Trends — opcional, sem ela usa o dataset curado.
  serpApiKey: process.env.SERPAPI_KEY || "",
};

function emptySchema(): Schema {
  return {
    products: [],
    marketplaces: [],
    connections: [],
    recommendations: [],
    optimizationLogs: [],
    orders: [],
    trustedSuppliers: [],
    inventoryItems: [],
    stockMovements: [],
    approvals: [],
    settings: defaultSettings,
  };
}

let cache: Schema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureLoaded(): Promise<Schema> {
  if (cache) return cache;
  let loaded: Schema;
  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    loaded = { ...emptySchema(), ...JSON.parse(raw) };
  } catch {
    loaded = emptySchema();
  }
  cache = loaded;
  if (!(await fileExists())) await persist();
  return cache;
}

async function fileExists(): Promise<boolean> {
  try {
    await fs.access(DB_FILE);
    return true;
  } catch {
    return false;
  }
}

async function persist(): Promise<void> {
  if (!cache) return;
  await fs.mkdir(DATA_DIR, { recursive: true });
  const snapshot = JSON.stringify(cache, null, 2);
  writeQueue = writeQueue.then(() => fs.writeFile(DB_FILE, snapshot, "utf-8"));
  await writeQueue;
}

export const db = {
  async read(): Promise<Schema> {
    return ensureLoaded();
  },
  async save(): Promise<void> {
    await persist();
  },
};
