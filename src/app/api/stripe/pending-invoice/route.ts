import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { getStripe, getSupabaseAdmin } from "@/lib/billing/stripe";
import { billingErrorResponse } from "@/lib/billing/errors";

export const dynamic = "force-dynamic";

// Reabre a fatura em aberto (Pix) da empresa, para quem fechou a página antes de pagar.
export async function POST() {
  try {
    const access = await getAccessContext();
    if (!access || access.role !== "owner") {
      return NextResponse.json({ error: "Apenas o proprietário pode pagar a assinatura." }, { status: 403 });
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
      return NextResponse.json({ error: "Nenhuma fatura encontrada." }, { status: 404 });
    }

    const { data: invoices } = await stripe.invoices.list({ customer: subscription.stripe_customer_id, status: "open", limit: 1 });
    const url = invoices[0]?.hosted_invoice_url;
    if (!url) return NextResponse.json({ error: "Não há fatura em aberto. Se você acabou de pagar, aguarde alguns instantes." }, { status: 404 });

    return NextResponse.json({ url });
  } catch (error) {
    return billingErrorResponse("pending-invoice", error);
  }
}
