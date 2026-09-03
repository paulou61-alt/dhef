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

function parseInitialPurchaseItems(formData: FormData): Array<{ product_variant_id: string; quantity: number }> {
  const raw = getStringField(formData, "initial_purchase_items");
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Revise os produtos da primeira compra.");
  }

  if (!Array.isArray(parsed)) throw new Error("Revise os produtos da primeira compra.");
  if (parsed.length > 100) throw new Error("A primeira compra possui itens demais.");

  return parsed.map((item: any) => {
    const variantId = typeof item?.product_variant_id === "string" ? item.product_variant_id : "";
    const quantity = Number(item?.quantity);
    if (!variantId || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new Error("Revise os produtos e quantidades da primeira compra.");
    }
    return { product_variant_id: variantId, quantity };
  });
}

function buildCustomerPayload(formData: FormData) {
  const name = getStringField(formData, "name");
  if (!name) throw new Error("O nome do cliente é obrigatório.");

  const fichaNumberRaw = getStringField(formData, "ficha_number");
  if (!fichaNumberRaw || !/^\d+$/.test(fichaNumberRaw)) {
    throw new Error("Informe um número de ficha válido.");
  }

  const fichaNumber = Number(fichaNumberRaw);
  if (!Number.isSafeInteger(fichaNumber) || fichaNumber < 1 || fichaNumber > 1000) {
    throw new Error("O número da ficha deve estar entre 1 e 1000.");
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
    return "Essa ficha já existe para o colaborador selecionado. Use outro número entre 1 e 1000.";
  }

  const message = String(error?.message ?? "").toLowerCase();
  if (message.includes("número da ficha é obrigatório")) return "Informe o número da ficha.";
  if (message.includes("número da ficha deve estar entre")) return "O número da ficha deve estar entre 1 e 1000.";
  if (message.includes("número da ficha deve ser maior")) return "O número da ficha deve estar entre 1 e 1000.";
  if (message.includes("numeração da ficha não pode ser alterada")) return "O número da ficha não pode ser alterado depois do cadastro.";
  if (message.includes("colaborador responsável inválido")) return "Revise o colaborador responsável.";
  if (message.includes("estoque insuficiente")) return error.message;
  if (message.includes("entrada não pode")) return "A entrada da primeira compra não pode ser maior que o valor da compra.";
  return fallback;
}

export async function createCustomer(formData: FormData): Promise<CustomerFormState> {
  const access = await getAccessContext();
  if (!access) return { error: "Sessão expirada. Faça login novamente." };
  if (access.role === "cobrador") return { error: "Cobradores não podem cadastrar clientes." };

  let payload;
  let openingBalance: number | null;
  let initialItems: Array<{ product_variant_id: string; quantity: number }>;
  let initialDownPayment: number | null;
  try {
    payload = buildCustomerPayload(formData);
    openingBalance = parseCurrencyField(formData, "opening_balance");
    initialItems = parseInitialPurchaseItems(formData);
    initialDownPayment = parseCurrencyField(formData, "initial_down_payment");
  } catch (e: any) {
    return { error: e.message };
  }

  if (access.role === "vendedor") payload.assigned_collaborator_id = access.collaboratorId;

  const initialPaymentMethod = getStringField(formData, "initial_payment_method") ?? "parcelado";
  const allowedMethods = new Set(["pix", "dinheiro", "cartao", "fiado", "parcelado"]);
  if (!allowedMethods.has(initialPaymentMethod)) return { error: "Forma de pagamento da primeira compra inválida." };

  const initialInstallments = Math.max(1, Math.min(36, Number(getStringField(formData, "initial_installments_count") ?? "1") || 1));
  const initialFirstDueDate = getStringField(formData, "initial_first_due_date") ?? new Date().toISOString().slice(0, 10);
  const initialPurchaseNotes = getStringField(formData, "initial_purchase_notes");

  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...payload, user_id: access.ownerId })
    .select("id")
    .single();

  if (error) return { error: customerWriteError(error, "Não foi possível salvar o cliente. Tente novamente.") };

  if ((openingBalance ?? 0) > 0 || initialItems.length > 0) {
    const { error: initializeError } = await supabase.rpc("initialize_customer_account", {
      p_customer_id: data.id,
      p_opening_balance: openingBalance ?? 0,
      p_items: initialItems,
      p_payment_method: initialPaymentMethod,
      p_down_payment: initialDownPayment ?? 0,
      p_installments_count: initialInstallments,
      p_first_due_date: initialFirstDueDate,
      p_notes: initialPurchaseNotes,
    });

    if (initializeError) {
      await supabase.from("customers").delete().eq("id", data.id).eq("user_id", access.ownerId);
      return {
        error: customerWriteError(
          initializeError,
          "Não foi possível concluir o cadastro com a primeira compra. O cliente não foi salvo; revise os dados e tente novamente."
        ),
      };
    }
  }

  revalidatePath("/clientes");
  revalidatePath("/fichas");
  revalidatePath("/receber");
  revalidatePath("/cobrancas");
  revalidatePath("/vender");
  redirect(`/clientes/${data.id}?created=1`);
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
  revalidatePath("/receber");
  revalidatePath("/cobrancas");
  redirect(`/clientes/${customerId}`);
}

