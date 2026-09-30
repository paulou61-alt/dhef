import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ALL_FEATURES, PLANS, TRIAL_COLLABORATOR_LIMIT, type Feature, type PlanId } from "@/lib/billing/plans";
import { getAccessContext, type AccessContext } from "@/lib/access";

export interface Subscription {
  owner_id: string;
  status: string;
  plan: PlanId | null;
  billing_interval: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
}

// Status do Stripe que mantêm o acesso. past_due continua liberado enquanto o Stripe tenta cobrar de novo.
const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function getSubscription(access: AccessContext): Promise<Subscription | null> {
  const supabase = createClient();
  const select = () =>
    supabase
      .from("subscriptions")
      .select("owner_id, status, plan, billing_interval, trial_ends_at, current_period_end, cancel_at_period_end, stripe_customer_id")
      .eq("owner_id", access.ownerId)
      .maybeSingle();

  const { data, error } = await select();
  // Tabela ainda não criada no banco: não bloqueia ninguém.
  if (error) return null;
  if (data || access.role !== "owner") return data as Subscription | null;

  // Primeiro acesso do dono: começa o teste grátis.
  await supabase.rpc("start_trial");
  const { data: created } = await select();
  return created as Subscription | null;
}

export function hasAccess(subscription: Subscription | null) {
  // Sem linha (tabela ainda não criada ou erro de leitura): acesso liberado para não travar ninguém.
  if (!subscription) return true;
  if (subscription.status === "cortesia") return true;
  if (subscription.status === "trial") {
    return Boolean(subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() > Date.now());
  }
  return ACTIVE_STRIPE_STATUSES.has(subscription.status);
}

export function trialDaysLeft(subscription: Subscription | null) {
  if (subscription?.status !== "trial" || !subscription.trial_ends_at) return null;
  const ms = new Date(subscription.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function collaboratorLimit(subscription: Subscription | null) {
  if (!subscription || subscription.status === "cortesia") return Infinity;
  if (subscription.status === "trial") return TRIAL_COLLABORATOR_LIMIT;
  return PLANS.find((plan) => plan.id === subscription.plan)?.collaboratorLimit ?? TRIAL_COLLABORATOR_LIMIT;
}

/** Recursos liberados para a empresa. Teste grátis e cortesia têm tudo. */
export function planFeatures(subscription: Subscription | null): Set<Feature> {
  if (!subscription || subscription.status === "cortesia" || subscription.status === "trial") return new Set(ALL_FEATURES);
  const plan = PLANS.find((item) => item.id === subscription.plan);
  return new Set(plan ? plan.features : ALL_FEATURES);
}

/** Confere na hora (em Server Actions e rotas) se a empresa de quem está logado tem o recurso. */
export async function companyHasFeature(feature: Feature) {
  const access = await getAccessContext();
  if (!access) return false;
  return planFeatures(await getSubscription(access)).has(feature);
}

/** Resumo do plano para o menu e as Configurações. */
export function planSummary(subscription: Subscription | null): { label: string; hint: string | null; tone: "brand" | "warning" | "success" } | null {
  if (!subscription) return null;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null);
  const name = PLANS.find((plan) => plan.id === subscription.plan)?.name;

  switch (subscription.status) {
    case "cortesia":
      return { label: "Acesso cortesia", hint: "Sem cobrança", tone: "success" };
    case "trial": {
      const days = trialDaysLeft(subscription) ?? 0;
      return { label: "Teste grátis", hint: `${days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`} · Assinar`, tone: days <= 2 ? "warning" : "brand" };
    }
    case "past_due":
      return { label: "Pagamento pendente", hint: "Atualize a forma de pagamento", tone: "warning" };
    case "active":
    case "trialing": {
      const end = date(subscription.current_period_end);
      const hint = subscription.cancel_at_period_end
        ? `Cancelado · acesso até ${end}`
        : subscription.status === "trialing"
          ? `Primeira cobrança em ${end}`
          : `Renova em ${end}`;
      return { label: `Plano ${name ?? "ativo"}`, hint: end ? hint : null, tone: subscription.cancel_at_period_end ? "warning" : "brand" };
    }
    default:
      return { label: "Assinatura inativa", hint: "Escolha um plano", tone: "warning" };
  }
}
