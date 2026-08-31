"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registerPayment(input: {
  installmentId: string;
  amount: number;
  paymentMethod: "pix" | "dinheiro" | "cartao";
  paymentDate: string;
  notes?: string;
}): Promise<{ error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };
  if (!input.amount || input.amount <= 0) return { error: "Informe um valor válido." };

  const { error } = await supabase.rpc("register_payment", {
    p_installment_id: input.installmentId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_payment_date: input.paymentDate,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    if (error.message.includes("maior que o saldo")) return { error: "O valor informado é maior que o saldo da parcela." };
    return { error: "Não foi possível registrar o recebimento." };
  }

  revalidatePath("/receber");
  revalidatePath("/financeiro");
  revalidatePath("/relatorios");
  revalidatePath("/fichas");
  revalidatePath("/");
  return {};
}
