"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";

// Server Actions podem ser chamadas diretamente; o menu não basta para restringir o acesso.
async function isOwner() {
  const access = await getAccessContext();
  return access?.role === "owner";
}

export async function adjustStock(
  variantId: string,
  type: "entrada" | "saida" | "ajuste",
  quantity: number,
  reason: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };
  if (!(await isOwner())) return { error: "Apenas o proprietário pode alterar o estoque." };

  if (!quantity || quantity <= 0) {
    return { error: "Informe uma quantidade válida." };
  }

  // saída e ajuste-para-baixo diminuem o estoque; entrada aumenta
  const delta = type === "entrada" ? quantity : -quantity;

  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_quantity: delta,
    p_type: type,
    p_reason: reason || null,
  });

  if (error) {
    return { error: error.message.includes("negativo") ? "Estoque insuficiente para essa saída." : "Não foi possível registrar a movimentação." };
  }

  revalidatePath("/estoque");
  revalidatePath("/estoque/produtos");
  return {};
}
