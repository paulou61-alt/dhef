import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const supabase = createClient();
  const [{ data: sales }, { data: items }, { data: customers }, { data: expenses }] = await Promise.all([
    supabase.from("sales").select("id, customer_id, total, status, created_at").eq("status", "completed"),
    supabase.from("sale_items").select("sale_id, product_name_snapshot, quantity, unit_cost_snapshot, unit_price_snapshot, subtotal"),
    supabase.from("customers").select("id, name"),
    supabase.from("expenses").select("amount, category, expense_date"),
  ]);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthSales = (sales ?? []).filter((s) => String(s.created_at).slice(0, 7) === monthKey);
  const monthSaleIds = new Set(monthSales.map((s) => s.id));
  const monthItems = (items ?? []).filter((i) => monthSaleIds.has(i.sale_id));
  const monthExpenses = (expenses ?? []).filter((e) => String(e.expense_date).slice(0, 7) === monthKey);

  const revenue = monthSales.reduce((sum, s) => sum + Number(s.total), 0);
  const cost = monthItems.reduce((sum, i) => sum + Number(i.unit_cost_snapshot) * Number(i.quantity), 0);
  const expenseTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netProfit = revenue - cost - expenseTotal;
  const units = monthItems.reduce((sum, i) => sum + Number(i.quantity), 0);
  const averageTicket = monthSales.length ? revenue / monthSales.length : 0;

  const customerMap = new Map((customers ?? []).map((c) => [c.id, c.name]));
  const customerTotals = new Map<string, number>();
  monthSales.forEach((sale) => {
    if (!sale.customer_id) return;
    customerTotals.set(sale.customer_id, (customerTotals.get(sale.customer_id) ?? 0) + Number(sale.total));
  });
  const topCustomers = [...customerTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const productTotals = new Map<string, { qty: number; revenue: number }>();
  monthItems.forEach((item) => {
    const current = productTotals.get(item.product_name_snapshot) ?? { qty: 0, revenue: 0 };
    current.qty += Number(item.quantity);
    current.revenue += Number(item.subtotal);
    productTotals.set(item.product_name_snapshot, current);
  });
  const topProducts = [...productTotals.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Relatório do mês</h1>
        <p className="mt-1 text-sm text-slate-500">Visão consolidada de vendas, custos e despesas do mês atual.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card"><p className="text-xs text-slate-500">Faturamento</p><p className="mt-1 text-xl font-bold text-brand-600">{formatCurrency(revenue)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Lucro estimado</p><p className={`mt-1 text-xl font-bold ${netProfit >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(netProfit)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Despesas</p><p className="mt-1 text-xl font-bold text-danger">{formatCurrency(expenseTotal)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Vendas</p><p className="mt-1 text-xl font-bold text-slate-900">{monthSales.length}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Pares/itens vendidos</p><p className="mt-1 text-xl font-bold text-slate-900">{units}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Ticket médio</p><p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(averageTicket)}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">Clientes que mais compraram</h2>
          {topCustomers.length === 0 ? <p className="text-sm text-slate-500">Sem dados neste mês.</p> : (
            <ol className="space-y-3">{topCustomers.map(([id, total], index) => <li key={id} className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{index + 1}</span><span className="text-sm font-semibold text-slate-800">{customerMap.get(id) ?? "Cliente"}</span></div><span className="text-sm font-bold text-slate-900">{formatCurrency(total)}</span></li>)}</ol>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">Produtos mais vendidos</h2>
          {topProducts.length === 0 ? <p className="text-sm text-slate-500">Sem dados neste mês.</p> : (
            <ol className="space-y-3">{topProducts.map(([name, data], index) => <li key={name} className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{index + 1}</span><div><p className="text-sm font-semibold text-slate-800">{name}</p><p className="text-xs text-slate-500">{data.qty} unidade(s)</p></div></div><span className="text-sm font-bold text-slate-900">{formatCurrency(data.revenue)}</span></li>)}</ol>
          )}
        </div>
      </div>
    </div>
  );
}
