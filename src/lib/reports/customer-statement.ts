import type { Customer, Installment, Sale, SaleItem } from "../../types/database.types";
import { saleDirectPayment, type CustomerDiscount } from "../customer-discounts";

export interface CustomerStatement {
  customer: Customer & {
    write_off_status?: "mudou" | "prego" | null;
    write_off_at?: string | null;
    write_off_note?: string | null;
  };
  responsible: string | null;
  sales: Pick<Sale, "id" | "sale_number" | "status" | "payment_method" | "total" | "down_payment" | "is_paid" | "is_opening_balance" | "created_at" | "notes">[];
  items: Pick<SaleItem, "sale_id" | "product_name_snapshot" | "variant_name_snapshot" | "quantity" | "unit_price_snapshot" | "subtotal">[];
  installments: Pick<Installment, "id" | "sale_id" | "installment_number" | "total_installments" | "amount" | "paid_amount" | "due_date" | "status">[];
  payments: { installment_id: string; amount: number; payment_method: string; payment_date: string; notes: string | null }[];
  discounts: CustomerDiscount[];
}

const brazilDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
export function statementDay(value: string) {
  return value.length === 10 ? value : brazilDay.format(new Date(value));
}

function cents(value: number | string) {
  return Math.round(Number(value) * 100);
}

export function openInstallment(installment: CustomerStatement["installments"][number]) {
  return installment.status === "pago" ? 0 : Math.max(0, cents(installment.amount) - cents(installment.paid_amount)) / 100;
}

export function summarizeCustomerStatement(statement: CustomerStatement) {
  const completedSales = statement.sales.filter((sale) => sale.status === "completed");
  const completedIds = new Set(completedSales.map((sale) => sale.id));
  const installments = statement.installments.filter((item) => completedIds.has(item.sale_id));
  const installmentSales = new Set(installments.map((item) => item.sale_id));
  const byInstallment = new Map(installments.map((item) => [item.id, item]));
  const purchases = completedSales.filter((sale) => !sale.is_opening_balance);
  const dates: string[] = [];
  const directPayments = purchases.flatMap((sale) => {
    const amount = saleDirectPayment(sale, installmentSales);
    if (amount <= 0) return [];
    dates.push(statementDay(sale.created_at));
    return [{ sale, amount }];
  });

  const payments = statement.payments.filter((payment) => byInstallment.has(payment.installment_id));
  const datedPaid = new Map<string, number>();
  for (const payment of payments) {
    dates.push(statementDay(payment.payment_date));
    datedPaid.set(payment.installment_id, (datedPaid.get(payment.installment_id) ?? 0) + cents(payment.amount));
  }
  const activeDiscounts = statement.discounts.filter((discount) => !discount.reversed_at);
  for (const discount of activeDiscounts) dates.push(statementDay(discount.created_at));

  // Fichas antigas podem guardar o acumulado da parcela sem os recibos individuais.
  const hasDatedHistory = installments.every((item) => cents(item.paid_amount) === (datedPaid.get(item.id) ?? 0));
  const bought = purchases.reduce((sum, sale) => sum + cents(sale.total), 0);
  const opening = completedSales.filter((sale) => sale.is_opening_balance).reduce((sum, sale) => sum + cents(sale.total), 0);
  const paid = directPayments.reduce((sum, entry) => sum + cents(entry.amount), 0)
    + installments.reduce((sum, item) => sum + cents(item.paid_amount), 0);
  const discounted = activeDiscounts.reduce((sum, discount) => sum + cents(discount.amount), 0);
  const open = installments.reduce((sum, item) => sum + cents(openInstallment(item)), 0);
  const settled = completedSales.length > 0 && open === 0 && paid + discounted === bought + opening;
  const settledOn = settled && hasDatedHistory ? dates.sort().pop() ?? null : null;

  return { bought: bought / 100, opening: opening / 100, paid: paid / 100, discounted: discounted / 100,
    cleared: (paid + discounted) / 100, open: open / 100, settled, settledOn, payments, directPayments };
}
