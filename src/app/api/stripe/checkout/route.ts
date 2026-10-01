import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { appUrl } from "@/lib/billing/stripe";
import { billingErrorResponse } from "@/lib/billing/errors";
import { preparePurchase } from "@/lib/billing/purchase";

export const dynamic = "force-dynamic";

// Assinatura com cartão: cobrança automática todo mês pelo Stripe Checkout.
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

  const purchase = await preparePurchase(access, await request.json().catch(() => ({})));
  if (purchase instanceof NextResponse) return purchase;
  const { stripe, price, customerId, trialEnd, paidUntilMs } = purchase;

  // O Stripe só aceita uma data de fim de teste a pelo menos 48 h. Quando faltar menos que isso,
  // usa dias inteiros de teste (arredondando para cima) para não cobrar antes do fim do período grátis.
  const remainingMs = paidUntilMs - Date.now();
  const trialDays = !trialEnd && remainingMs > 0 ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : null;

  const baseUrl = appUrl(request);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: access.ownerId,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: {
      metadata: { owner_id: access.ownerId },
      ...(trialEnd ? { trial_end: trialEnd } : trialDays ? { trial_period_days: trialDays } : {}),
    },
    allow_promotion_codes: true,
    locale: "pt-BR",
    success_url: `${baseUrl}/planos?sucesso=1`,
    cancel_url: `${baseUrl}/planos`,
  });

  return NextResponse.json({ url: session.url });
}
