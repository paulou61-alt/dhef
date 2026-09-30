// Planos do Cobrei. Os preços de verdade ficam no Stripe e são achados pelo lookup key;
// os valores aqui só aparecem se o Stripe não responder.

export type PlanId = "essencial" | "profissional" | "equipe";
export type BillingInterval = "mensal" | "anual";

// Recursos que dependem do plano. Tudo o que não está aqui vem em todos os planos.
export type Feature = "financeiro" | "relatorios" | "vales" | "offline" | "permissoes";

export const FEATURE_LABELS: Record<Feature, string> = {
  financeiro: "Financeiro: caixa, lucro e contas a receber",
  relatorios: "Relatório mensal em PDF",
  vales: "Controle de vales dos colaboradores",
  offline: "Modo offline para a equipe na rua",
  permissoes: "Escolher o que cada colaborador vê",
};

export const ALL_FEATURES = Object.keys(FEATURE_LABELS) as Feature[];

/** Recursos presentes em todos os planos. */
export const BASE_FEATURES = [
  "Vendas, clientes e fichas numeradas",
  "Receber, cobranças e cobrança no WhatsApp",
  "Controle de estoque e despesas",
];

export interface Plan {
  id: PlanId;
  name: string;
  collaboratorLimit: number;
  description: string;
  features: Feature[];
  fallbackPrice: Record<BillingInterval, number>;
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "essencial",
    name: "Essencial",
    collaboratorLimit: 3,
    description: "O essencial para vender no crediário e cobrar em dia.",
    features: [],
    fallbackPrice: { mensal: 79, anual: 790 },
  },
  {
    id: "profissional",
    name: "Profissional",
    collaboratorLimit: 10,
    description: "Controle financeiro completo e equipe trabalhando offline.",
    features: ["financeiro", "relatorios", "vales", "offline"],
    fallbackPrice: { mensal: 129, anual: 1290 },
    highlight: true,
  },
  {
    id: "equipe",
    name: "Equipe",
    collaboratorLimit: 30,
    description: "Para operações maiores, com controle total da equipe.",
    features: ["financeiro", "relatorios", "vales", "offline", "permissoes"],
    fallbackPrice: { mensal: 199, anual: 1990 },
  },
];

export const TRIAL_COLLABORATOR_LIMIT = 10;

export function lookupKey(plan: PlanId, interval: BillingInterval) {
  return `cobrei_${plan}_${interval}`;
}

export function parseLookupKey(key: string | null | undefined): { plan: PlanId; interval: BillingInterval } | null {
  const match = /^cobrei_(essencial|profissional|equipe)_(mensal|anual)$/.exec(key ?? "");
  return match ? { plan: match[1] as PlanId, interval: match[2] as BillingInterval } : null;
}

export const ALL_LOOKUP_KEYS = PLANS.flatMap((plan) => [lookupKey(plan.id, "mensal"), lookupKey(plan.id, "anual")]);

/** Plano mais barato que inclui o recurso (usado nos avisos de "disponível no plano ..."). */
export function cheapestPlanWith(feature: Feature): Plan {
  return PLANS.find((plan) => plan.features.includes(feature)) ?? PLANS[PLANS.length - 1];
}
