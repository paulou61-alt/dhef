"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registerExpense(input: { description: string; category: string; amount: number; expenseDate: string; notes?: string }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };
  if (!input.description.trim()) return { error: "Informe a descrição." };
  if (!input.amount || input.amount <= 0) return { error: "Informe um valor válido." };

  const { error } = await supabase.rpc("register_expense", {
    p_description: input.description.trim(),
    p_category: input.category || "outros",
    p_amount: input.amount,
    p_expense_date: input.expenseDate,
    p_notes: input.notes?.trim() || null,
  });
  if (error) return { error: "Não foi possível lançar a despesa." };

  revalidatePath("/despesas");
  revalidatePath("/financeiro");
  revalidatePath("/relatorios");
  revalidatePath("/");
  return {};
}
