import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const supabase = createClient();
  const [{ data: movements }, { data: installments }, { data: saleItems }] = await Promise.all([
    supabase.from("cash_movements").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("installments").select("amount, paid_amount, status"),
    supabase.from("sale_items").select("quantity, unit_cost_snapshot, unit_price_snapshot"),
  ]);

  const entries = (movements ?? []).filter((m) => m.type === "entrada").reduce((s, m) => s + Number(m.amount), 0);
  const exits = (movements ?? []).filter((m) => m.type === "saida").reduce((s, m) => s + Number(m.amount), 0);
  const balance = entries - exits;
  const receivable = (installments ?? []).filter((i) => i.status !== "pago").reduce((s, i) => s + Number(i.amount) - Number(i.paid_amount), 0);
  const grossProfit = (saleItems ?? []).reduce((s, i) => s + (Number(i.unit_price_snapshot) - Number(i.unit_cost_snapshot)) * Number(i.quantity), 0);
  const estimatedNet = grossProfit - exits;

  const cards = [
    ["Saldo de caixa", balance, balance >= 0 ? "text-success" : "text-danger"],
    ["Entradas", entries, "text-success"],
    ["Saídas", exits, "text-danger"],
    ["A receber", receivable, "text-warning"],
    ["Lucro bruto", grossProfit, "text-brand-600"],
    ["Lucro estimado", estimatedNet, estimatedNet >= 0 ? "text-success" : "text-danger"],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([label, value, tone]) => (
          <div key={label} className="card"><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${tone}`}>{formatCurrency(value)}</p></div>
        ))}
      </div>

      <div className="card !p-0">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-[15px] font-bold text-slate-900">Movimentações de caixa</h2></div>
        {!movements || movements.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nenhuma movimentação ainda.</p> : (
          <ul className="divide-y divide-slate-100">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{m.description || "Movimentação"}</p><p className="text-xs capitalize text-slate-500">{m.origin} · {formatDateTime(m.created_at)}</p></div>
                <span className={`text-sm font-bold ${m.type === "entrada" ? "text-success" : "text-danger"}`}>{m.type === "entrada" ? "+" : "-"}{formatCurrency(Number(m.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
