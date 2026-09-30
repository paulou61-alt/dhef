import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, getSupabaseAdmin } from "@/lib/billing/stripe";
import { parseLookupKey } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

function toIso(seconds: number | null | undefined) {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function findOwnerId(admin: Admin, subscription: Stripe.Subscription) {
  if (subscription.metadata?.owner_id) return subscription.metadata.owner_id;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { data } = await admin.from("subscriptions").select("owner_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.owner_id ?? null;
}

// Copia o estado da assinatura do Stripe para a tabela public.subscriptions.
async function syncSubscription(admin: Admin, subscription: Stripe.Subscription, ownerIdHint?: string | null) {
  const ownerId = ownerIdHint || (await findOwnerId(admin, subscription));
  if (!ownerId) return;

  const item = subscription.items.data[0];
  const parsed = parseLookupKey(item?.price?.lookup_key);
  // Versões novas da API guardam o fim do período no item da assinatura.
  const periodEnd = (subscription as { current_period_end?: number }).current_period_end
    ?? (item as { current_period_end?: number } | undefined)?.current_period_end;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  await admin.from("subscriptions").upsert(
    {
      owner_id: ownerId,
      status: subscription.status,
      plan: parsed?.plan ?? null,
      billing_interval: parsed?.interval ?? null,
      current_period_end: toIso(periodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
    },
    { onConflict: "owner_id" }
  );
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !admin || !secret) {
    return NextResponse.json({ error: "Pagamentos não configurados." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Assinatura do webhook inválida." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(admin, subscription, session.client_reference_id);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(admin, event.data.object);
      break;
    case "customer.subscription.deleted": {
      // Só encerra se for a assinatura atual da empresa (ignora assinaturas antigas).
      const subscription = event.data.object;
      await admin
        .from("subscriptions")
        .update({ status: "canceled", cancel_at_period_end: false })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
