"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { getAccessContext } from "@/lib/access";

export interface CreateCollaboratorInput {
  name: string;
  username: string;
  password: string;
  phone?: string;
  role: "vendedor" | "cobrador";
}

export async function createCollaborator(
  input: CreateCollaboratorInput
): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return { error: "Apenas o proprietário pode cadastrar colaboradores." };
  }

  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();
  const password = input.password;

  if (!name) return { error: "Informe o nome do colaborador." };
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return { error: "O usuário deve ter de 3 a 30 caracteres e usar apenas letras, números, ponto, hífen ou underline." };
  }
  if (password.length < 8) return { error: "A senha deve ter pelo menos 8 caracteres." };

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: "Sessão expirada. Faça login novamente." };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-collaborator`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      username,
      password,
      phone: input.phone?.trim() || null,
      role: input.role,
    }),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) return { error: result?.error || "Não foi possível cadastrar o colaborador." };

  revalidatePath("/colaboradores");
  revalidatePath("/fichas");
  return { success: true };
}
