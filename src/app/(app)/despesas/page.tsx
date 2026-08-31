import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "@/components/finance/ExpenseForm";
import { formatCurrency, formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function DespesasPage() {
  const supabase = createClient();
  const { data: expenses } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(100);
  const total = (expenses ?? []).reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <ExpenseForm />
      <div className="space-y-4">
        <div className="card flex items-center justify-between"><div><p className="text-sm text-slate-500">Total lançado</p><p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(total)}</p></div><span className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{expenses?.length ?? 0} despesa(s)</span></div>
        <div className="card !p-0">
          {!expenses || expenses.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Nenhuma despesa lançada.</p> : (
            <ul className="divide-y divide-slate-100">
              {expenses.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{item.description}</p><p className="text-xs capitalize text-slate-500">{item.category} · {formatDate(item.expense_date)}</p></div><span className="text-sm font-bold text-danger">-{formatCurrency(Number(item.amount))}</span></li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
