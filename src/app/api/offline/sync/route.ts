import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type IncomingOperation = {
  id: string;
  userId: string;
  type: "sale" | "payment" | "expense";
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

  const results = [] as Array<{ id: string; success: boolean; resultId?: string | null; error?: string }>;

  for (const operation of operations) {
    if (!operation?.id || operation.userId !== user.id) {
      results.push({ id: operation?.id ?? "invalid", success: false, error: "Esta operação pertence a outro acesso." });
      continue;
    }

    if (!["sale", "payment", "expense"].includes(operation.type)) {
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
      else if (raw.includes("maior que o saldo")) message = "O pagamento é maior que o saldo atual da parcela.";
      else if (raw.includes("Sessão expirada")) message = "Sessão expirada. Faça login novamente.";
      else if (raw.includes("Entrada")) message = raw;
      else if (raw.includes("duplicate") || raw.includes("unique")) message = "Existe um conflito com dados criados enquanto o aparelho estava offline.";
      results.push({ id: operation.id, success: false, error: message });
      continue;
    }

    const payload = (data ?? {}) as { resultId?: string | null };
    results.push({ id: operation.id, success: true, resultId: payload.resultId ?? null });
  }

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
