import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { appUrl, getStripe, getSupabaseAdmin } from "@/lib/billing/stripe";
import { billingErrorResponse } from "@/lib/billing/errors";
import { lookupKey, type BillingInterval, type PlanId } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

const PLAN_IDS = new Set(["essencial", "profissional", "equipe"]);
const INTERVALS = new Set(["mensal", "anual"]);
// O Stripe exige que o fim do teste esteja pelo menos 48 horas no futuro.
const MIN_TRIAL_MS = 49 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    return billingErrorResponse("checkout", error);
  }
}

async function handle(request: Request) {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return NextResponse.json({ error: "Apenas o proprietário pode assinar um plano." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const plan = String(body?.plan ?? "");
  const interval = String(body?.interval ?? "");
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
  const trialEnd = subscription?.status === "trial" && subscription.trial_ends_at
    ? new Date(subscription.trial_ends_at).getTime()
    : 0;
  const keepTrial = trialEnd - Date.now() > MIN_TRIAL_MS;

  const baseUrl = appUrl(request);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: access.ownerId,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: {
      metadata: { owner_id: access.ownerId },
      ...(keepTrial ? { trial_end: Math.floor(trialEnd / 1000) } : {}),
    },
    allow_promotion_codes: true,
    locale: "pt-BR",
    success_url: `${baseUrl}/planos?sucesso=1`,
    cancel_url: `${baseUrl}/planos`,
  });

  return NextResponse.json({ url: session.url });
}
