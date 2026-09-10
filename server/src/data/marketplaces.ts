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
  {
    slug: "tiktok-shop",
    name: "TikTok Shop",
    // Estrutura por faixa (jul/2026): <R$50 = 10%; >=R$50 = 6% + R$6 fixos por item.
    // Perfumes normalmente ficam na segunda faixa — confirme no painel de vendedor, pois muda com frequência.
    feePercent: 6,
    fixedFeeBrl: 6,
    titleMaxLength: 255,
    descriptionMaxLength: 3000,
    maxKeywords: 10,
    notes: "Vendas via vídeo curto/live/vitrine no app. Forte para produtos visuais e com apelo de conteúdo, como perfumaria.",
  },
  {
    slug: "youtube-shopping",
    name: "YouTube Shopping (Afiliados)",
    // Não é uma taxa cobrada PELA plataforma sobre a venda: é a comissão que
    // VOCÊ oferece aos criadores que marcam seu produto (~15% é a média do programa).
    // Requer loja própria (hoje, integração via Shopify + Google Merchant Center) —
    // a venda acontece no seu site, não "dentro" do YouTube.
    feePercent: 15,
    titleMaxLength: 150,
    descriptionMaxLength: 5000,
    maxKeywords: 10,
    notes:
      "Não é um marketplace tradicional: exige loja própria conectada ao Google Merchant Center (hoje, Shopify) e você define a comissão paga a criadores que marcam seu produto em vídeos. Repasse via AdSense, 60-120 dias após a compra.",
  },
];
