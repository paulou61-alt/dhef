import "server-only";

import { NextResponse } from "next/server";

// Converte erros do Stripe em mensagens que ajudam a descobrir o problema de configuração.
export function billingErrorResponse(context: string, error: unknown) {
  const err = error as { type?: string; code?: string; message?: string; statusCode?: number };
  console.error(`[stripe:${context}]`, err?.type, err?.code, err?.message);

  let message = "Não foi possível falar com o Stripe. Tente novamente em instantes.";
  if (err?.type === "StripeAuthenticationError") {
    message = "A chave do Stripe (STRIPE_SECRET_KEY) está inválida. Confira se é a Secret key (sk_...) do mesmo modo (teste ou real) dos produtos.";
  } else if (err?.type === "StripePermissionError") {
    message = "A chave do Stripe não tem permissão para esta operação. Use a Secret key padrão (sk_...), não uma chave restrita.";
  } else if (err?.type === "StripeInvalidRequestError" && err.message) {
    message = `O Stripe recusou o pedido: ${err.message}`;
  } else if (err?.message) {
    message = `Erro ao falar com o Stripe: ${err.message}`;
  }

  return NextResponse.json({ error: message }, { status: 500 });
}
