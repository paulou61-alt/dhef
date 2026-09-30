// Planos do Cobrei. Os preços de verdade ficam no Stripe e são achados pelo lookup key;
// os valores aqui só aparecem se o Stripe não responder.

export type PlanId = "essencial" | "profissional" | "equipe";
export type BillingInterval = "mensal" | "anual";

export interface Plan {
  id: PlanId;
  name: string;
  collaboratorLimit: number;
  description: string;
  fallbackPrice: Record<BillingInterval, number>;
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "essencial",
    name: "Essencial",
    collaboratorLimit: 3,
    description: "Para quem está começando com uma equipe pequena.",
    fallbackPrice: { mensal: 79, anual: 790 },
  },
  {
    id: "profissional",
    name: "Profissional",
    collaboratorLimit: 10,
    description: "Para negócios com vendedores e cobradores na rua.",
    fallbackPrice: { mensal: 129, anual: 1290 },
    highlight: true,
  },
  {
    id: "equipe",
    name: "Equipe",
    collaboratorLimit: 30,
    description: "Para operações maiores, com muitas carteiras.",
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
