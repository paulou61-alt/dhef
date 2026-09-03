import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";

const OPEN_INSTALLMENT_STATUSES = new Set(["pendente", "parcial", "vencido"]);

export function normalizeReportMonth(value?: string | null) {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function getMonthlyBusinessReport(monthValue?: string | null) {
  const access = await getAccessContext();
  if (!access || access.role !== "owner") return null;

  const monthKey = normalizeReportMonth(monthValue);
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = `${monthKey}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthStartTs = `${monthStart}T00:00:00.000Z`;
  const nextMonthTs = `${nextMonth}T00:00:00.000Z`;
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const supabase = createClient();

  const [
    { data: profile },
    { data: allSales },
    { data: customers },
    { data: monthExpenses },
    { data: monthPayments },
    { data: installments },
    { data: products },
    { data: variants },
    { data: collaborators },
    { data: valeMovements },
    { data: monthCashMovements },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, business_name, phone").eq("id", access.ownerId).maybeSingle(),
    supabase.from("sales").select("id, customer_id, sale_number, status, payment_method, total, down_payment, is_paid, is_opening_balance, created_at, created_by_collaborator_id").neq("status", "cancelled").order("created_at"),
    supabase.from("customers").select("id, name, ficha_number, phone, city, state").order("name"),
    supabase.from("expenses").select("id, description, category, amount, expense_date, notes").gte("expense_date", monthStart).lt("expense_date", nextMonth).order("expense_date"),
    supabase.from("payments").select("id, installment_id, amount, payment_method, payment_date, notes, collected_by_collaborator_id").gte("payment_date", monthStart).lt("payment_date", nextMonth).order("payment_date"),
    supabase.from("installments").select("id, sale_id, installment_number, total_installments, amount, paid_amount, due_date, status").order("due_date"),
    supabase.from("products").select("id, name, category, brand, cost_price, sale_price, is_active").order("name"),
    supabase.from("product_variants").select("id, product_id, variant_name, stock_quantity, cost_price, sale_price").order("variant_name"),
    supabase.from("collaborators").select("id, name, role, is_active").eq("is_active", true).order("name"),
    supabase.from("collaborator_vale_movements").select("collaborator_id, movement_type, amount, movement_date"),
    supabase.from("cash_movements").select("type, origin, amount, created_at").gte("created_at", monthStartTs).lt("created_at", nextMonthTs),
  ]);

  const completedEntries = (allSales ?? []).filter((sale) => sale.status === "completed");
  const completedSales = completedEntries.filter((sale) => !sale.is_opening_balance);
  const monthSales = completedSales.filter((sale) => String(sale.created_at).slice(0, 7) === monthKey);
  const monthSaleIds = monthSales.map((sale) => sale.id);

  const { data: monthItems } = monthSaleIds.length
    ? await supabase
        .from("sale_items")
        .select("sale_id, product_name_snapshot, variant_name_snapshot, quantity, unit_cost_snapshot, unit_price_snapshot, subtotal")
        .in("sale_id", monthSaleIds)
    : { data: [] as any[] };

  const customerMap = new Map((customers ?? []).map((customer) => [customer.id, customer]));
  const saleMap = new Map(completedEntries.map((sale) => [sale.id, sale]));
  const installmentMap = new Map((installments ?? []).map((installment) => [installment.id, installment]));
  const collaboratorMap = new Map((collaborators ?? []).map((collaborator) => [collaborator.id, collaborator]));
  const productMap = new Map((products ?? []).map((product) => [product.id, product]));

  const revenue = monthSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const cost = (monthItems ?? []).reduce((sum, item) => sum + Number(item.unit_cost_snapshot) * Number(item.quantity), 0);
  const expenseTotal = (monthExpenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const grossProfit = revenue - cost;
  const netProfit = grossProfit - expenseTotal;
  const units = (monthItems ?? []).reduce((sum, item) => sum + Number(item.quantity), 0);
  const averageTicket = monthSales.length ? revenue / monthSales.length : 0;
  const paymentsReceived = (monthPayments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const cashIn = (monthCashMovements ?? [])
    .filter((movement) => movement.type === "entrada")
    .reduce((sum, movement) => sum + Number(movement.amount), 0);

  const today = new Date().toISOString().slice(0, 10);
  const openReceivablesRows = (installments ?? [])
    .filter((installment) => OPEN_INSTALLMENT_STATUSES.has(installment.status))
    .map((installment) => {
      const sale = saleMap.get(installment.sale_id);
      const customer = sale?.customer_id ? customerMap.get(sale.customer_id) : null;
      const openAmount = Math.max(0, Number(installment.amount) - Number(installment.paid_amount));
      return {
        customer: customer?.name ?? "Cliente",
        fichaNumber: customer?.ficha_number ?? null,
        saleNumber: sale?.is_opening_balance ? null : sale?.sale_number ?? null,
        reference: sale?.is_opening_balance ? "Saldo devedor inicial" : "Parcela de venda",
        installmentNumber: installment.installment_number,
        totalInstallments: installment.total_installments,
        dueDate: installment.due_date,
        openAmount,
        overdue: installment.status === "vencido" || installment.due_date < today,
      };
    })
    .filter((row) => row.openAmount > 0);

  const openReceivables = openReceivablesRows.reduce((sum, row) => sum + row.openAmount, 0);
  const overdueReceivables = openReceivablesRows.filter((row) => row.overdue).reduce((sum, row) => sum + row.openAmount, 0);

  const customerTotals = new Map<string, number>();
  monthSales.forEach((sale) => {
    if (!sale.customer_id) return;
    customerTotals.set(sale.customer_id, (customerTotals.get(sale.customer_id) ?? 0) + Number(sale.total));
  });
  const topCustomers = [...customerTotals.entries()]
    .map(([id, total]) => ({ id, name: customerMap.get(id)?.name ?? "Cliente", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const productTotals = new Map<string, { qty: number; revenue: number; cost: number }>();
  (monthItems ?? []).forEach((item) => {
    const key = [item.product_name_snapshot, item.variant_name_snapshot].filter(Boolean).join(" - ");
    const current = productTotals.get(key) ?? { qty: 0, revenue: 0, cost: 0 };
    current.qty += Number(item.quantity);
    current.revenue += Number(item.subtotal);
    current.cost += Number(item.unit_cost_snapshot) * Number(item.quantity);
    productTotals.set(key, current);
  });
  const topProducts = [...productTotals.entries()]
    .map(([name, data]) => ({ name, ...data, profit: data.revenue - data.cost }))
    .sort((a, b) => b.qty - a.qty);

  const salesRows = monthSales
    .slice()
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    .map((sale) => ({
      saleNumber: sale.sale_number,
      date: sale.created_at,
      customer: sale.customer_id ? customerMap.get(sale.customer_id)?.name ?? "Cliente" : "Venda sem cliente",
      seller: sale.created_by_collaborator_id ? collaboratorMap.get(sale.created_by_collaborator_id)?.name ?? "Colaborador" : "Proprietário",
      paymentMethod: sale.payment_method,
      total: Number(sale.total),
    }));

  const expenseRows = (monthExpenses ?? []).map((expense) => ({
    date: expense.expense_date,
    description: expense.description,
    category: expense.category,
    amount: Number(expense.amount),
  }));

  const paymentRows = (monthPayments ?? []).map((payment) => {
    const installment = installmentMap.get(payment.installment_id);
    const sale = installment ? saleMap.get(installment.sale_id) : null;
    const customer = sale?.customer_id ? customerMap.get(sale.customer_id) : null;
    return {
      date: payment.payment_date,
      customer: customer?.name ?? "Cliente",
      saleNumber: sale?.is_opening_balance ? null : sale?.sale_number ?? null,
      reference: sale?.is_opening_balance ? "Saldo devedor inicial" : "Parcela de venda",
      method: payment.payment_method,
      amount: Number(payment.amount),
      collector: payment.collected_by_collaborator_id ? collaboratorMap.get(payment.collected_by_collaborator_id)?.name ?? "Colaborador" : "Proprietário",
    };
  });

  const stockRows = (variants ?? []).map((variant) => {
    const product = productMap.get(variant.product_id);
    const qty = Number(variant.stock_quantity);
    const unitCost = Number(variant.cost_price ?? product?.cost_price ?? 0);
    const unitSale = Number(variant.sale_price ?? product?.sale_price ?? 0);
    return {
      product: product?.name ?? "Produto",
      variant: variant.variant_name,
      quantity: qty,
      unitCost,
      unitSale,
      costValue: qty * unitCost,
      saleValue: qty * unitSale,
    };
  });
  const stockUnits = stockRows.reduce((sum, row) => sum + row.quantity, 0);
  const stockCostValue = stockRows.reduce((sum, row) => sum + row.costValue, 0);
  const stockSaleValue = stockRows.reduce((sum, row) => sum + row.saleValue, 0);

  const valeBalanceByCollaborator = new Map<string, number>();
  (valeMovements ?? []).forEach((movement) => {
    const signal = movement.movement_type === "vale" ? 1 : -1;
    valeBalanceByCollaborator.set(
      movement.collaborator_id,
      (valeBalanceByCollaborator.get(movement.collaborator_id) ?? 0) + signal * Number(movement.amount),
    );
  });

  const collaboratorRows = (collaborators ?? []).map((collaborator) => {
    const salesTotal = monthSales
      .filter((sale) => sale.created_by_collaborator_id === collaborator.id)
      .reduce((sum, sale) => sum + Number(sale.total), 0);
    const collectedTotal = (monthPayments ?? [])
      .filter((payment) => payment.collected_by_collaborator_id === collaborator.id)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    return {
      id: collaborator.id,
      name: collaborator.name,
      role: collaborator.role,
      salesTotal,
      collectedTotal,
      valeBalance: valeBalanceByCollaborator.get(collaborator.id) ?? 0,
    };
  });
  const totalValeBalance = collaboratorRows.reduce((sum, collaborator) => sum + collaborator.valeBalance, 0);

  return {
    monthKey,
    monthLabel,
    generatedAt: new Date().toISOString(),
    business: {
      name: profile?.business_name || profile?.full_name || "Controle de Vendas",
      ownerName: profile?.full_name ?? "Proprietário",
      phone: profile?.phone ?? null,
    },
    summary: {
      revenue,
      cost,
      grossProfit,
      expenses: expenseTotal,
      netProfit,
      salesCount: monthSales.length,
      units,
      averageTicket,
      paymentsReceived,
      cashIn,
      openReceivables,
      overdueReceivables,
      customersCount: (customers ?? []).length,
      stockUnits,
      stockCostValue,
      stockSaleValue,
      totalValeBalance,
    },
    topCustomers,
    topProducts,
    salesRows,
    expenseRows,
    paymentRows,
    openReceivablesRows,
    stockRows,
    collaboratorRows,
  };
}

export type MonthlyBusinessReport = NonNullable<Awaited<ReturnType<typeof getMonthlyBusinessReport>>>;
