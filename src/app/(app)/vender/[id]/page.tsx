import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime, formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  fiado: "Fiado",
  parcelado: "Parcelado",
};

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: sale } = await supabase.from("sales").select("*").eq("id", params.id).single();
  if (!sale) notFound();

  const [{ data: customer }, { data: items }, { data: installments }] = await Promise.all([
    sale.customer_id
      ? supabase.from("customers").select("id, name, phone").eq("id", sale.customer_id).single()
      : Promise.resolve({ data: null } as any),
    supabase.from("sale_items").select("*").eq("sale_id", sale.id).order("created_at"),
    supabase.from("installments").select("*").eq("sale_id", sale.id).order("installment_number"),
  ]);

  const paidInstallments = (installments ?? []).reduce((sum, item) => sum + Number(item.paid_amount), 0);
  const paidTotal = sale.is_paid ? Number(sale.total) : Number(sale.down_payment) + paidInstallments;
  const openTotal = Math.max(0, Number(sale.total) - paidTotal);

  return (
    <div className="space-y-4">
      <Link href="/vender" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500">
        <ChevronLeft size={18} /> Nova venda
      </Link>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Venda #{sale.sale_number}</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(Number(sale.total))}</h1>
            <p className="mt-1 text-sm text-slate-500">{formatDateTime(sale.created_at)} · {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${openTotal > 0 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
            {openTotal > 0 ? `${formatCurrency(openTotal)} em aberto` : "Pago"}
          </span>
        </div>

        {customer && (
          <Link href={`/fichas/${customer.id}`} className="mt-4 flex items-center gap-3 rounded-xl bg-surface-muted p-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-600"><UserRound size={18} /></span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{customer.name}</p>
              <p className="text-xs text-slate-500">Abrir ficha do cliente</p>
            </div>
          </Link>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-[15px] font-bold text-slate-900">Itens da venda</h2>
        <ul className="divide-y divide-slate-100">
          {(items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{item.product_name_snapshot}</p>
                <p className="text-xs text-slate-500">{item.variant_name_snapshot || "Sem variação"} · {item.quantity} x {formatCurrency(Number(item.unit_price_snapshot))}</p>
              </div>
              <span className="text-sm font-bold text-slate-900">{formatCurrency(Number(item.subtotal))}</span>
            </li>
          ))}
        </ul>
      </div>

      {(installments ?? []).length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">Parcelas</h2>
          <ul className="divide-y divide-slate-100">
            {(installments ?? []).map((item) => {
              const open = Number(item.amount) - Number(item.paid_amount);
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Parcela {item.installment_number}/{item.total_installments}</p>
                    <p className="text-xs text-slate-500">Vencimento: {formatDate(item.due_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(Number(item.amount))}</p>
                    <p className={`text-xs font-medium ${open > 0 ? "text-warning" : "text-success"}`}>{open > 0 ? `${formatCurrency(open)} aberto` : "Pago"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {sale.notes && <div className="card"><h2 className="mb-2 text-[15px] font-bold text-slate-900">Observações</h2><p className="text-sm text-slate-600">{sale.notes}</p></div>}
    </div>
  );
}
