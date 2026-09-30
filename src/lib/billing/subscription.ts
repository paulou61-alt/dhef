import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AccessContext } from "@/lib/access";
import { PLANS, TRIAL_COLLABORATOR_LIMIT, type PlanId } from "@/lib/billing/plans";

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
