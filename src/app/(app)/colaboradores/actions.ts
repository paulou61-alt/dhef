"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import { getAccessContext } from "@/lib/access";
import { normalizeViewPermissions, type ViewPermission } from "@/lib/permissions";

export interface CreateCollaboratorInput {
  name: string;
  phone?: string;
  role: "vendedor" | "cobrador";
  viewPermissions: ViewPermission[];
}

export interface CollaboratorValeInput {
  collaboratorId: string;
  movementType: "vale" | "abatimento";
  amount: number;
  movementDate?: string;
  notes?: string;
}

async function callCollaboratorManager(payload: Record<string, unknown>) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { ok: false, error: "Sessão expirada. Faça login novamente." };

  const response = await fetch(`${SUPABASE_URL}/functions/v1/manage-collaborator`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    error: response.ok ? undefined : result?.error || "Não foi possível concluir a operação.",
  };
}

export async function createCollaborator(
  input: CreateCollaboratorInput
): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return { error: "Apenas o proprietário pode cadastrar colaboradores." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Informe o nome do colaborador." };

  const permissions = normalizeViewPermissions(input.role, input.viewPermissions);
  if (permissions.length === 0) {
    return { error: "Selecione pelo menos uma área que o colaborador pode visualizar." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("collaborators").insert({
    owner_id: access.ownerId,
    name,
    phone: input.phone?.trim() || null,
    role: input.role,
    is_active: true,
    view_permissions: permissions,
    username: null,
    email: null,
    auth_user_id: null,
    accepted_at: null,
  });

  if (error) return { error: "Não foi possível cadastrar o colaborador." };

  revalidatePath("/colaboradores");
  revalidatePath("/fichas");
  return { success: true };
}

export async function updateCollaboratorPermissions(
  collaboratorId: string,
  requestedPermissions: ViewPermission[]
): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return { error: "Apenas o proprietário pode alterar permissões." };
  }

  const supabase = createClient();
  const { data: collaborator } = await supabase
    .from("collaborators")
    .select("role")
    .eq("id", collaboratorId)
    .eq("owner_id", access.ownerId)
    .maybeSingle();

  if (!collaborator) return { error: "Colaborador não encontrado." };

  const role = collaborator.role as "vendedor" | "cobrador";
  const permissions = normalizeViewPermissions(role, requestedPermissions);
  if (permissions.length === 0) {
    return { error: "O colaborador precisa ter pelo menos uma visualização liberada." };
  }

  const { error } = await supabase
    .from("collaborators")
    .update({ view_permissions: permissions })
    .eq("id", collaboratorId)
    .eq("owner_id", access.ownerId);

  if (error) return { error: "Não foi possível salvar as permissões." };

  revalidatePath("/colaboradores");
  return { success: true };
}

export async function removeCollaborator(
  collaboratorId: string
): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return { error: "Apenas o proprietário pode remover colaboradores." };
  }

  if (!collaboratorId) return { error: "Colaborador inválido." };

  const result = await callCollaboratorManager({ action: "remove", collaboratorId });
  if (!result.ok) return { error: result.error || "Não foi possível remover o colaborador." };

  revalidatePath("/colaboradores");
  revalidatePath("/fichas");
  revalidatePath("/clientes");
  return { success: true };
}

export async function addCollaboratorValeMovement(
  input: CollaboratorValeInput
): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") return { error: "Apenas o proprietário pode movimentar vales." };

  const collaboratorId = input.collaboratorId?.trim();
  const amount = Number(input.amount);
  const movementType = input.movementType;
  const notes = input.notes?.trim().slice(0, 240) || null;

  if (!collaboratorId) return { error: "Colaborador inválido." };
  if (movementType !== "vale" && movementType !== "abatimento") return { error: "Tipo de movimentação inválido." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Informe um valor maior que zero." };

  const supabase = createClient();
  const { error } = await supabase.from("collaborator_vale_movements").insert({
    owner_id: access.ownerId,
    collaborator_id: collaboratorId,
    movement_type: movementType,
    amount: Number(amount.toFixed(2)),
    movement_date: input.movementDate || new Date().toISOString().slice(0, 10),
    notes,
  });

  if (error) {
    if (error.message.toLowerCase().includes("abatimento não pode")) return { error: "O abatimento não pode ser maior que o saldo em vale." };
    return { error: "Não foi possível registrar a movimentação do vale." };
  }

  revalidatePath("/colaboradores");
  return { success: true };
}
