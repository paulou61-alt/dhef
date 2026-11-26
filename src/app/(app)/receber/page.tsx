import { CheckCircle2, ChevronRight, Search, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FichaBadge, InitialsAvatar, StatusPill } from "@/components/ui/Badges";
import { CountUp } from "@/components/dashboard/CountUp";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { ReceiveButton } from "@/components/finance/ReceiveButton";
import { getAccessContext } from "@/lib/access";
import { CollaboratorFilterSelect } from "@/components/finance/CollaboratorFilterSelect";
import { PurchaseCatalogProvider } from "@/components/sales/PurchaseCatalog";
import { ShowMoreLink } from "@/components/ui/ShowMoreLink";
import { LIST_PAGE_SIZE, visibleCount } from "@/lib/pagination";
import { formatCurrency, formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

type SaleSummary = {
  id: string;
  customer_id: string | null;
  sale_number: number | string | null;
  is_opening_balance: boolean;
};

type CustomerSummary = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  ficha_number: number | null;
  assigned_collaborator_id: string | null;
  write_off_status?: string | null;
};

type DebtInstallment = {
  id: string;
  sale_id: string;
  amount: number | string;
  paid_amount: number | string | null;
  due_date: string;
  installment_number: number;
  total_installments: number;
  status: string;
};

type DebtLine = {
  item: DebtInstallment;
  sale: SaleSummary | undefined;
  open: number;
};

type Debtor = {
  key: string;
  customer: CustomerSummary | null;
  items: DebtLine[];
  total: number;
  overdue: number;
  nextDue: string | null;
};

