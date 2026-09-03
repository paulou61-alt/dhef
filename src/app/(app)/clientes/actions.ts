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

function parseCurrencyField(formData: FormData, key: string): number | null {
  const raw = getStringField(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) throw new Error("Informe um valor válido.");
  return value;
}

function buildCustomerPayload(formData: FormData) {
  const name = getStringField(formData, "name");
  if (!name) throw new Error("O nome do cliente é obrigatório.");

  const fichaNumberRaw = getStringField(formData, "ficha_number");
  if (!fichaNumberRaw || !/^\d+$/.test(fichaNumberRaw)) {
    throw new Error("Informe um número de ficha válido.");
  }

  const fichaNumber = Number(fichaNumberRaw);
  if (!Number.isSafeInteger(fichaNumber) || fichaNumber <= 0) {
    throw new Error("O número da ficha deve ser maior que zero.");
  }

  const creditLimitRaw = getStringField(formData, "credit_limit");
  return {
    ficha_number: fichaNumber,
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

function customerWriteError(error: any, fallback: string) {
  if (error?.code === "23505") {
    return "Já existe uma ficha com esse número. Escolha outro número.";
  }

  const message = String(error?.message ?? "").toLowerCase();
  if (message.includes("número da ficha é obrigatório")) return "Informe o número da ficha.";
  if (message.includes("número da ficha deve ser maior")) return "O número da ficha deve ser maior que zero.";
  if (message.includes("numeração da ficha não pode ser alterada")) return "O número da ficha não pode ser alterado depois do cadastro.";
  if (message.includes("colaborador responsável inválido")) return "Revise o colaborador responsável.";
  return fallback;
}

export async function createCustomer(formData: FormData): Promise<CustomerFormState> {
  const access = await getAccessContext();
  if (!access) return { error: "Sessão expirada. Faça login novamente." };
  if (access.role === "cobrador") return { error: "Cobradores não podem cadastrar clientes." };

  let payload;
  let openingBalance: number | null;
  try {
    payload = buildCustomerPayload(formData);
    openingBalance = parseCurrencyField(formData, "opening_balance");
  } catch (e: any) {
    return { error: e.message };
  }

  if (access.role === "vendedor") payload.assigned_collaborator_id = access.collaboratorId;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...payload, user_id: access.ownerId })
    .select("id")
    .single();

  if (error) return { error: customerWriteError(error, "Não foi possível salvar o cliente. Tente novamente.") };

  if (openingBalance && openingBalance > 0) {
    const { error: openingBalanceError } = await supabase.rpc("create_customer_opening_balance", {
      p_customer_id: data.id,
      p_amount: openingBalance,
      p_due_date: new Date().toISOString().slice(0, 10),
    });

    if (openingBalanceError) {
      await supabase.from("customers").delete().eq("id", data.id).eq("user_id", access.ownerId);
      return { error: "Não foi possível registrar o saldo devedor inicial. O cliente não foi salvo; tente novamente." };
    }
  }

  revalidatePath("/clientes");
  revalidatePath("/fichas");
  revalidatePath("/receber");
  revalidatePath("/cobrancas");
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

  if (error) return { error: customerWriteError(error, "Não foi possível atualizar o cliente. Tente novamente.") };

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
