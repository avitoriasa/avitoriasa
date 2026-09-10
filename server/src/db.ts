import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AppSettings,
  Marketplace,
  OptimizationLogEntry,
  Order,
  Product,
  ProductMarketplaceConnection,
  RecommendationResult,
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
  settings: AppSettings;
}

const defaultSettings: AppSettings = {
  aiProvider: (process.env.AI_PROVIDER as "ollama" | "heuristic") || "heuristic",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL || "llama3",
  optimizationIntervalHours: Number(process.env.OPTIMIZATION_INTERVAL_HOURS) || 6,
  optimizationCooldownHours: Number(process.env.OPTIMIZATION_COOLDOWN_HOURS) || 24,
  // Placeholder — não é uma cotação ao vivo. Atualize em Configurações ou via USD_TO_BRL_RATE.
  usdToBrlRate: Number(process.env.USD_TO_BRL_RATE) || 5.3,
};

function emptySchema(): Schema {
  return {
    products: [],
    marketplaces: [],
    connections: [],
    recommendations: [],
    optimizationLogs: [],
    orders: [],
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