export async function updateInstallmentDueDate(input: {
  customerId: string;
  installmentId: string;
  dueDate: string;
}): Promise<{ error?: string; success?: boolean }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") return { error: "Apenas o proprietário pode alterar datas de cobrança." };

  const customerId = input.customerId?.trim();
  const installmentId = input.installmentId?.trim();
  const dueDate = input.dueDate?.trim();
  if (!customerId || !installmentId) return { error: "Cobrança inválida." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: "Informe uma data válida." };

  const [year, month, day] = dueDate.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedDate.getUTCFullYear() !== year
    || parsedDate.getUTCMonth() !== month - 1
    || parsedDate.getUTCDate() !== day
  ) {
    return { error: "Informe uma data válida." };
  }

  const supabase = createClient();
  const { data: installment } = await supabase
    .from("installments")
    .select("id, sale_id, status, amount, paid_amount")
    .eq("id", installmentId)
    .eq("user_id", access.ownerId)
    .maybeSingle();

  if (!installment) return { error: "Cobrança não encontrada." };
  if (installment.status === "pago" || Number(installment.paid_amount ?? 0) >= Number(installment.amount ?? 0)) {
    return { error: "A data de uma parcela já paga não pode ser alterada." };
  }

  const { data: sale } = await supabase
    .from("sales")
    .select("customer_id")
    .eq("id", installment.sale_id)
    .eq("user_id", access.ownerId)
    .maybeSingle();

  if (!sale || sale.customer_id !== customerId) return { error: "Esta cobrança não pertence ao cliente informado." };

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const paidAmount = Number(installment.paid_amount ?? 0);
  const nextStatus = dueDate < today ? "vencido" : paidAmount > 0 ? "parcial" : "pendente";

  const { error } = await supabase
    .from("installments")
    .update({ due_date: dueDate, status: nextStatus })
    .eq("id", installmentId)
    .eq("user_id", access.ownerId);

  if (error) return { error: "Não foi possível alterar a data de cobrança." };

  revalidatePath(`/clientes/${customerId}`);
  revalidatePath(`/fichas/${customerId}`);
  revalidatePath("/receber");
  revalidatePath("/cobrancas");
  revalidatePath("/fichas");
  revalidatePath("/clientes");
  return { success: true };
}

export async function deleteCustomer(customerId: string): Promise<{ error?: string }> {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") return { error: "Apenas o proprietário pode excluir clientes." };

  const supabase = createClient();
  const { error } = await supabase.from("customers").delete().eq("id", customerId).eq("user_id", access.ownerId);
  if (error) return { error: "Não foi possível excluir o cliente. Tente novamente." };

  revalidatePath("/clientes");
  revalidatePath("/fichas");
  revalidatePath("/receber");
  revalidatePath("/cobrancas");
  redirect("/clientes");
}
