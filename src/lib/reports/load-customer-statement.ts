import "server-only";

import type { AccessContext } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import type { CustomerStatement } from "./customer-statement";

export async function loadCustomerStatement(id: string, access: AccessContext): Promise<CustomerStatement | null> {
  const db = createClient();
  let query = db.from("customers").select("*").eq("user_id", access.ownerId).eq("id", id);
  if (access.role !== "owner") {
    if (!access.collaboratorId || !access.viewPermissions.includes("fichas")) return null;
    query = query.eq("assigned_collaborator_id", access.collaboratorId);
  }
  const { data: customer, error } = await query.maybeSingle();
  if (error) throw error;
  if (!customer) return null;

  const [responsible, sales, items, installments, payments, discounts] = await Promise.all([
    customer.assigned_collaborator_id
      ? db.from("collaborators").select("name").eq("owner_id", access.ownerId).eq("id", customer.assigned_collaborator_id).maybeSingle()
      : { data: null, error: null },
    fetchAll((from, to) => db.from("sales")
      .select("id, sale_number, status, payment_method, total, down_payment, is_paid, is_opening_balance, created_at, notes")
      .eq("user_id", access.ownerId).eq("customer_id", id).order("created_at").order("id").range(from, to)),
    fetchAll((from, to) => db.from("sale_items")
      .select("sale_id, product_name_snapshot, variant_name_snapshot, quantity, unit_price_snapshot, subtotal, sales!inner(customer_id)")
      .eq("user_id", access.ownerId).eq("sales.customer_id", id).order("created_at").order("id").range(from, to)),
    fetchAll((from, to) => db.from("installments")
      .select("id, sale_id, installment_number, total_installments, amount, paid_amount, due_date, status, sales!inner(customer_id)")
      .eq("user_id", access.ownerId).eq("sales.customer_id", id).order("due_date").order("id").range(from, to)),
    fetchAll((from, to) => db.from("payments")
      .select("installment_id, amount, payment_method, payment_date, notes, installments!inner(sales!inner(customer_id))")
      .eq("user_id", access.ownerId).eq("installments.sales.customer_id", id).order("payment_date").order("id").range(from, to)),
    fetchAll((from, to) => db.from("customer_discounts").select("id, amount, note, created_at, reversed_at")
      .eq("user_id", access.ownerId).eq("customer_id", id).order("created_at").order("id").range(from, to)),
  ]);
  for (const result of [responsible, sales, items, installments, payments]) {
    if (result.error) throw result.error;
  }
  // Instalações anteriores ao recurso de descontos ainda não possuem essa tabela.
  const discountError = discounts.error as { code?: string } | null;
  if (discountError && !["42P01", "PGRST205"].includes(discountError.code ?? "")) throw discountError;

  return {
    customer: { ...customer, write_off_note: access.role === "owner" ? customer.write_off_note : null },
    responsible: responsible.data?.name ?? null,
    sales: sales.data, items: items.data, installments: installments.data, payments: payments.data, discounts: discounts.data,
  };
}
