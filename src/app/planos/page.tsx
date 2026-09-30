import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAccessContext } from "@/lib/access";
import { getSubscription, hasAccess, trialDaysLeft } from "@/lib/billing/subscription";
import { getStripe } from "@/lib/billing/stripe";
import { ALL_LOOKUP_KEYS } from "@/lib/billing/plans";
import { BrandMark } from "@/components/brand/BrandMark";
import { PlansView } from "@/components/billing/PlansView";

export const dynamic = "force-dynamic";

// Busca os valores reais no Stripe; se não der, a tela usa os valores de referência.
async function loadPrices(): Promise<Record<string, number>> {
  const stripe = getStripe();
  if (!stripe) return {};
  try {
    const { data } = await stripe.prices.list({ lookup_keys: ALL_LOOKUP_KEYS, active: true, limit: 20 });
    return Object.fromEntries(
      data.filter((price) => price.lookup_key && price.unit_amount != null).map((price) => [price.lookup_key!, price.unit_amount! / 100])
    );
  } catch {
    return {};
  }
}

export default async function PlanosPage({ searchParams }: { searchParams: { sucesso?: string; pix?: string } }) {
  const access = await getAccessContext();
  if (!access) redirect("/login");

  const subscription = await getSubscription(access);
  const blocked = !hasAccess(subscription);
  const prices = access.role === "owner" ? await loadPrices() : {};

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top_right,_rgba(47,91,246,0.07),_transparent_28%),linear-gradient(to_bottom,_#f8fafc,_#f5f7fb)] px-4 py-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <p className="text-lg font-bold text-slate-900">Cobrei</p>
          </div>
          {!blocked && (
            <Link href={access.role === "owner" ? "/configuracoes#plano" : "/"} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700">
              <ChevronLeft size={17} /> Voltar ao sistema
            </Link>
          )}
        </div>

        {access.role !== "owner" ? (
          <div className="card mx-auto max-w-md text-center">
            <h1 className="text-lg font-bold text-slate-900">{blocked ? "Acesso suspenso" : "Plano da empresa"}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {blocked
                ? "A assinatura do Cobrei desta empresa não está ativa. Peça ao responsável para regularizar o plano."
                : "O plano é gerenciado pelo responsável da empresa."}
            </p>
          </div>
        ) : (
          <PlansView
            status={subscription?.status ?? null}
            currentPlan={subscription?.plan ?? null}
            currentInterval={subscription?.billing_interval ?? null}
            periodEnd={subscription?.current_period_end ?? null}
            cancelAtPeriodEnd={subscription?.cancel_at_period_end ?? false}
            trialDays={trialDaysLeft(subscription)}
            hasCustomer={Boolean(subscription?.stripe_customer_id)}
            blocked={blocked}
            success={searchParams.sucesso === "1"}
            pixScheduled={searchParams.pix === "agendado"}
            prices={prices}
          />
        )}
      </div>
    </div>
  );
}
