import { Marketplace } from "../types.js";

/**
 * Marketplace catalog. feePercent/limits reflect typical public seller-fee
 * ranges as of the app's design time — update here when a marketplace
 * changes its policy, or wire a live adapter to fetch them (see
 * src/adapters).
 */
export const MARKETPLACE_CATALOG: Omit<Marketplace, "id">[] = [
  {
    slug: "mercado-livre",
    name: "Mercado Livre",
    feePercent: 14,
    titleMaxLength: 60,
    descriptionMaxLength: 5000,
    maxKeywords: 12,
    notes: "Maior marketplace da América Latina. Forte em eletrônicos, casa e moda.",
  },
  {
    slug: "shopee",
    name: "Shopee",
    feePercent: 12,
    titleMaxLength: 100,
    descriptionMaxLength: 3000,
    maxKeywords: 15,
    notes: "Público jovem, sensível a preço. Forte em acessórios e itens de baixo ticket.",
  },
  {
    slug: "amazon-br",
    name: "Amazon Brasil",
    feePercent: 15,
    titleMaxLength: 200,
    descriptionMaxLength: 2000,
    maxKeywords: 10,
    notes: "Público exigente, valoriza marca e conteúdo rico. Boa margem em categorias premium.",
  },
  {
    slug: "magalu",
    name: "Magazine Luiza",
    feePercent: 13,
    titleMaxLength: 80,
    descriptionMaxLength: 4000,
    maxKeywords: 12,
    notes: "Forte presença física + digital. Bom para eletrodomésticos e móveis.",
  },
  {
    slug: "shein",
    name: "Shein",
    feePercent: 10,
    titleMaxLength: 100,
    descriptionMaxLength: 2500,
    maxKeywords: 15,
    notes: "Foco em moda e beleza de giro rápido, preço agressivo.",
  },
];
