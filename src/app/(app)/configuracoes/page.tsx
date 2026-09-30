import Link from "next/link";
import { Check, CreditCard, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { getSubscription, planFeatures, planSummary } from "@/lib/billing/subscription";
import { ALL_FEATURES, FEATURE_LABELS } from "@/lib/billing/plans";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { ManageSubscriptionButton } from "@/components/billing/ManageSubscriptionButton";

export const dynamic = "force-dynamic";

const TONES = {
  brand: "bg-brand-50 text-brand-700",
  warning: "bg-amber-50 text-amber-800",
  success: "bg-emerald-50 text-emerald-700",
};

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const access = await getAccessContext();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).single()
    : { data: null as any };

  const subscription = access?.role === "owner" ? await getSubscription(access) : null;
  // Sem linha de assinatura (ex.: tabela ainda não criada no banco), o cartão continua aparecendo.
  const summary = planSummary(subscription) ?? { label: "Nenhum plano ativo", hint: null, tone: "warning" as const };
  const features = planFeatures(subscription);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500">Dados do seu negócio e da sua assinatura do Cobrei.</p>
      </div>

      {access?.role === "owner" && (
        <section id="plano" className="card scroll-mt-24">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <CreditCard size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900">Plano e assinatura</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TONES[summary.tone]}`}>{summary.label}</span>
                {summary.hint && <span className="text-xs text-slate-500">{summary.hint.replace(" · Assinar", "")}</span>}
              </div>
            </div>
          </div>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {ALL_FEATURES.map((feature) => {
              const included = features.has(feature);
              return (
                <li key={feature} className={`flex items-start gap-2 text-sm ${included ? "text-slate-700" : "text-slate-400"}`}>
                  {included ? <Check size={16} className="mt-0.5 flex-none text-success" /> : <Lock size={14} className="mt-0.5 flex-none" />}
                  {FEATURE_LABELS[feature]}
                </li>
              );
            })}
          </ul>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Link href="/planos" className="btn-primary inline-flex items-center justify-center">
              {subscription?.stripe_customer_id ? "Ver planos" : "Escolher um plano"}
            </Link>
            {subscription?.stripe_customer_id && <ManageSubscriptionButton />}
          </div>
        </section>
      )}

      <ProfileForm profile={profile} email={user?.email ?? ""} />
    </div>
  );
}
