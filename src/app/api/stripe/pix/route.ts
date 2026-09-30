import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import type Stripe from "stripe";
import { appUrl, getStripeForPix } from "@/lib/billing/stripe";
import { billingErrorResponse } from "@/lib/billing/errors";
import { preparePurchase } from "@/lib/billing/purchase";

export const dynamic = "force-dynamic";

// Dias para pagar cada fatura do Pix antes de ela ficar vencida.
const DAYS_UNTIL_DUE = 3;

// Assinatura por fatura paga no Pix: o Stripe gera uma fatura por período e envia por e-mail.
export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    return billingErrorResponse("pix", error);
  }
}

async function handle(request: Request) {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return NextResponse.json({ error: "Apenas o proprietário pode assinar um plano." }, { status: 403 });
  }

  const purchase = await preparePurchase(access, await request.json().catch(() => ({})));
  if (purchase instanceof NextResponse) return purchase;
  const { admin, price, customerId, trialEnd } = purchase;
  const stripe = getStripeForPix();
  if (!stripe) return NextResponse.json({ error: "Pagamentos ainda não configurados. Tente mais tarde." }, { status: 503 });

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    collection_method: "send_invoice",
    days_until_due: DAYS_UNTIL_DUE,
    payment_settings: {
      payment_method_types: ["pix"] as unknown as Stripe.SubscriptionCreateParams.PaymentSettings.PaymentMethodType[],
    },
    metadata: { owner_id: access.ownerId },
    ...(trialEnd ? { trial_end: trialEnd } : {}),
  });

  // Durante o teste grátis não há nada a pagar agora: a primeira fatura chega quando o teste acabar.
  if (trialEnd) {
    await admin.from("subscriptions").upsert(
      { owner_id: access.ownerId, stripe_customer_id: customerId, stripe_subscription_id: subscription.id, status: "trialing" },
      { onConflict: "owner_id" }
    );
    return NextResponse.json({ url: `${appUrl(request)}/planos?pix=agendado` });
  }

  // Sem teste: finaliza e envia a primeira fatura agora e leva o cliente direto para o QR Code.
  const invoiceId = typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id;
  if (!invoiceId) return NextResponse.json({ error: "O Stripe não gerou a fatura do Pix." }, { status: 500 });
  const invoice = await stripe.invoices.sendInvoice(invoiceId);

  // Até o Pix ser pago, a empresa fica aguardando (sem acesso liberado).
  await admin.from("subscriptions").upsert(
    { owner_id: access.ownerId, stripe_customer_id: customerId, stripe_subscription_id: subscription.id, status: "incomplete" },
    { onConflict: "owner_id" }
  );

  return NextResponse.json({ url: invoice.hosted_invoice_url });
}
