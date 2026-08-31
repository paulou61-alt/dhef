"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SaleInput {
  customerId: string | null;
  items: Array<{ product_variant_id: string; quantity: number }>;
  paymentMethod: "pix" | "dinheiro" | "cartao" | "fiado" | "parcelado";
  downPayment: number;
  installmentsCount: number;
  firstDueDate: string;
  notes?: string;
}

export async function createSale(input: SaleInput): Promise<{ id?: string; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  if (!input.items.length) return { error: "Adicione pelo menos um produto à venda." };
  if (input.items.some((item) => !item.product_variant_id || item.quantity <= 0)) {
    return { error: "Revise os produtos e quantidades da venda." };
  }
  if ((input.paymentMethod === "fiado" || input.paymentMethod === "parcelado") && !input.customerId) {
    return { error: "Selecione um cliente para vendas fiadas ou parceladas." };
  }

  const { data, error } = await supabase.rpc("create_sale", {
    p_customer_id: input.customerId,
    p_items: input.items,
    p_payment_method: input.paymentMethod,
    p_down_payment: input.downPayment || 0,
    p_installments_count: input.paymentMethod === "parcelado" ? input.installmentsCount : 1,
    p_first_due_date: input.firstDueDate,
    p_notes: input.notes?.trim() || null,
  });

  if (error) {
    const message = error.message || "";
    if (message.includes("Estoque insuficiente")) return { error: message };
    if (message.includes("Entrada")) return { error: message };
    return { error: "Não foi possível concluir a venda. Revise os dados e tente novamente." };
  }

  revalidatePath("/");
  revalidatePath("/vender");
  revalidatePath("/estoque");
  revalidatePath("/receber");
  revalidatePath("/financeiro");
  revalidatePath("/fichas");
  if (input.customerId) {
    revalidatePath(`/clientes/${input.customerId}`);
    revalidatePath(`/fichas/${input.customerId}`);
  }

  return { id: data as string };
}
