"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";

export interface CustomerFormState {
  error?: string;
}

function getStringField(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildCustomerPayload(formData: FormData) {
  const name = getStringField(formData, "name");
  if (!name) throw new Error("O nome do cliente é obrigatório.");

  const creditLimitRaw = getStringField(formData, "credit_limit");
  return {
    name,
    phone: getStringField(formData, "phone"),
    whatsapp: getStringField(formData, "whatsapp"),
    cpf: getStringField(formData, "cpf"),
    address: getStringField(formData, "address"),
    neighborhood: getStringField(formData, "neighborhood"),
    city: getStringField(formData, "city"),
    state: getStringField(formData, "state"),
    zip_code: getStringField(formData, "zip_code"),
    assigned_collaborator_id: getStringField(formData, "assigned_collaborator_id"),
    credit_limit: creditLimitRaw ? parseFloat(creditLimitRaw.replace(/\./g, "").replace(",", ".")) : null,
    notes: getStringField(formData, "notes"),
  };
}

export async function createCustomer(formData: FormData): Promise<CustomerFormState> {
  const access = await getAccessContext();
  if (!access) return { error: "Sessão expirada. Faça login novamente." };
  if (access.role === "cobrador") return { error: "Cobradores não podem cadastrar clientes." };

  let payload;
  try { payload = buildCustomerPayload(formData); } catch (e: any) { return { error: e.message }; }

  if (access.role === "vendedor") payload.assigned_collaborator_id = access.collaboratorId;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...payload, user_id: access.ownerId })
    .select("id")
    .single();

  if (error) return { error: "Não foi possível salvar o cliente. Revise o colaborador responsável e tente novamente." };

  revalidatePath("/clientes");
  revalidatePath("/fichas");
  redirect(`/clientes/${data.id}`);
}

export async function updateCustomer(customerId: string, formData: FormData): Promise<CustomerFormState> {
  const access = await getAccessContext();
  if (!access) return { error: "Sessão expirada. Faça login novamente." };
  if (access.role === "cobrador") return { error: "Cobradores não podem editar clientes." };

  let payload: any;
  try { payload = buildCustomerPayload(formData); } catch (e: any) { return { error: e.message }; }

  if (access.role === "vendedor") delete payload.assigned_collaborator_id;

  const supabase = createClient();
  const { error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", customerId)
    .eq("user_id", access.ownerId);

  if (error) return { error: "Não foi possível atualizar o cliente. Tente novamente." };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${customerId}`);
  revalidatePath("/fichas");
  revalidatePath(`/fichas/${customerId}`);
  redirect(`/clientes/${customerId}`);
}

export async function deleteCustomer(customerId: string): Promise<{ error?: string }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") return { error: "Apenas o proprietário pode excluir clientes." };

  const supabase = createClient();
  const { error } = await supabase.from("customers").delete().eq("id", customerId).eq("user_id", access.ownerId);
  if (error) return { error: "Não foi possível excluir o cliente. Tente novamente." };

  revalidatePath("/clientes");
  revalidatePath("/fichas");
  redirect("/clientes");
}
