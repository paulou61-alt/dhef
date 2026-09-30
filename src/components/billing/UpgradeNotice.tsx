import Link from "next/link";
import { Lock } from "lucide-react";
import { FEATURE_LABELS, cheapestPlanWith, type Feature } from "@/lib/billing/plans";

// Mostrado no lugar de uma tela quando o plano da empresa não inclui o recurso.
export function UpgradeNotice({ feature, isOwner }: { feature: Feature; isOwner: boolean }) {
  const plan = cheapestPlanWith(feature);
  return (
    <div className="card mx-auto max-w-md py-10 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Lock size={22} />
      </span>
      <h1 className="mt-4 text-lg font-bold text-slate-900">Disponível no plano {plan.name}</h1>
      <p className="mt-2 text-sm text-slate-500">{FEATURE_LABELS[feature]}.</p>
      {isOwner ? (
        <Link href="/planos" className="btn-primary mt-6 inline-flex !w-auto items-center justify-center px-6">
          Ver planos
        </Link>
      ) : (
        <p className="mt-4 text-xs text-slate-400">Fale com o responsável da empresa para liberar este recurso.</p>
      )}
    </div>
  );
}
