import Link from "next/link";
import { Users, ChevronRight, MessageCircle, Plus } from "lucide-react";
import { PageHeader, headerPrimaryButton } from "@/components/ui/PageHeader";
import { InitialsAvatar, StatusPill } from "@/components/ui/Badges";
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

  const owingCount = (customers ?? []).filter((c) => (chargesByCustomer.get(c.id) ?? []).some((item) => item.openAmount > 0)).length;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Users}
        eyebrow="Carteira de clientes"
        title="Clientes"
        subtitle={`${(customers ?? []).length} ${query ? "encontrado(s)" : "cadastrado(s)"} · ${owingCount} com saldo em aberto`}
        actions={canCreate ? <Link href="/clientes/novo" className={`${headerPrimaryButton} hidden md:flex`}><Plus size={16} /> Novo cliente</Link> : undefined}
      />

      <div className="animate-rise" style={{ animationDelay: "100ms" }}><SearchBar placeholder="Buscar cliente..." /></div>

      {!customers || customers.length === 0 ? (
        <EmptyState icon={Users} title={query ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"} description={query ? "Tente buscar por outro nome." : "Cadastre seu primeiro cliente para começar a vender."} actionLabel={!query && canCreate ? "Novo cliente" : undefined} actionHref={!query && canCreate ? "/clientes/novo" : undefined} />
      ) : (
        <ul className="glass animate-rise divide-y divide-slate-100" style={{ animationDelay: "160ms" }}>
          {visibleCustomers.map((c) => {
            const charges = chargesByCustomer.get(c.id) ?? [];
            const balance = charges.reduce((sum, item) => sum + item.openAmount, 0);
            const overdue = charges.some((item) => item.status === "vencido");
            const phone = c.whatsapp ?? c.phone;
            const message = buildChargeMessage(c.name, charges);
            const isSettled = customersWithPurchases.has(c.id) && balance <= 0;

            return (
              <li key={c.id} className="group flex items-center gap-2 px-3 py-2.5 transition hover:bg-slate-50/80 md:px-4">
                <Link href={`/clientes/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1">
                  <InitialsAvatar name={c.name} tone={isSettled ? "success" : "brand"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-slate-900">{c.name}</p>
                    <p className="truncate text-[12px] text-slate-500">{c.phone ?? c.city ?? "Sem informações"}</p>
                  </div>
                  {balance > 0 ? (
                    <div className="flex flex-none flex-col items-end gap-0.5">
                      <span className="whitespace-nowrap text-[14px] font-semibold tabular-nums text-slate-900">{formatCurrency(balance)}</span>
                      <StatusPill tone={overdue ? "danger" : "warning"} className="!px-1.5 !py-0 !text-[10.5px]">{overdue ? "Em atraso" : "A receber"}</StatusPill>
                    </div>
                  ) : isSettled ? (
                    <StatusPill tone="success">Quitado</StatusPill>
                  ) : null}
                  <ChevronRight size={17} className="flex-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </Link>
                {balance > 0 && phone && (
                  <a href={whatsappLink(phone, message)} target="_blank" rel="noreferrer" aria-label={`Cobrar ${c.name} no WhatsApp`} className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-600/15 transition hover:bg-emerald-100 dark:text-emerald-300 dark:ring-emerald-400/25">
                    <MessageCircle size={17} />
                  </a>
                )}
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
