import { FxMethod } from "../types.js";

/**
 * Reference-only comparison of ways to pay an overseas supplier. These are
 * typical spreads/observations, NOT live rates — banks, fintechs and IOF
 * rules change; confirm the current spread and tax treatment with your
 * bank/fintech and accountant before choosing a method for a real payment.
 */
export const FX_METHODS: FxMethod[] = [
  {
    id: "conta-pj-internacional",
    name: "Conta PJ internacional (ex.: Wise Business, Nomad Empresas)",
    typicalSpreadPercent: 1,
    notes:
      "Geralmente o spread cambial mais baixo para pagamentos a fornecedores no exterior. Confirme se a conta emite o contrato de câmbio exigido para importação formal via CNPJ.",
  },
  {
    id: "remessa-bancaria-swift",
    name: "Remessa bancária tradicional (SWIFT via banco)",
    typicalSpreadPercent: 3,
    notes: "Spread cambial mais alto que fintechs, além de tarifa fixa por remessa. Mais burocrático, porém aceito por qualquer fornecedor.",
  },
  {
    id: "cartao-credito-internacional-pj",
    name: "Cartão de crédito corporativo internacional",
    typicalSpreadPercent: 4,
    notes: "Prático para valores menores/amostras, mas costuma ter o pior câmbio e não gera o contrato de câmbio que a importação formal exige.",
  },
  {
    id: "carta-de-credito",
    name: "Carta de crédito (L/C) via banco",
    typicalSpreadPercent: 2,
    notes: "Mais segura para pedidos grandes com fornecedor novo (o banco só libera o pagamento após confirmação do embarque), mas tem custo bancário adicional pela garantia.",
  },
];
