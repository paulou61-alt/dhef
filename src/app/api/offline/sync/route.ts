import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type IncomingOperation = {
  id: string;
  userId: string;
  type: "sale" | "payment" | "payment_purchase" | "expense";
  payload: Record<string, unknown>;
};

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  let body: { operations?: IncomingOperation[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const operations = Array.isArray(body.operations) ? body.operations.slice(0, 50) : [];
  if (!operations.length) return NextResponse.json({ results: [] });

  const results = [] as Array<{ id: string; success: boolean; resultId?: string | null; error?: string; warning?: string }>;

  for (const operation of operations) {
    if (!operation?.id || operation.userId !== user.id) {
      results.push({ id: operation?.id ?? "invalid", success: false, error: "Esta operação pertence a outro acesso." });
      continue;
    }

    if (!["sale", "payment", "payment_purchase", "expense"].includes(operation.type)) {
      results.push({ id: operation.id, success: false, error: "Tipo de operação inválido." });
      continue;
    }

    const { data, error } = await supabase.rpc("process_offline_operation", {
      p_operation_id: operation.id,
      p_operation_type: operation.type,
      p_payload: operation.payload,
    });

    if (error) {
      const raw = error.message || "";
      let message = "Não foi possível sincronizar esta operação.";
      if (raw.includes("Estoque insuficiente")) message = raw;
      else if (raw.includes("já está em uso por outro cliente")) message = raw;
      else if (raw.includes("saldo total em aberto")) message = "O pagamento é maior que tudo o que o cliente deve.";
      else if (raw.includes("maior que o saldo")) message = "O pagamento é maior que o saldo atual da parcela.";
      else if (raw.includes("Sessão expirada")) message = "Sessão expirada. Faça login novamente.";
      else if (raw.includes("Entrada")) message = raw;
      else if (raw.includes("carteira deste cobrador")) message = "Este cliente não pertence mais à carteira deste cobrador.";
      else if (raw.includes("duplicate") || raw.includes("unique")) message = "Existe um conflito com dados criados enquanto o aparelho estava offline.";
      results.push({ id: operation.id, success: false, error: message });
      continue;
    }

    const payload = (data ?? {}) as { resultId?: string | null; alreadyProcessed?: boolean };

    // Vendedor responsável escolhido pelo proprietário na Nova venda.
    const sellerId = operation.payload?.sellerId;
    if (operation.type === "sale" && !payload.alreadyProcessed && payload.resultId && typeof sellerId === "string" && sellerId) {
      const { error: sellerError } = await supabase.rpc("set_sale_seller", { p_sale_id: payload.resultId, p_collaborator_id: sellerId });
      if (sellerError) {
        results.push({
          id: operation.id,
          success: true,
          resultId: payload.resultId,
          warning: "Venda salva, mas não foi possível registrar o vendedor responsável.",
        });
        continue;
      }
    }

    // Cobrador escolhido pelo proprietário no recebimento ("Quem cobrou").
    const collectorId = operation.payload?.collectorId;
    if (
      (operation.type === "payment" || operation.type === "payment_purchase")
      && !payload.alreadyProcessed
      && typeof collectorId === "string"
      && collectorId
    ) {
      const { error: collectorError } = await supabase.rpc("set_payment_collector", {
        p_installment_id: operation.payload.installmentId,
        p_collector_id: collectorId,
      });
      if (collectorError) {
        results.push({
          id: operation.id,
          success: true,
          resultId: payload.resultId ?? null,
          warning: "Recebimento salvo, mas não foi possível registrar quem cobrou.",
        });
        continue;
      }
    }

    // Vencimento escolhido para o saldo que ficou em aberto depois do recebimento.
    const nextDueDate = operation.payload?.nextDueDate;
    if (
      (operation.type === "payment" || operation.type === "payment_purchase")
      && !payload.alreadyProcessed
      && typeof nextDueDate === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)
    ) {
      const { error: rescheduleError } = await supabase.rpc("reschedule_open_installment", {
        p_installment_id: operation.payload.installmentId,
        p_due_date: nextDueDate,
      });
      if (rescheduleError) {
        // O recebimento já foi gravado; só o novo vencimento não foi aplicado.
        results.push({
          id: operation.id,
          success: true,
          resultId: payload.resultId ?? null,
          warning: "Recebimento salvo, mas não foi possível alterar o vencimento. Ajuste a data na ficha do cliente.",
        });
        continue;
      }
    }

    results.push({ id: operation.id, success: true, resultId: payload.resultId ?? null });
  }

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
