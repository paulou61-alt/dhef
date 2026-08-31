"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const businessName = String(formData.get("business_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  const { error } = await supabase.from("profiles").update({
    full_name: fullName || null,
    business_name: businessName || null,
    phone: phone || null,
  }).eq("id", user.id);

  if (error) return { error: "Não foi possível salvar as configurações." };
  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { success: true };
}
