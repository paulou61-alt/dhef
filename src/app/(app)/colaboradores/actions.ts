"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";

export interface CreateCollaboratorInput {
  name: string;
  email: string;
  phone?: string;
  role: "vendedor" | "cobrador";
}

export async function createCollaborator(input: CreateCollaboratorInput): Promise<{ error?: string; invitePath?: string }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") return { error: "Apenas o proprietário pode cadastrar colaboradores." };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || !email) return { error: "Informe nome e e-mail." };
  if (!email.includes("@")) return { error: "Informe um e-mail válido." };

  const supabase = createClient();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("collaborators").insert({
    owner_id: access.ownerId,
    name,
    email,
    phone: input.phone?.trim() || null,
    role: input.role,
    is_active: true,
    invite_token: token,
    invite_expires_at: expiresAt,
  });

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) return { error: "Já existe um colaborador com esse e-mail." };
    return { error: "Não foi possível cadastrar o colaborador." };
  }

  revalidatePath("/colaboradores");
  return { invitePath: `/convite/${token}` };
}
