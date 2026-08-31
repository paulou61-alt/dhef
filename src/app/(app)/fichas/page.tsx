import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SearchBar } from "@/components/ui/SearchBar";
import { formatCurrency } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function FichasPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const query = searchParams.q?.trim() ?? "";
  let customerQuery = supabase.from("customers").select("id, name, phone, city").order("name");
  if (query) customerQuery = customerQuery.ilike("name", `%${query}%`);

  const [{ data: customers }, { data: sales }, { data: installments }] = await Promise.all([
    customerQuery,
    supabase.from("sales").select("id, customer_id, total, status").eq("status", "completed"),
    supabase.from("installments").select("sale_id, amount, paid_amount, status"),
  ]);

  const salesByCustomer = new Map<string, { count: number; total: number; saleIds: string[] }>();
  (sales ?? []).forEach((sale) => {
    if (!sale.customer_id) return;
    const current = salesByCustomer.get(sale.customer_id) ?? { count: 0, total: 0, saleIds: [] };
    current.count += 1;
    current.total += Number(sale.total);
    current.saleIds.push(sale.id);
    salesByCustomer.set(sale.customer_id, current);
  });
  const installmentBySale = new Map<string, number>();
  (installments ?? []).forEach((i) => {
    if (i.status === "pago") return;
    installmentBySale.set(i.sale_id, (installmentBySale.get(i.sale_id) ?? 0) + Number(i.amount) - Number(i.paid_amount));
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Fichas</h1>
        <p className="mt-1 text-sm text-slate-500">Ficha completa de cada cliente, com compras, valores pagos e saldo em aberto.</p>
      </div>
      <SearchBar placeholder="Buscar ficha por cliente..." />

      {!customers || customers.length === 0 ? (
        <div className="card py-12 text-center"><ClipboardList className="mx-auto mb-2 text-slate-300" size={30} /><p className="text-sm text-slate-500">Nenhuma ficha encontrada.</p></div>
      ) : (
        <div className="card divide-y divide-slate-100 !p-0">
          {customers.map((customer) => {
            const stats = salesByCustomer.get(customer.id) ?? { count: 0, total: 0, saleIds: [] };
            const open = stats.saleIds.reduce((sum, id) => sum + (installmentBySale.get(id) ?? 0), 0);
            return (
              <Link key={customer.id} href={`/fichas/${customer.id}`} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">{customer.name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{customer.name}</p><p className="text-xs text-slate-500">{stats.count} compra(s) · {formatCurrency(stats.total)} comprado</p></div>
                {open > 0 && <div className="text-right"><p className="text-xs text-slate-500">Em aberto</p><p className="text-sm font-bold text-warning">{formatCurrency(open)}</p></div>}
                <ChevronRight size={18} className="text-slate-300" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
