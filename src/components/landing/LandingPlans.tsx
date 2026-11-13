"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { ALL_FEATURES, BASE_FEATURES, FEATURE_LABELS, PLANS, type BillingInterval } from "@/lib/billing/plans";
import { formatCurrency } from "@/utils/format";

// Planos da página inicial. Os botões levam ao cadastro (teste grátis); o pagamento é escolhido depois, dentro do sistema.
export function LandingPlans() {
  const [interval, setInterval] = useState<BillingInterval>("mensal");

  return (
    <div>
      <div className="mx-auto flex w-fit rounded-2xl bg-slate-100 p-1.5">
        {(["mensal", "anual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setInterval(option)}
            className={`rounded-xl px-5 py-2 text-sm font-bold transition ${interval === option ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            {option === "mensal" ? "Mensal" : "Anual"}
            {option === "anual" && <span className="ml-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">2 meses grátis</span>}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price = plan.fallbackPrice[interval];
          return (
            <div
              key={plan.id}
              className={`card relative flex flex-col ${plan.highlight ? "border-2 border-brand-500 shadow-[0_18px_50px_-20px_rgba(47,91,246,0.55)] md:-translate-y-2" : ""}`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold text-white">Mais escolhido</span>
              )}
              <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
              <p className="mt-4">
                <span className="text-3xl font-black text-slate-900">{formatCurrency(price)}</span>
                <span className="text-sm text-slate-500">/{interval === "mensal" ? "mês" : "ano"}</span>
              </p>
              {interval === "anual" && <p className="mt-1 text-xs text-slate-500">equivale a {formatCurrency(price / 12)}/mês</p>}
              <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">Dono + até {plan.collaboratorLimit} colaboradores</p>
              <ul className="mt-4 flex-1 space-y-2">
                {BASE_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check size={16} className="mt-0.5 flex-none text-success" /> {feature}
                  </li>
                ))}
                {ALL_FEATURES.map((feature) => {
                  const included = plan.features.includes(feature);
                  return (
                    <li key={feature} className={`flex items-start gap-2 text-sm ${included ? "text-slate-600" : "text-slate-300 line-through decoration-slate-200"}`}>
                      {included ? <Check size={16} className="mt-0.5 flex-none text-success" /> : <Minus size={16} className="mt-0.5 flex-none" />}
                      {FEATURE_LABELS[feature]}
                    </li>
                  );
                })}
              </ul>
              <Link href="/cadastro" className={`mt-5 w-full ${plan.highlight ? "btn-primary" : "btn-secondary"}`}>
                Testar grátis por 7 dias
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">Sem cartão para testar. No teste você usa todos os recursos. Mais de 30 colaboradores? Fale com a gente.</p>
    </div>
  );
}
