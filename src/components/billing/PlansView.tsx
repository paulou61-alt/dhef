"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, CreditCard, Loader2 } from "lucide-react";
import { PLANS, lookupKey, type BillingInterval, type PlanId } from "@/lib/billing/plans";
import { formatCurrency, formatDate } from "@/utils/format";

type Props = {
  status: string | null;
  currentPlan: PlanId | null;
  currentInterval: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialDays: number | null;
  hasCustomer: boolean;
  blocked: boolean;
  success: boolean;
  prices: Record<string, number>;
};

const FEATURES = [
  "Fichas numeradas e clientes ilimitados",
  "Vendas, recebimentos e cobrança no WhatsApp",
  "Modo offline para a equipe na rua",
  "Relatórios e controle de vales",
];

const SUBSCRIBED_STATUSES = new Set(["active", "trialing", "past_due"]);

async function postForUrl(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || "Não foi possível abrir o pagamento.");
  return data.url as string;
}

export function PlansView(props: Props) {
  const [interval, setInterval] = useState<BillingInterval>(props.currentInterval === "anual" ? "anual" : "mensal");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscribed = props.status ? SUBSCRIBED_STATUSES.has(props.status) : false;

  async function go(key: string, path: string, body?: unknown) {
    setError(null);
    setLoading(key);
    try {
      window.location.href = await postForUrl(path, body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o pagamento.");
      setLoading(null);
    }
  }

  const priceOf = (plan: (typeof PLANS)[number]) => props.prices[lookupKey(plan.id, interval)] ?? plan.fallbackPrice[interval];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Escolha o plano do seu negócio</h1>
        <p className="mt-2 text-sm text-slate-500">Todos os planos têm todas as funções. A diferença é o tamanho da equipe.</p>
      </div>

      {props.success && (
        <StatusBox tone="success" icon={<CheckCircle2 size={20} />}>
          Pagamento recebido! Sua assinatura será ativada em instantes. Se ainda aparecer como pendente, atualize a página.
        </StatusBox>
      )}
      {props.blocked && !props.success && (
        <StatusBox tone="danger" icon={<AlertTriangle size={20} />}>
          {props.status === "trial"
            ? "Seu teste grátis terminou. Escolha um plano para continuar usando o Cobrei. Seus dados estão guardados."
            : "Sua assinatura não está ativa. Escolha um plano ou atualize o pagamento para voltar a usar o Cobrei. Seus dados estão guardados."}
        </StatusBox>
      )}
      {props.trialDays !== null && !props.blocked && (
        <StatusBox tone="info" icon={<Clock size={20} />}>
          Você está no teste grátis: {props.trialDays === 1 ? "falta 1 dia" : `faltam ${props.trialDays} dias`}. Assine agora e só pague quando o teste acabar.
        </StatusBox>
      )}
      {props.status === "cortesia" && (
        <StatusBox tone="success" icon={<CheckCircle2 size={20} />}>Sua conta tem acesso de cortesia, sem cobrança.</StatusBox>
      )}
      {props.status === "past_due" && (
        <StatusBox tone="danger" icon={<AlertTriangle size={20} />}>
          Não conseguimos cobrar a última mensalidade. Atualize a forma de pagamento em &quot;Gerenciar assinatura&quot; para não perder o acesso.
        </StatusBox>
      )}

      {subscribed && (
        <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Seu plano</p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {PLANS.find((plan) => plan.id === props.currentPlan)?.name ?? "Assinatura"}
              {props.currentInterval ? <span className="text-sm font-medium text-slate-500"> · {props.currentInterval}</span> : null}
            </p>
            {props.periodEnd && (
              <p className="mt-0.5 text-xs text-slate-500">
                {props.cancelAtPeriodEnd ? "Cancelada. Acesso até " : props.status === "trialing" ? "Primeira cobrança em " : "Próxima cobrança em "}
                {formatDate(props.periodEnd)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => go("portal", "/api/stripe/portal")}
            disabled={loading !== null}
            className="btn-primary inline-flex !w-auto items-center justify-center gap-2 px-5"
          >
            {loading === "portal" ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
            Gerenciar assinatura
          </button>
        </div>
      )}

      {!subscribed && (
        <>
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

          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => {
              const price = priceOf(plan);
              const key = `checkout-${plan.id}`;
              return (
                <div
                  key={plan.id}
                  className={`card relative flex flex-col ${plan.highlight ? "border-2 border-brand-500 shadow-[0_18px_50px_-20px_rgba(47,91,246,0.55)]" : ""}`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold text-white">Mais escolhido</span>
                  )}
                  <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                  <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
                  <p className="mt-4">
                    <span className="text-3xl font-bold text-slate-900">{formatCurrency(price)}</span>
                    <span className="text-sm text-slate-500">/{interval === "mensal" ? "mês" : "ano"}</span>
                  </p>
                  {interval === "anual" && (
                    <p className="mt-1 text-xs text-slate-500">equivale a {formatCurrency(price / 12)}/mês</p>
                  )}
                  <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
                    Dono + até {plan.collaboratorLimit} colaboradores
                  </p>
                  <ul className="mt-4 flex-1 space-y-2">
                    {FEATURES.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                        <Check size={16} className="mt-0.5 flex-none text-success" /> {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => go(key, "/api/stripe/checkout", { plan: plan.id, interval })}
                    disabled={loading !== null}
                    className={`mt-5 inline-flex w-full items-center justify-center gap-2 ${plan.highlight ? "btn-primary" : "btn-secondary"}`}
                  >
                    {loading === key && <Loader2 size={16} className="animate-spin" />}
                    Assinar {plan.name}
                  </button>
                </div>
              );
            })}
          </div>

          {props.hasCustomer && (
            <p className="text-center text-sm text-slate-500">
              Já assinou antes?{" "}
              <button type="button" onClick={() => go("portal", "/api/stripe/portal")} className="font-semibold text-brand-600">
                Ver faturas e forma de pagamento
              </button>
            </p>
          )}
        </>
      )}

      {error && <p className="mx-auto max-w-md rounded-xl bg-danger/10 px-4 py-3 text-center text-sm text-danger">{error}</p>}

      <p className="text-center text-xs text-slate-400">
        Pagamento seguro processado pelo Stripe. Cancele quando quiser. Mais de 30 colaboradores? Fale com a gente.
      </p>
    </div>
  );
}

function StatusBox({ tone, icon, children }: { tone: "success" | "danger" | "info"; icon: React.ReactNode; children: React.ReactNode }) {
  const styles = {
    success: "border-success/20 bg-success/5 text-success",
    danger: "border-danger/20 bg-danger/5 text-danger",
    info: "border-brand-200 bg-brand-50 text-brand-700",
  }[tone];
  return (
    <div className={`mx-auto flex max-w-3xl items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${styles}`}>
      <span className="mt-0.5 flex-none">{icon}</span>
      <p className="text-slate-700">{children}</p>
    </div>
  );
}
