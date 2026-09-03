import Link from "next/link";
import { ClipboardList, ChevronRight, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SearchBar } from "@/components/ui/SearchBar";
import { formatCurrency } from "@/utils/format";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; colaborador?: string };

function categoryHref(id: string | null, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (id) params.set("colaborador", id);
  const suffix = params.toString();
  return `/fichas${suffix ? `?${suffix}` : ""}`;
}

export default async function FichasPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const query = searchParams.q?.trim() ?? "";
  const collaboratorFilter = searchParams.colaborador ?? "";

  let customerQuery = supabase
    .from("customers")
    .select("id, name, phone, city, ficha_number, assigned_collaborator_id")
    .order("ficha_number", { ascending: true });

  if (query) {
    if (/^\d+$/.test(query)) customerQuery = customerQuery.eq("ficha_number", Number(query));
    else customerQuery = customerQuery.ilike("name", `%${query}%`);
  }
  if (collaboratorFilter === "sem") customerQuery = customerQuery.is("assigned_collaborator_id", null);
  else if (collaboratorFilter) customerQuery = customerQuery.eq("assigned_collaborator_id", collaboratorFilter);

  const [{ data: customers }, { data: collaborators }, { data: sales }, { data: installments }] = await Promise.all([
    customerQuery,
    supabase.from("collaborators").select("id, name, role").eq("is_active", true).order("name"),
    supabase.from("sales").select("id, customer_id, total, status, is_opening_balance").eq("status", "completed"),
    supabase.from("installments").select("sale_id, amount, paid_amount, status"),
  ]);

  const collaboratorMap = new Map((collaborators ?? []).map((c) => [c.id, c]));
  const salesByCustomer = new Map<string, { count: number; total: number; saleIds: string[] }>();
  (sales ?? []).forEach((sale) => {
    if (!sale.customer_id) return;
    const current = salesByCustomer.get(sale.customer_id) ?? { count: 0, total: 0, saleIds: [] };
    if (!sale.is_opening_balance) {
      current.count += 1;
      current.total += Number(sale.total);
    }
    current.saleIds.push(sale.id);
    salesByCustomer.set(sale.customer_id, current);
  });

  const installmentBySale = new Map<string, number>();
  (installments ?? []).forEach((i) => {
    if (i.status === "pago") return;
    installmentBySale.set(i.sale_id, (installmentBySale.get(i.sale_id) ?? 0) + Number(i.amount) - Number(i.paid_amount));
  });

  const grouped = new Map<string, typeof customers>();
  (customers ?? []).forEach((customer) => {
    const key = customer.assigned_collaborator_id ?? "sem";
    grouped.set(key, [...(grouped.get(key) ?? []), customer]);
  });

  const groupKeys = Array.from(grouped.keys()).sort((a, b) => {
    if (a === "sem") return 1;
    if (b === "sem") return -1;
    return (collaboratorMap.get(a)?.name ?? "").localeCompare(collaboratorMap.get(b)?.name ?? "", "pt-BR");
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Fichas</h1>
        <p className="mt-1 text-sm text-slate-500">Fichas numeradas e organizadas por colaborador responsável.</p>
      </div>

      <SearchBar placeholder="Buscar por nome ou número da ficha..." />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link href={categoryHref(null, query)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${!collaboratorFilter ? "bg-brand-500 text-white" : "bg-white text-slate-600"}`}>Todos</Link>
        {(collaborators ?? []).map((collaborator) => (
          <Link key={collaborator.id} href={categoryHref(collaborator.id, query)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${collaboratorFilter === collaborator.id ? "bg-brand-500 text-white" : "bg-white text-slate-600"}`}>
            {collaborator.name}
          </Link>
        ))}
        <Link href={categoryHref("sem", query)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${collaboratorFilter === "sem" ? "bg-brand-500 text-white" : "bg-white text-slate-600"}`}>Sem colaborador</Link>
      </div>

      {!customers || customers.length === 0 ? (
        <div className="card py-12 text-center">
          <ClipboardList className="mx-auto mb-2 text-slate-300" size={30} />
          <p className="text-sm text-slate-500">Nenhuma ficha encontrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupKeys.map((key) => {
            const groupCustomers = grouped.get(key) ?? [];
            const collaborator = key === "sem" ? null : collaboratorMap.get(key);
            return (
              <section key={key} className="card !p-0 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-surface-muted px-4 py-3">
                  <Users size={16} className="text-brand-600" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{collaborator?.name ?? "Sem colaborador"}</p>
                    <p className="text-[11px] text-slate-500">{groupCustomers.length} ficha(s)</p>
                  </div>
                  {collaborator && <span className="text-[11px] font-semibold text-slate-400">{collaborator.role === "vendedor" ? "Vendedor" : "Cobrador"}</span>}
                </div>

                <div className="divide-y divide-slate-100">
                  {groupCustomers.map((customer) => {
                    const stats = salesByCustomer.get(customer.id) ?? { count: 0, total: 0, saleIds: [] };
                    const open = stats.saleIds.reduce((sum, id) => sum + (installmentBySale.get(id) ?? 0), 0);
                    return (
                      <Link key={customer.id} href={`/fichas/${customer.id}`} className="flex items-center gap-3 px-4 py-3.5">
                        <span className="flex h-11 min-w-11 items-center justify-center rounded-xl bg-brand-50 px-2 text-xs font-bold text-brand-700">#{customer.ficha_number}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{customer.name}</p>
                          <p className="text-xs text-slate-500">{stats.count} compra(s) · {formatCurrency(stats.total)} comprado</p>
                        </div>
                        {open > 0 && <div className="text-right"><p className="text-xs text-slate-500">Em aberto</p><p className="text-sm font-bold text-warning">{formatCurrency(open)}</p></div>}
                        <ChevronRight size={18} className="text-slate-300" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
