import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FabButton } from "@/components/ui/FabButton";
import { formatCurrency } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const query = searchParams.q?.trim() ?? "";

  let customersQuery = supabase
    .from("customers")
    .select("id, name, phone, city")
    .order("name", { ascending: true });

  if (query) {
    customersQuery = customersQuery.ilike("name", `%${query}%`);
  }

  const [{ data: customers }, { data: openInstallments }] = await Promise.all([
    customersQuery,
    supabase
      .from("installments")
      .select("amount, paid_amount, sales!inner(customer_id)")
      .in("status", ["pendente", "parcial", "vencido"]),
  ]);

  const balanceByCustomer = new Map<string, number>();
  (openInstallments ?? []).forEach((i: any) => {
    const customerId = i.sales?.customer_id;
    if (!customerId) return;
    const open = Number(i.amount) - Number(i.paid_amount);
    balanceByCustomer.set(customerId, (balanceByCustomer.get(customerId) ?? 0) + open);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <SearchBar placeholder="Buscar cliente..." />
        </div>
        <Link href="/clientes/novo" className="btn-primary hidden px-5 py-3 md:flex">
          Novo cliente
        </Link>
      </div>

      {!customers || customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={
            query
              ? "Tente buscar por outro nome."
              : "Cadastre seu primeiro cliente para começar a vender."
          }
          actionLabel={query ? undefined : "Novo cliente"}
          actionHref={query ? undefined : "/clientes/novo"}
        />
      ) : (
        <ul className="card divide-y divide-slate-100 !p-0">
          {customers.map((c) => {
            const balance = balanceByCustomer.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3.5">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-[14px] font-bold text-brand-600">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-800">{c.name}</p>
                    <p className="truncate text-[12px] text-slate-500">
                      {c.phone ?? c.city ?? "Sem informações"}
                    </p>
                  </div>
                  {balance > 0 && (
                    <span className="flex-shrink-0 text-[13px] font-bold text-warning">
                      {formatCurrency(balance)}
                    </span>
                  )}
                  <ChevronRight size={18} className="flex-shrink-0 text-slate-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <FabButton href="/clientes/novo" label="Novo cliente" />
    </div>
  );
}
