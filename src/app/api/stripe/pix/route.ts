import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { appUrl } from "@/lib/billing/stripe";
import { billingErrorResponse } from "@/lib/billing/errors";
import { preparePurchase } from "@/lib/billing/purchase";
import { PLANS } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

// Tempo para pagar o QR Code do Pix antes de ele expirar.
const PIX_EXPIRES_SECONDS = 60 * 60;

/**
 * Plano pré-pago no Pix: um pagamento avulso que libera 1 mês (ou 1 ano) de acesso.
 * O webhook do Stripe confirma o pagamento e grava a nova data de vencimento.
 */
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
  const { stripe, price, customerId, plan, interval, paidUntilMs } = purchase;
  if (price.unit_amount == null) return NextResponse.json({ error: "Preço do plano sem valor no Stripe." }, { status: 500 });

  // O novo período começa quando o atual (teste grátis ou Pix já pago) terminar, para não perder dias.
  const periodEnd = new Date(Math.max(Date.now(), paidUntilMs));
  periodEnd.setMonth(periodEnd.getMonth() + (interval === "anual" ? 12 : 1));

  const planName = PLANS.find((item) => item.id === plan)?.name ?? plan;
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  const metadata = {
    kind: "cobrei_pix",
    owner_id: access.ownerId,
    plan,
    interval,
    period_end: periodEnd.toISOString(),
  };

  const baseUrl = appUrl(request);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    client_reference_id: access.ownerId,
    payment_method_types: ["pix"],
    payment_method_options: { pix: { expires_after_seconds: PIX_EXPIRES_SECONDS } },
    line_items: [{ quantity: 1, price_data: { currency: price.currency, unit_amount: price.unit_amount, product: productId } }],
    metadata,
    payment_intent_data: {
      description: `Cobrei ${planName} (${interval}) até ${periodEnd.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      metadata,
    },
    allow_promotion_codes: true,
    locale: "pt-BR",
    success_url: `${baseUrl}/planos?sucesso=1`,
    cancel_url: `${baseUrl}/planos`,
  });

  return NextResponse.json({ url: session.url });
}
