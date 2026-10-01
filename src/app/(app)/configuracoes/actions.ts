"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { BR_STATES } from "@/utils/br-states";

export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const update: Record<string, string | null> = {
    full_name: fullName || null,
    business_name: businessName || null,
    phone: phone || null,
  };

  // Cidade e estado do negócio só vêm do formulário do proprietário.
  if (formData.has("state")) {
    const state = String(formData.get("state") ?? "").trim().toUpperCase();
    if (state && !BR_STATES.includes(state)) return { error: "Estado inválido." };
    update.city = String(formData.get("city") ?? "").trim() || null;
    update.state = state || null;
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);

  if (error) {
    if (formData.has("state") && /column|city|state/i.test(error.message)) {
      return { error: "Falta atualizar o banco: rode o SQL de cidade e estado do negócio no Supabase." };
    }
    return { error: "Não foi possível salvar as configurações." };
  }
  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { success: true };
}
