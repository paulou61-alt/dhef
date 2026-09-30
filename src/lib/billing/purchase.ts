import "server-only";

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { AccessContext } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { getStripe, getSupabaseAdmin } from "@/lib/billing/stripe";
import { lookupKey, type BillingInterval, type PlanId } from "@/lib/billing/plans";

const PLAN_IDS = new Set(["essencial", "profissional", "equipe"]);
const INTERVALS = new Set(["mensal", "anual"]);
// O Stripe exige que o fim do teste esteja pelo menos 48 horas no futuro.
const MIN_TRIAL_MS = 49 * 60 * 60 * 1000;

export interface PurchaseContext {
  stripe: Stripe;
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  price: Stripe.Price;
  customerId: string;
  /** Fim do teste grátis em segundos (Unix), quando ainda dá para mantê-lo. */
  trialEnd: number | null;
}

/**
 * Validações e dados comuns para assinar um plano (cartão ou Pix):
 * plano válido, Stripe configurado, sem assinatura ativa, preço e cliente do Stripe.
 */
export async function preparePurchase(access: AccessContext, body: unknown): Promise<PurchaseContext | NextResponse> {
  const input = body as { plan?: unknown; interval?: unknown } | null;
  const plan = String(input?.plan ?? "");
  const interval = String(input?.interval ?? "");
  if (!PLAN_IDS.has(plan) || !INTERVALS.has(interval)) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  if (!stripe || !admin) {
    return NextResponse.json({ error: "Pagamentos ainda não configurados. Tente mais tarde." }, { status: 503 });
  }

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("status, trial_ends_at, stripe_customer_id, stripe_subscription_id")
    .eq("owner_id", access.ownerId)
    .maybeSingle();

  if (subscription?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(subscription.status)) {
    return NextResponse.json({ error: "Você já tem uma assinatura. Use \"Gerenciar assinatura\" para trocar de plano." }, { status: 409 });
  }

  // Tentativa anterior de Pix ainda não paga: cancela para não gerar duas assinaturas.
  if (subscription?.stripe_subscription_id && subscription.status === "incomplete") {
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id).catch(() => undefined);
  }

  const { data: prices } = await stripe.prices.list({
    lookup_keys: [lookupKey(plan as PlanId, interval as BillingInterval)],
    active: true,
    limit: 1,
  });
  const price = prices[0];
  if (!price) return NextResponse.json({ error: "Preço não encontrado no Stripe." }, { status: 500 });

  let customerId = subscription?.stripe_customer_id ?? null;
  if (!customerId) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const customer = await stripe.customers.create({
      email: user?.email ?? undefined,
      name: access.name ?? undefined,
      metadata: { owner_id: access.ownerId },
    });
    customerId = customer.id;
    await admin
      .from("subscriptions")
      .upsert({ owner_id: access.ownerId, stripe_customer_id: customerId }, { onConflict: "owner_id" });
  }

  // Quem assina durante o teste grátis só começa a pagar quando o teste acabar.
  const trialEndMs = subscription?.status === "trial" && subscription.trial_ends_at
    ? new Date(subscription.trial_ends_at).getTime()
    : 0;
  const trialEnd = trialEndMs - Date.now() > MIN_TRIAL_MS ? Math.floor(trialEndMs / 1000) : null;

  return { stripe, admin, price, customerId, trialEnd };
}
