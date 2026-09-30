"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, Clock, CreditCard, Loader2, Minus } from "lucide-react";
import { ALL_FEATURES, BASE_FEATURES, FEATURE_LABELS, PLANS, lookupKey, type BillingInterval, type PlanId } from "@/lib/billing/plans";
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
  /** Assinou com Pix durante o teste grátis: a primeira fatura chega quando o teste acabar. */
  pixScheduled?: boolean;
  prices: Record<string, number>;
};


const SUBSCRIBED_STATUSES = new Set(["active", "trialing", "past_due"]);

async function postForUrl(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || `Não foi possível abrir o pagamento (erro ${response.status}).`);
  return data.url as string;
}

export function PlansView(props: Props) {
  const [interval, setInterval] = useState<BillingInterval>(props.currentInterval === "anual" ? "anual" : "mensal");
  const [method, setMethod] = useState<"cartao" | "pix">("cartao");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscribed = props.status ? SUBSCRIBED_STATUSES.has(props.status) : false;
  const router = useRouter();
  const [confirmationTimedOut, setConfirmationTimedOut] = useState(false);
  const waitingConfirmation = props.success && !subscribed && !confirmationTimedOut;
  // Assinatura por Pix criada, mas a primeira fatura ainda não foi paga.
  const awaitingPix = props.status === "incomplete";

  // Depois do pagamento, o Stripe avisa o sistema em alguns segundos: recarrega os dados até a assinatura aparecer.
  // Para o Pix, a pessoa paga em outra aba, então esperamos mais tempo.
  useEffect(() => {
    if (!waitingConfirmation && !awaitingPix) return;
    const maxAttempts = awaitingPix ? 60 : 10;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= maxAttempts) {
        window.clearInterval(timer);
        if (!awaitingPix) setConfirmationTimedOut(true);
      }
    }, awaitingPix ? 5000 : 3000);
    return () => window.clearInterval(timer);
  }, [waitingConfirmation, awaitingPix, router]);

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
        <p className="mt-2 text-sm text-slate-500">Comece pelo essencial e evolua conforme o negócio cresce. Troque de plano quando quiser.</p>
      </div>

      {props.success && (
        <StatusBox tone="success" icon={<CheckCircle2 size={20} />}>
          {subscribed
            ? "Pagamento confirmado! Sua assinatura está ativa."
            : waitingConfirmation
              ? "Pagamento recebido! Confirmando sua assinatura com o Stripe..."
              : "Pagamento recebido, mas a confirmação ainda não chegou. Atualize a página em alguns minutos; se continuar assim, fale com o suporte."}
        </StatusBox>
      )}
      {awaitingPix && (
        <div className="mx-auto max-w-3xl rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4 text-sm">
          <div className="flex items-start gap-3">
            <Clock size={20} className="mt-0.5 flex-none text-brand-600" />
            <div className="min-w-0 flex-1 text-slate-700">
              <p className="font-semibold text-slate-900">Aguardando o pagamento do Pix</p>
              <p className="mt-1">Assim que o Pix for pago, sua assinatura é ativada automaticamente (normalmente em menos de 1 minuto). A fatura também foi enviada para o seu e-mail.</p>
              <button
                type="button"
                onClick={() => go("pending", "/api/stripe/pending-invoice")}
                disabled={loading !== null}
                className="btn-primary mt-3 inline-flex !w-auto items-center justify-center gap-2 px-5"
              >
                {loading === "pending" && <Loader2 size={16} className="animate-spin" />}
                Abrir fatura do Pix
              </button>
            </div>
          </div>
        </div>
      )}
      {props.pixScheduled && (
        <StatusBox tone="success" icon={<CheckCircle2 size={20} />}>
          Assinatura com Pix confirmada! Você continua no teste grátis e recebe a primeira fatura por e-mail quando ele acabar.
        </StatusBox>
      )}
      {props.blocked && !props.success && !awaitingPix && (
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

      {!subscribed && !waitingConfirmation && (
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

          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto flex w-fit rounded-2xl bg-slate-100 p-1.5">
              {([["cartao", "Cartão de crédito"], ["pix", "Pix"]] as const).map(([option, label]) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMethod(option)}
                  className={`rounded-xl px-5 py-2 text-sm font-bold transition ${method === option ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {method === "pix"
                ? `Você recebe uma fatura por e-mail a cada ${interval === "mensal" ? "mês" : "ano"} e paga pelo Pix em até 3 dias. Sem pagamento, o acesso é suspenso.`
                : "Cobrança automática no cartão. Cancele quando quiser."}
            </p>
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
                  <button
                    type="button"
                    onClick={() => go(key, method === "pix" ? "/api/stripe/pix" : "/api/stripe/checkout", { plan: plan.id, interval })}
                    disabled={loading !== null}
                    className={`mt-5 inline-flex w-full items-center justify-center gap-2 ${plan.highlight ? "btn-primary" : "btn-secondary"}`}
                  >
                    {loading === key && <Loader2 size={16} className="animate-spin" />}
                    Assinar {plan.name}{method === "pix" ? " com Pix" : ""}
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
        Pagamento seguro processado pelo Stripe, no cartão ou no Pix. Cancele quando quiser. Mais de 30 colaboradores? Fale com a gente.
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