function phoneLabel(customer: CustomerSummary | null) {
  if (!customer) return "Não informado";
  return customer.whatsapp || customer.phone || "Não informado";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export default async function ReceberPage({
  searchParams,
}: {
  searchParams?: { q?: string; colaborador?: string; aberto?: string; mostrar?: string };
}) {
  const supabase = createClient();
  // Só as parcelas em aberto, já com a venda e o cliente de cada uma.
  // Antes a tela baixava todas as vendas e todos os clientes já cadastrados.
  const [
    { data: installments },
    { data: collaborators },
    { data: products },
    { data: variants },
    access,
  ] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("installments")
        .select(
          "id, sale_id, amount, paid_amount, due_date, installment_number, total_installments, status, " +
            "sales(id, customer_id, sale_number, is_opening_balance, customers(id, name, phone, whatsapp, ficha_number, assigned_collaborator_id, write_off_status))"
        )
        .in("status", ["pendente", "parcial", "vencido"])
        .order("due_date")
        .order("id")
        .range(from, to)
    ),
    supabase.from("collaborators").select("id, name, role, is_active").order("name"),
    fetchAll((from, to) => supabase.from("products").select("id, name, sale_price").eq("is_active", true).order("name").order("id").range(from, to)),
    fetchAll((from, to) =>
      supabase.from("product_variants").select("id, product_id, variant_name, stock_quantity, sale_price").order("variant_name").order("id").range(from, to)
    ),
    getAccessContext(),
  ]);

  // "Quem cobrou" no recebimento: só o proprietário escolhe, entre os cobradores ativos.
  const collectors = access?.role === "owner"
    ? (collaborators ?? []).filter((collaborator) => collaborator.role === "cobrador" && collaborator.is_active).map(({ id, name }) => ({ id, name }))
    : [];

  const debtorMap = new Map<string, Debtor>();

  for (const rawInstallment of (installments ?? []) as any[]) {
    const { sales: rawSale, ...item } = rawInstallment as DebtInstallment & { sales: (SaleSummary & { customers: CustomerSummary | null }) | null };
    const sale: SaleSummary | undefined = rawSale ? { id: rawSale.id, customer_id: rawSale.customer_id, sale_number: rawSale.sale_number, is_opening_balance: rawSale.is_opening_balance } : undefined;
    const customer = rawSale?.customers ?? null;
    // Clientes marcados como prego ou mudou saem da lista de recebimentos.
    if (customer?.write_off_status) continue;
    const key = customer?.id ?? `sem-cliente-${item.sale_id}`;
    const open = Math.max(0, Number(item.amount) - Number(item.paid_amount ?? 0));

    const debtor = debtorMap.get(key) ?? {
      key,
      customer,
      items: [],
      total: 0,
      overdue: 0,
      nextDue: null,
    };

    debtor.items.push({ item, sale, open });
    debtor.total += open;
    if (item.status === "vencido") debtor.overdue += 1;
    if (!debtor.nextDue || item.due_date < debtor.nextDue) debtor.nextDue = item.due_date;
    debtorMap.set(key, debtor);
  }

  const debtors = Array.from(debtorMap.values()).sort((a, b) => {
    const fichaA = a.customer?.ficha_number;
    const fichaB = b.customer?.ficha_number;

    if (fichaA != null && fichaB != null && fichaA !== fichaB) return fichaA - fichaB;
    if (fichaA != null && fichaB == null) return -1;
    if (fichaA == null && fichaB != null) return 1;

    return (a.customer?.name ?? "").localeCompare(b.customer?.name ?? "", "pt-BR");
  });

  const rawQuery = searchParams?.q ?? "";
  const query = normalizeSearch(rawQuery);
  const numericQuery = rawQuery.replace(/\D/g, "");
  const collaboratorFilter = searchParams?.colaborador ?? "";

  const filteredDebtors = debtors.filter((debtor) => {
    let matchesCollaborator = true;
    if (collaboratorFilter === "sem-colaborador") {
      matchesCollaborator = !debtor.customer?.assigned_collaborator_id;
    } else if (collaboratorFilter) {
      matchesCollaborator = debtor.customer?.assigned_collaborator_id === collaboratorFilter;
    }

    if (!matchesCollaborator) return false;

    if (!query) return true;

    const ficha = debtor.customer?.ficha_number != null ? String(debtor.customer.ficha_number) : "";
    const name = normalizeSearch(debtor.customer?.name ?? "");
    return (numericQuery.length > 0 && ficha.includes(numericQuery)) || name.includes(query);
  });

  // Depois de um recebimento, a ficha do cliente volta aberta no mesmo lugar.
  const openKey = searchParams?.aberto ?? "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const paidOffCustomer = openKey && !debtorMap.has(openKey) && uuid.test(openKey)
    ? (await supabase.from("customers").select("id, name, ficha_number").eq("id", openKey).maybeSingle()).data
    : null;

  function successHrefFor(key: string) {
    const params = new URLSearchParams();
    if (rawQuery) params.set("q", rawQuery);
    if (collaboratorFilter) params.set("colaborador", collaboratorFilter);
    params.set("aberto", key);
    return `/receber?${params.toString()}#ficha-${key}`;
  }

  // Listas grandes travavam o celular: mostra os primeiros e um "Mostrar mais".
  // A ficha que acabou de receber um pagamento continua visível.
  const openIndex = openKey ? filteredDebtors.findIndex((debtor) => debtor.key === openKey) : -1;
  const shownCount = Math.max(visibleCount(searchParams?.mostrar), openIndex + 1);
  const visibleDebtors = filteredDebtors.slice(0, shownCount);
  const moreParams = new URLSearchParams();
  if (rawQuery) moreParams.set("q", rawQuery);
  if (collaboratorFilter) moreParams.set("colaborador", collaboratorFilter);
  moreParams.set("mostrar", String(shownCount + LIST_PAGE_SIZE));

  const totalOpen = filteredDebtors.reduce((sum, debtor) => sum + debtor.total, 0);
  const totalInstallments = filteredDebtors.reduce((sum, debtor) => sum + debtor.items.length, 0);

  const overdueDebtors = filteredDebtors.filter((debtor) => debtor.overdue > 0).length;

  return (
    <div className="space-y-4">
      <PageHeader icon={Wallet} eyebrow="Recebimentos" title="Receber" subtitle="Encontre a ficha do cliente e registre o pagamento." />

      <section className="glass animate-rise p-5 md:p-6" style={{ animationDelay: "100ms" }}>
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-[13px] font-medium text-slate-500">Total a receber{collaboratorFilter || query ? " (filtro aplicado)" : ""}</p>
            <p className="mt-2 whitespace-nowrap text-[34px] font-semibold leading-none tracking-[-0.04em] text-slate-900 md:text-[42px]">
              <CountUp value={totalOpen} format="currency" className="text-shine" />
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-slate-200/70 bg-white/60 px-3.5 py-2.5 dark:border-white/[.07] dark:!bg-white/[.03]"><dt className="text-[11.5px] text-slate-500">Clientes</dt><dd className="mt-0.5 text-[18px] font-semibold text-slate-900"><CountUp value={filteredDebtors.length} delay={150} /></dd></div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/60 px-3.5 py-2.5 dark:border-white/[.07] dark:!bg-white/[.03]"><dt className="text-[11.5px] text-slate-500">Parcelas</dt><dd className="mt-0.5 text-[18px] font-semibold text-slate-900"><CountUp value={totalInstallments} delay={200} /></dd></div>
            <div className="rounded-2xl border border-rose-200/80 bg-rose-50/70 px-3.5 py-2.5 dark:border-rose-400/20 dark:!bg-rose-500/[.07]"><dt className="text-[11.5px] text-rose-700">Com atraso</dt><dd className="mt-0.5 text-[18px] font-semibold text-rose-700"><CountUp value={overdueDebtors} delay={250} /></dd></div>
          </dl>
        </div>
      </section>

      <section className="glass animate-rise p-4 md:p-5" style={{ animationDelay: "160ms" }}>
        <form method="get" className="grid gap-3 md:grid-cols-[1fr_260px_auto] md:items-end">
          <div className="min-w-0">
            <label htmlFor="busca-ficha" className="label">Pesquisar ficha</label>
            <div className="relative">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="busca-ficha"
                type="search"
                name="q"
                defaultValue={rawQuery}
                className="input-field pl-11"
                placeholder="Número da ficha ou nome do cliente"
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label htmlFor="colaborador" className="label">Colaborador</label>
            <CollaboratorFilterSelect
              collaborators={(collaborators ?? []) as { id: string; name: string }[]}
              defaultValue={collaboratorFilter}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 md:flex-none md:px-6">Pesquisar</button>
            {(query || collaboratorFilter) && (
              <a href="/receber" className="btn-secondary px-4">Limpar</a>
            )}
          </div>
        </form>
        {(query || collaboratorFilter) && (
          <p className="mt-3 text-xs text-slate-500">
            {filteredDebtors.length} cliente(s) encontrado(s)
            {query && <> para <span className="font-semibold text-slate-700">“{rawQuery}”</span></>}
            {collaboratorFilter && " · filtro de colaborador ativo"}.
          </p>
        )}
      </section>

      {paidOffCustomer && (
        <div className="animate-rise flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4 dark:border-emerald-400/20">
          <CheckCircle2 size={20} className="flex-none text-emerald-600" />
          <p className="text-sm text-slate-700">
            Recebimento registrado. <span className="font-semibold">{paidOffCustomer.name}</span>
            {paidOffCustomer.ficha_number != null ? ` (ficha #${paidOffCustomer.ficha_number})` : ""} não tem mais valores em aberto.
          </p>
        </div>
      )}

      {debtors.length === 0 ? (
        <div className="glass py-12 text-center text-sm text-slate-500">Nenhum cliente com valor em aberto.</div>
      ) : filteredDebtors.length === 0 ? (
        <div className="glass py-12 text-center">
          <p className="text-sm font-semibold text-slate-900">Nenhuma ficha encontrada.</p>
          <p className="mt-1 text-xs text-slate-500">Tente pesquisar por outro número de ficha ou nome.</p>
        </div>
      ) : (
        <PurchaseCatalogProvider products={(products ?? []) as any} variants={(variants ?? []) as any}>
        <section className="glass animate-rise" style={{ animationDelay: "220ms" }}>
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Clientes devendo</h2>
              <p className="text-[12.5px] text-slate-500">Pela ordem da ficha. Toque no cliente para ver as parcelas.</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {visibleDebtors.map((debtor) => {
              const customerName = debtor.customer?.name ?? "Cliente não informado";

              return (
                <details key={debtor.key} id={`ficha-${debtor.key}`} open={debtor.key === openKey} className="group scroll-mt-24">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-slate-50/80 md:px-5 [&::-webkit-details-marker]:hidden">
                    <InitialsAvatar name={customerName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <FichaBadge number={debtor.customer?.ficha_number} />
                        <p className="truncate text-[14px] font-medium text-slate-900">{customerName}</p>
                      </div>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        {debtor.items.length} {debtor.items.length === 1 ? "parcela" : "parcelas"} em aberto
                        {debtor.overdue > 0 ? <> · <span className="text-rose-600 dark:text-rose-300">{debtor.overdue} vencida(s)</span></> : ""}
                      </p>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-0.5">
                      <p className="whitespace-nowrap text-[14px] font-semibold tabular-nums text-slate-900">{formatCurrency(debtor.total)}</p>
                      <StatusPill tone={debtor.overdue > 0 ? "danger" : "warning"} className="!px-1.5 !py-0 !text-[10.5px]">{debtor.overdue > 0 ? "Em atraso" : "A receber"}</StatusPill>
                    </div>
                    <ChevronRight size={17} className="flex-none text-slate-300 transition-transform group-open:rotate-90 group-hover:text-brand-500" />
                  </summary>

                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 md:px-5">
                    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        ["Ficha", `#${debtor.customer?.ficha_number ?? "-"}`],
                        ["Cliente", customerName],
                        ["Telefone", phoneLabel(debtor.customer)],
                        ["Total devido", formatCurrency(debtor.total)],
                      ].map(([label, value]) => (
                        <div key={label} className="min-w-0 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2 dark:border-white/[.07] dark:!bg-white/[.03]">
                          <p className="text-[11px] text-slate-500">{label}</p>
                          <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {debtor.items.map(({ item, sale, open }) => (
                        <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white/80 p-3 dark:border-white/[.07] dark:!bg-white/[.03] sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-medium text-slate-900">
                              {sale?.is_opening_balance ? (
                                <span className="text-amber-700">Saldo devedor inicial</span>
                              ) : (
                                <>
                                  Parcela {item.installment_number}/{item.total_installments}
                                  <span className="font-normal text-slate-400"> · Venda #{sale?.sale_number ?? "-"}</span>
                                </>
                              )}
                            </p>
                            <p className="mt-0.5 text-[12px] text-slate-500">Vencimento: {formatDate(item.due_date)}</p>
                          </div>

                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <div className="text-left sm:text-right">
                              <p className="text-[14px] font-semibold tabular-nums text-slate-900">{formatCurrency(open)}</p>
                              <StatusPill tone={item.status === "vencido" ? "danger" : item.status === "parcial" ? "brand" : "warning"} className="!px-1.5 !py-0 !text-[10.5px]">
                                {item.status === "vencido" ? "Vencida" : item.status === "parcial" ? "Parcial" : "Pendente"}
                              </StatusPill>
                            </div>
                            <ReceiveButton
                              installmentId={item.id}
                              openAmount={open}
                              successHref={successHrefFor(debtor.key)}
                              allowDiscount={access?.role === "owner"}
                              collectors={collectors}
                              defaultCollectorId={debtor.customer?.assigned_collaborator_id ?? ""}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
        <ShowMoreLink href={`/receber?${moreParams.toString()}`} remaining={filteredDebtors.length - visibleDebtors.length} shown={visibleDebtors.length} total={filteredDebtors.length} />
        </PurchaseCatalogProvider>
      )}
    </div>
  );
}
