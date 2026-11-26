import Link from "next/link";
import { Users, ChevronRight, MessageCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getAccessContext } from "@/lib/access";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FabButton } from "@/components/ui/FabButton";
import { formatCurrency } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";
import { buildChargeMessage, type ChargeInstallment } from "@/utils/charge-message";
import { ShowMoreLink } from "@/components/ui/ShowMoreLink";
import { LIST_PAGE_SIZE, visibleCount } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export default async function ClientesPage({ searchParams }: { searchParams: { q?: string; mostrar?: string } }) {
  const supabase = createClient();
  const query = searchParams.q?.trim() ?? "";

  function customersQuery(from: number, to: number) {
    let builder = supabase.from("customers").select("id, name, phone, whatsapp, city");
    if (query) builder = builder.ilike("name", `%${query}%`);
    return builder.order("name", { ascending: true }).order("id").range(from, to);
  }

  // Parcelas em aberto já vêm com a venda; das demais vendas basta saber o cliente.
  const [{ data: customers }, { data: openInstallments }, { data: sales }, access] = await Promise.all([
    fetchAll(customersQuery),
    fetchAll((from, to) =>
      supabase
        .from("installments")
        .select("id, installment_number, total_installments, amount, paid_amount, due_date, status, sales!inner(customer_id, sale_number, is_opening_balance)")
        .in("status", ["pendente", "parcial", "vencido"])
        .neq("sales.status", "cancelled")
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase.from("sales").select("customer_id").neq("status", "cancelled").not("customer_id", "is", null).order("id").range(from, to)
    ),
    getAccessContext(),
  ]);
  const canCreate = access?.role !== "cobrador";

  const customersWithPurchases = new Set((sales ?? []).map((sale) => sale.customer_id).filter(Boolean) as string[]);
  const chargesByCustomer = new Map<string, ChargeInstallment[]>();
  ((openInstallments ?? []) as any[]).forEach(({ sales: sale, ...item }) => {
    if (!sale?.customer_id) return;
    const charge: ChargeInstallment = {
      installmentNumber: item.installment_number,
      totalInstallments: item.total_installments,
      saleNumber: sale.sale_number,
      dueDate: item.due_date,
      openAmount: Number(item.amount) - Number(item.paid_amount),
      status: item.status,
      isOpeningBalance: Boolean(sale.is_opening_balance),
    };
    const list = chargesByCustomer.get(sale.customer_id) ?? [];
    list.push(charge);
    chargesByCustomer.set(sale.customer_id, list);
  });

  // A lista cresce sozinha ao rolar (ver ShowMoreLink), em vez de montar todos os clientes de uma vez.
  const shownCount = visibleCount(searchParams.mostrar);
  const visibleCustomers = (customers ?? []).slice(0, shownCount);
  const moreParams = new URLSearchParams();
  if (query) moreParams.set("q", query);
  moreParams.set("mostrar", String(shownCount + LIST_PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1"><SearchBar placeholder="Buscar cliente..." /></div>
        {canCreate && <Link href="/clientes/novo" className="btn-primary hidden px-5 py-3 md:flex">Novo cliente</Link>}
      </div>

      {!customers || customers.length === 0 ? (
        <EmptyState icon={Users} title={query ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"} description={query ? "Tente buscar por outro nome." : "Cadastre seu primeiro cliente para começar a vender."} actionLabel={!query && canCreate ? "Novo cliente" : undefined} actionHref={!query && canCreate ? "/clientes/novo" : undefined} />
      ) : (
        <ul className="card divide-y divide-slate-100 !p-0 overflow-hidden">
          {visibleCustomers.map((c) => {
            const charges = chargesByCustomer.get(c.id) ?? [];
            const balance = charges.reduce((sum, item) => sum + item.openAmount, 0);
            const phone = c.whatsapp ?? c.phone;
            const message = buildChargeMessage(c.name, charges);
            const isSettled = customersWithPurchases.has(c.id) && balance <= 0;

            return (
              <li key={c.id} className={`flex items-center gap-2 px-3 py-3 transition-colors ${isSettled ? "bg-success/5" : "bg-white"}`}>
                <Link href={`/clientes/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1">
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${isSettled ? "bg-success/10 text-success" : "bg-brand-50 text-brand-600"}`}>{c.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className={`truncate text-[14px] font-semibold ${isSettled ? "text-success" : "text-slate-800"}`}>{c.name}</p>
                      {isSettled && <span className="hidden flex-shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success sm:inline-flex"><CheckCircle2 size={11} /> Quitado</span>}
                    </div>
                    <p className="truncate text-[12px] text-slate-500">{c.phone ?? c.city ?? "Sem informações"}</p>
                  </div>
                  {balance > 0 ? <span className="flex-shrink-0 text-[13px] font-bold text-warning">{formatCurrency(balance)}</span> : isSettled ? <span className="flex flex-shrink-0 items-center gap-1 text-[12px] font-bold text-success"><CheckCircle2 size={14} /> Pago</span> : null}
                  <ChevronRight size={18} className={`flex-shrink-0 ${isSettled ? "text-success/50" : "text-slate-300"}`} />
                </Link>
                {balance > 0 && phone && <a href={whatsappLink(phone, message)} target="_blank" rel="noreferrer" aria-label={`Cobrar ${c.name} no WhatsApp`} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-success text-white"><MessageCircle size={18} /></a>}
              </li>
            );
          })}
        </ul>
      )}
      <ShowMoreLink href={`/clientes?${moreParams.toString()}`} remaining={(customers ?? []).length - visibleCustomers.length} shown={visibleCustomers.length} total={(customers ?? []).length} />

      {canCreate && <FabButton href="/clientes/novo" label="Novo cliente" />}
    </div>
  );
}
