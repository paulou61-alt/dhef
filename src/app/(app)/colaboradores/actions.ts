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

export interface CreateCollaboratorAccessInput {
  collaboratorId: string;
  username: string;
  password: string;
}

export interface SetCollaboratorPasswordInput {
  collaboratorId: string;
  password: string;
}

export interface CollaboratorValeInput {
  collaboratorId: string;
  movementType: "vale" | "abatimento";
  amount: number;
  movementDate?: string;
  notes?: string;
}

export interface UpdateCollaboratorValeMovementInput {
  movementId: string;
  collaboratorId: string;
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

export async function createCollaboratorAccess(
  input: CreateCollaboratorAccessInput
): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return { error: "Apenas o proprietário pode criar acessos de colaboradores." };
  }

  const collaboratorId = input.collaboratorId?.trim();
  const username = input.username?.trim().toLowerCase();
  const password = input.password ?? "";

  if (!collaboratorId) return { error: "Colaborador inválido." };
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return { error: "O usuário deve ter de 3 a 30 caracteres e usar apenas letras, números, ponto, hífen ou underline." };
  }
  if (password.length < 8) return { error: "A senha deve ter pelo menos 8 caracteres." };

  const result = await callCollaboratorManager({
    action: "create_access",
    collaboratorId,
    username,
    password,
  });

  if (!result.ok) return { error: result.error || "Não foi possível criar o acesso do colaborador." };

  revalidatePath("/colaboradores");
  return { success: true };
}

export async function setCollaboratorPassword(
  input: SetCollaboratorPasswordInput
): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return { error: "Apenas o proprietário pode definir a senha do colaborador." };
  }

  const collaboratorId = input.collaboratorId?.trim();
  const password = input.password ?? "";

  if (!collaboratorId) return { error: "Colaborador inválido." };
  if (password.length < 8) return { error: "A nova senha deve ter pelo menos 8 caracteres." };

  const result = await callCollaboratorManager({
    action: "set_password",
    collaboratorId,
    password,
  });

  if (!result.ok) return { error: result.error || "Não foi possível definir a nova senha." };

  revalidatePath("/colaboradores");
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
    return { error: "Não foi possível registrar a movimentação do vale." };
  }

  revalidatePath("/colaboradores");
  return { success: true };
}

export async function updateCollaboratorValeMovement(
  input: UpdateCollaboratorValeMovementInput
): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") {
    return { error: "Apenas o proprietário pode editar lançamentos de vale." };
  }

  const movementId = input.movementId?.trim();
  const collaboratorId = input.collaboratorId?.trim();
  const amount = Number(input.amount);
  const movementDate = input.movementDate || new Date().toISOString().slice(0, 10);
  const notes = input.notes?.trim().slice(0, 240) || null;

  if (!movementId || !collaboratorId) return { error: "Lançamento inválido." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Informe um valor maior que zero." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(movementDate)) return { error: "Informe uma data válida." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("collaborator_vale_movements")
    .update({
      amount: Number(amount.toFixed(2)),
      movement_date: movementDate,
      notes,
    })
    .eq("id", movementId)
    .eq("owner_id", access.ownerId)
    .eq("collaborator_id", collaboratorId)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Não foi possível editar este lançamento." };
  if (!data) return { error: "Lançamento não encontrado." };

  revalidatePath("/colaboradores");
  revalidatePath("/meu-vale");
  return { success: true };
}

export async function setCollaboratorValeBalance(input: {
  collaboratorId: string;
  balance: number;
}): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") return { error: "Apenas o proprietário pode editar o saldo em vale." };

  const collaboratorId = input.collaboratorId?.trim();
  const targetBalance = Number(input.balance);
  if (!collaboratorId) return { error: "Colaborador inválido." };
  if (!Number.isFinite(targetBalance)) return { error: "Informe um saldo válido." };

  const supabase = createClient();
  const { data: collaborator } = await supabase
    .from("collaborators")
    .select("id")
    .eq("id", collaboratorId)
    .eq("owner_id", access.ownerId)
    .maybeSingle();

  if (!collaborator) return { error: "Colaborador não encontrado." };

  const { data: movements, error: movementsError } = await supabase
    .from("collaborator_vale_movements")
    .select("movement_type, amount")
    .eq("owner_id", access.ownerId)
    .eq("collaborator_id", collaboratorId);

  if (movementsError) return { error: "Não foi possível consultar o saldo atual." };

  const currentBalance = (movements ?? []).reduce((sum, movement) => {
    const amount = Number(movement.amount ?? 0);
    return sum + (movement.movement_type === "vale" ? -amount : amount);
  }, 0);

  const normalizedTarget = Number(targetBalance.toFixed(2));
  const difference = Number((normalizedTarget - currentBalance).toFixed(2));
  if (Math.abs(difference) < 0.01) return { success: true };

  const { error } = await supabase.from("collaborator_vale_movements").insert({
    owner_id: access.ownerId,
    collaborator_id: collaboratorId,
    movement_type: difference > 0 ? "abatimento" : "vale",
    amount: Math.abs(difference),
    movement_date: new Date().toISOString().slice(0, 10),
    notes: "Ajuste manual de saldo",
  });

  if (error) {
    return { error: "Não foi possível atualizar o saldo em vale." };
  }

  revalidatePath("/colaboradores");
  revalidatePath("/meu-vale");
  return { success: true };
}
