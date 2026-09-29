import { CheckCircle2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ReceiveButton } from "@/components/finance/ReceiveButton";
import { CollaboratorFilterSelect } from "@/components/finance/CollaboratorFilterSelect";
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
  searchParams?: { q?: string; colaborador?: string; aberto?: string };
}) {
  const supabase = createClient();
  const [
    { data: installments },
    { data: sales },
    { data: customers },
    { data: collaborators },
    { data: products },
    { data: variants },
  ] = await Promise.all([
    supabase.from("installments").select("*").in("status", ["pendente", "parcial", "vencido"]).order("due_date"),
    supabase.from("sales").select("id, customer_id, sale_number, is_opening_balance"),
    supabase.from("customers").select("id, name, phone, whatsapp, ficha_number, assigned_collaborator_id"),
    supabase.from("collaborators").select("id, name").order("name"),
    supabase.from("products").select("id, name, sale_price").eq("is_active", true).order("name"),
    supabase.from("product_variants").select("id, product_id, variant_name, stock_quantity, sale_price").order("variant_name"),
  ]);

  const saleMap = new Map<string, SaleSummary>(
    (sales ?? []).map((sale) => [sale.id, sale as SaleSummary]),
  );
  const customerMap = new Map<string, CustomerSummary>(
    (customers ?? []).map((customer) => [customer.id, customer as CustomerSummary]),
  );

  const debtorMap = new Map<string, Debtor>();

  for (const rawInstallment of installments ?? []) {
    const item = rawInstallment as DebtInstallment;
    const sale = saleMap.get(item.sale_id);
    const customer = sale?.customer_id ? customerMap.get(sale.customer_id) ?? null : null;
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
  const paidOffCustomer = openKey && !debtorMap.has(openKey) ? customerMap.get(openKey) ?? null : null;

  function successHrefFor(key: string) {
    const params = new URLSearchParams();
    if (rawQuery) params.set("q", rawQuery);
    if (collaboratorFilter) params.set("colaborador", collaboratorFilter);
    params.set("aberto", key);
    return `/receber?${params.toString()}#ficha-${key}`;
  }

  const totalOpen = filteredDebtors.reduce((sum, debtor) => sum + debtor.total, 0);
  const totalInstallments = filteredDebtors.reduce((sum, debtor) => sum + debtor.items.length, 0);

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Total a receber</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalOpen)}</p>
        </div>
        <div className="text-right">
          <div className="rounded-xl bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">
            {filteredDebtors.length} cliente(s)
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{totalInstallments} parcela(s) em aberto</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-800">Pesquisar ficha</p>
          <p className="mt-0.5 text-xs text-slate-500">Digite o número da ficha ou o nome do cliente.</p>
        </div>
        <form method="get" className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                name="q"
                defaultValue={rawQuery}
                className="input-field pl-10"
                placeholder="Ex.: 123 ou Maria"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn-primary sm:!w-auto sm:px-5">Pesquisar</button>
            {(query || collaboratorFilter) && (
              <a href="/receber" className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Limpar
              </a>
            )}
          </div>

          <div className="sm:max-w-md">
            <label htmlFor="colaborador" className="label">Filtrar por colaborador</label>
            <CollaboratorFilterSelect
              collaborators={(collaborators ?? []) as { id: string; name: string }[]}
              defaultValue={collaboratorFilter}
            />
          </div>
        </form>
        {query && (
          <p className="mt-3 text-xs text-slate-500">
            {filteredDebtors.length} resultado(s) encontrado(s) para <span className="font-semibold text-slate-700">“{rawQuery}”</span>.
          </p>
        )}
        {collaboratorFilter && (
          <p className="mt-2 text-xs text-slate-500">
            Filtro de colaborador ativo · {filteredDebtors.length} cliente(s) encontrado(s).
          </p>
        )}
      </div>

      {paidOffCustomer && (
        <div className="card flex items-center gap-3 border border-success/20 bg-success/5">
          <CheckCircle2 size={20} className="flex-none text-success" />
          <p className="text-sm text-slate-700">
            Recebimento registrado. <span className="font-semibold">{paidOffCustomer.name}</span>
            {paidOffCustomer.ficha_number != null ? ` (ficha #${paidOffCustomer.ficha_number})` : ""} não tem mais valores em aberto.
          </p>
        </div>
      )}

      {debtors.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">Nenhum cliente com valor em aberto.</div>
      ) : filteredDebtors.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="text-sm font-semibold text-slate-700">Nenhuma ficha encontrada.</p>
          <p className="mt-1 text-xs text-slate-500">Tente pesquisar por outro número de ficha ou nome.</p>
        </div>
      ) : (
        <div className="card overflow-hidden !p-0">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Clientes devendo por número de ficha</p>
            <p className="text-xs text-slate-500">Ordenados pela ficha. Clique em um cliente para ver os dados e as parcelas em aberto.</p>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredDebtors.map((debtor) => {
              const customerName = debtor.customer?.name ?? "Cliente não informado";
              const initial = customerName.trim().charAt(0).toUpperCase() || "?";

              return (
                <details key={debtor.key} id={`ficha-${debtor.key}`} open={debtor.key === openKey} className="group scroll-mt-24">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                      {initial}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {debtor.customer?.ficha_number != null && (
                          <span className="rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-700">
                            Ficha #{debtor.customer.ficha_number}
                          </span>
                        )}
                        <p className="truncate text-sm font-semibold text-slate-900">{customerName}</p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {debtor.items.length} pendência(s) em aberto
                        {debtor.overdue > 0 ? ` · ${debtor.overdue} vencida(s)` : ""}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(debtor.total)}</p>
                      <p className={`text-[11px] font-semibold ${debtor.overdue > 0 ? "text-danger" : "text-warning"}`}>
                        {debtor.overdue > 0 ? "Possui atraso" : "A receber"}
                      </p>
                    </div>

                    <span className="ml-1 text-xl leading-none text-slate-400 transition-transform group-open:rotate-90">›</span>
                  </summary>

                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4">
                    <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Ficha</p>
                        <p className="mt-1 text-sm font-bold text-brand-700">#{debtor.customer?.ficha_number ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Cliente</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{customerName}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Telefone</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{phoneLabel(debtor.customer)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Total devido</p>
                        <p className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(debtor.total)}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {debtor.items.map(({ item, sale, open }) => (
                        <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">
                              {sale?.is_opening_balance ? (
                                <span className="text-amber-700">Saldo devedor inicial</span>
                              ) : (
                                <>
                                  Parcela {item.installment_number}/{item.total_installments}
                                  <span className="font-normal text-slate-400"> · Venda #{sale?.sale_number ?? "-"}</span>
                                </>
                              )}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">Vencimento: {formatDate(item.due_date)}</p>
                          </div>

                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <div className="text-left sm:text-right">
                              <p className="text-sm font-bold text-slate-900">{formatCurrency(open)}</p>
                              <p className={`text-[11px] font-semibold ${item.status === "vencido" ? "text-danger" : "text-warning"}`}>
                                {item.status === "vencido" ? "Vencida" : item.status === "parcial" ? "Parcial" : "Pendente"}
                              </p>
                            </div>
                            <ReceiveButton
                              installmentId={item.id}
                              openAmount={open}
                              products={(products ?? []) as any}
                              variants={(variants ?? []) as any}
                              successHref={successHrefFor(debtor.key)}
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
        </div>
      )}
    </div>
  );
}
