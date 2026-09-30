import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { appUrl, getStripe, getSupabaseAdmin } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

// Abre o portal do Stripe, onde o cliente troca de plano, atualiza o cartão ou cancela.
export async function POST(request: Request) {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return NextResponse.json({ error: "Apenas o proprietário pode gerenciar a assinatura." }, { status: 403 });
  }

  const stripe = getStripe();
  const admin = getSupabaseAdmin();
  if (!stripe || !admin) {
    return NextResponse.json({ error: "Pagamentos ainda não configurados. Tente mais tarde." }, { status: 503 });
  }

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("owner_id", access.ownerId)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "Você ainda não tem uma assinatura." }, { status: 404 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${appUrl(request)}/planos`,
    locale: "pt-BR",
  });

  return NextResponse.json({ url: session.url });
}
