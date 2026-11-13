import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { CHECKOUT_LINKS, PLANS, type BillingInterval, type PlanId } from "@/lib/billing/plans";

// Aviso (webhook) que a Kiwify manda a cada evento de venda ou assinatura.
// Os campos vêm com nomes diferentes conforme o evento, então tudo é opcional.
export interface KiwifyPayload {
  order_id?: string;
  order_status?: string;
  webhook_event_type?: string;
  checkout_link?: string;
  Customer?: { email?: string; full_name?: string };
  Subscription?: {
    id?: string;
    status?: string;
    next_payment?: string;
    plan?: { name?: string; frequency?: string };
  };
  TrackingParameters?: { sck?: string | null; src?: string | null };
}

export type KiwifyAction = "liberar" | "cancelar" | "cortar" | "ignorar";

/** Confere a assinatura do aviso: HMAC-SHA1 do corpo com o token do webhook. */
export function validSignature(rawBody: string, signature: string | null, token: string) {
  if (!signature) return false;
  const candidates = [rawBody];
  try {
    candidates.push(JSON.stringify(JSON.parse(rawBody)));
  } catch {
    return false;
  }
  const received = Buffer.from(signature.trim().toLowerCase());
  return candidates.some((body) => {
    const expected = Buffer.from(createHmac("sha1", token).update(body).digest("hex"));
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}

/** O que fazer com o aviso. */
export function actionFor(payload: KiwifyPayload): KiwifyAction {
  const event = (payload.webhook_event_type ?? "").toLowerCase();
  const status = (payload.order_status ?? "").toLowerCase();

  if (["order_refunded", "chargeback"].includes(event) || ["refunded", "chargedback"].includes(status)) return "cortar";
  if (event === "subscription_canceled") return "cancelar";
  if (["order_approved", "subscription_renewed"].includes(event)) return "liberar";
  if (!event && status === "paid") return "liberar";
  // Carrinho abandonado, compra recusada, boleto/Pix gerado, assinatura atrasada: o acesso segue até a data já paga.
  return "ignorar";
}

const LINK_TO_PLAN = new Map<string, { plan: PlanId; interval: BillingInterval }>();
for (const [plan, links] of Object.entries(CHECKOUT_LINKS) as [PlanId, Record<BillingInterval, string>][]) {
  for (const [interval, link] of Object.entries(links) as [BillingInterval, string][]) {
    const code = link.trim().split("/").filter(Boolean).pop();
    if (code) LINK_TO_PLAN.set(code, { plan, interval });
  }
}

/** Descobre o plano comprado: pelo link de pagamento usado ou, se não der, pelo nome do plano na Kiwify. */
export function planFrom(payload: KiwifyPayload): { plan: PlanId | null; interval: BillingInterval | null } {
  const code = (payload.checkout_link ?? "").trim().split("/").filter(Boolean).pop();
  const fromLink = code ? LINK_TO_PLAN.get(code) : undefined;
  if (fromLink) return fromLink;

  const name = `${payload.Subscription?.plan?.name ?? ""}`.toLowerCase();
  const plan = PLANS.find((item) => name.includes(item.id))?.id ?? null;
  const frequency = (payload.Subscription?.plan?.frequency ?? "").toLowerCase();
  const interval: BillingInterval | null = /year|anual|annual/.test(frequency) ? "anual" : /month|mensal/.test(frequency) ? "mensal" : null;
  return { plan, interval };
}

const DAY = 24 * 60 * 60 * 1000;
// Folga depois do vencimento para a renovação da Kiwify chegar sem bloquear a pessoa.
const GRACE_DAYS = 3;

/** Até quando o acesso fica liberado depois de um pagamento. */
export function paidUntil(payload: KiwifyPayload, interval: BillingInterval | null, now = Date.now()) {
  const next = payload.Subscription?.next_payment ? new Date(payload.Subscription.next_payment).getTime() : NaN;
  const base = Number.isFinite(next) && next > now ? next : now + (interval === "anual" ? 365 : 31) * DAY;
  return new Date(base + GRACE_DAYS * DAY).toISOString();
}
