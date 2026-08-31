import { createClient } from "@/lib/supabase/server";
import { ReceiveButton } from "@/components/finance/ReceiveButton";
import { formatCurrency, formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function ReceberPage() {
  const supabase = createClient();
  const [{ data: installments }, { data: sales }, { data: customers }] = await Promise.all([
    supabase.from("installments").select("*").in("status", ["pendente", "parcial", "vencido"]).order("due_date"),
    supabase.from("sales").select("id, customer_id, sale_number"),
    supabase.from("customers").select("id, name"),
  ]);

  const saleMap = new Map((sales ?? []).map((s) => [s.id, s]));
  const customerMap = new Map((customers ?? []).map((c) => [c.id, c]));
  const totalOpen = (installments ?? []).reduce((sum, i) => sum + (Number(i.amount) - Number(i.paid_amount)), 0);

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <div><p className="text-sm text-slate-500">Total a receber</p><p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalOpen)}</p></div>
        <div className="rounded-xl bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">{installments?.length ?? 0} parcela(s)</div>
      </div>

      {!installments || installments.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">Nenhuma parcela em aberto.</div>
      ) : (
        <div className="card divide-y divide-slate-100 !p-0">
          {installments.map((item) => {
            const sale = saleMap.get(item.sale_id);
            const customer = sale?.customer_id ? customerMap.get(sale.customer_id) : null;
            const open = Number(item.amount) - Number(item.paid_amount);
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{customer?.name ?? "Cliente não informado"}</p>
                  <p className="text-xs text-slate-500">Venda #{sale?.sale_number ?? "-"} · Parcela {item.installment_number}/{item.total_installments} · {formatDate(item.due_date)}</p>
                </div>
                <div className="text-right"><p className="text-sm font-bold text-slate-900">{formatCurrency(open)}</p><p className={`text-[11px] font-semibold ${item.status === "vencido" ? "text-danger" : "text-warning"}`}>{item.status === "vencido" ? "Vencida" : item.status === "parcial" ? "Parcial" : "Pendente"}</p></div>
                <ReceiveButton installmentId={item.id} openAmount={open} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
