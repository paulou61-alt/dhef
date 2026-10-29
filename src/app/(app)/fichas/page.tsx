import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, CircleCheckBig, ClipboardList, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getAccessContext } from "@/lib/access";
import { SearchBar } from "@/components/ui/SearchBar";
import { formatCurrency } from "@/utils/format";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; colaborador?: string };

// Link para cadastrar cliente já com o número da ficha e o colaborador do grupo.
function newCustomerHref(number: number, groupKey: string) {
  const params = new URLSearchParams({ ficha: String(number) });
  if (groupKey !== "sem") params.set("colaborador", groupKey);
  return `/clientes/novo?${params.toString()}`;
}

function categoryHref(id: string | null, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (id) params.set("colaborador", id);
  const suffix = params.toString();
  return `/fichas${suffix ? `?${suffix}` : ""}`;
}

export default async function FichasPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await getAccessContext();
  if (!access) redirect("/login");

  const supabase = createClient();
  const query = searchParams.q?.trim() ?? "";
  const isOwner = access.role === "owner";
  const collaboratorFilter = isOwner ? (searchParams.colaborador ?? "") : (access.collaboratorId ?? "");

  function customerQuery(from: number, to: number) {
    let builder = supabase
      .from("customers")
      .select("id, name, phone, address, house_number, neighborhood, city, ficha_number, assigned_collaborator_id");

    if (query) {
      if (/^\d+$/.test(query)) builder = builder.eq("ficha_number", Number(query));
      else {
        // Busca pelo nome ou pelo endereço (rua, bairro ou cidade).
        // Pontos, vírgulas e parênteses atrapalham o filtro; viram "qualquer coisa" (ex.: "R. São" acha "R. São José").
        const term = query.replace(/[,()%\\:."]/g, "*").replace(/\*+/g, "*").replace(/^\*|\*$/g, "").trim();
        if (term) {
          builder = builder.or(
            ["name", "address", "neighborhood", "city"].map((column) => `${column}.ilike.*${term}*`).join(",")
          );
        }
      }
    }
    if (!isOwner && access?.collaboratorId) {
      builder = builder.eq("assigned_collaborator_id", access.collaboratorId);
    } else if (collaboratorFilter === "sem") {
      builder = builder.is("assigned_collaborator_id", null);
    } else if (collaboratorFilter) {
      builder = builder.eq("assigned_collaborator_id", collaboratorFilter);
    }

    return builder.order("ficha_number", { ascending: true }).order("id").range(from, to);
  }

  let collaboratorsQuery = supabase
    .from("collaborators")
    .select("id, name, role")
    .eq("is_active", true)
    .order("name");
  if (!isOwner && access.collaboratorId) {
    collaboratorsQuery = collaboratorsQuery.eq("id", access.collaboratorId);
  }

  const [{ data: customers }, { data: collaborators }, { data: sales }, { data: installments }] = await Promise.all([
    fetchAll(customerQuery),
    collaboratorsQuery,
    fetchAll((from, to) =>
      supabase.from("sales").select("id, customer_id, total, status, is_opening_balance").eq("status", "completed").order("id").range(from, to)
    ),
    fetchAll((from, to) => supabase.from("installments").select("sale_id, amount, paid_amount, status").order("id").range(from, to)),
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

  // Ficha liberada: cliente já comprou e não deve mais nada. O número pode estar com outro cliente,
  // então ela não entra na contagem de fichas ativas.
  const openBalance = (customerId: string) =>
    (salesByCustomer.get(customerId)?.saleIds ?? []).reduce((sum, id) => sum + (installmentBySale.get(id) ?? 0), 0);
  const isReleased = (customerId: string) => (salesByCustomer.get(customerId)?.saleIds.length ?? 0) > 0 && openBalance(customerId) <= 0;

  const grouped = new Map<string, typeof customers>();
  // Fichas ativas primeiro; as quitadas vão para o fim de cada grupo.
  [...(customers ?? [])].sort((a, b) => Number(isReleased(a.id)) - Number(isReleased(b.id))).forEach((customer) => {
    const key = customer.assigned_collaborator_id ?? "sem";
    grouped.set(key, [...(grouped.get(key) ?? []), customer]);
  });

  const groupKeys = Array.from(grouped.keys()).sort((a, b) => {
    if (a === "sem") return 1;
    if (b === "sem") return -1;
    return (collaboratorMap.get(a)?.name ?? "").localeCompare(collaboratorMap.get(b)?.name ?? "", "pt-BR");
  });

  // Fichas disponíveis para novos clientes, por colaborador:
  // números de clientes que quitaram (e ainda não foram reaproveitados) e números pulados na sequência.
  const availabilityByGroup = new Map<string, { released: [number, string][]; gaps: number[]; highest: number; count: number }>();
  groupKeys.forEach((key) => {
    const groupCustomers = grouped.get(key) ?? [];
    const activeNumbers = new Set(
      groupCustomers
        .filter((customer) => !isReleased(customer.id) && customer.ficha_number != null)
        .map((customer) => Number(customer.ficha_number))
    );
    const releasedByNumber = new Map<number, string>();
    groupCustomers
      .filter((customer) => isReleased(customer.id) && customer.ficha_number != null && !activeNumbers.has(Number(customer.ficha_number)))
      .forEach((customer) => releasedByNumber.set(Number(customer.ficha_number), customer.name));
    const highest = Math.max(0, ...activeNumbers);
    const gaps: number[] = [];
    for (let n = 1; n < highest; n += 1) {
      if (!activeNumbers.has(n) && !releasedByNumber.has(n)) gaps.push(n);
    }
    const released = [...releasedByNumber.entries()].sort((x, y) => x[0] - y[0]);
    availabilityByGroup.set(key, { released, gaps, highest, count: released.length + gaps.length });
  });
  const totalAvailable = [...availabilityByGroup.values()].reduce((sum, group) => sum + group.count, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Fichas</h1>
        <p className="mt-1 text-sm text-slate-500">{isOwner ? "Fichas numeradas e organizadas por colaborador responsável." : "Aqui aparecem somente as fichas de clientes vinculados a você."}</p>
      </div>

      <SearchBar placeholder="Buscar por nome, endereço, bairro ou número da ficha..." />

      {isOwner && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link href={categoryHref(null, query)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${!collaboratorFilter ? "bg-brand-500 text-white" : "bg-white text-slate-600"}`}>Todos</Link>
          {(collaborators ?? []).map((collaborator) => (
            <Link key={collaborator.id} href={categoryHref(collaborator.id, query)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${collaboratorFilter === collaborator.id ? "bg-brand-500 text-white" : "bg-white text-slate-600"}`}>
              {collaborator.name}
            </Link>
          ))}
          <Link href={categoryHref("sem", query)} className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${collaboratorFilter === "sem" ? "bg-brand-500 text-white" : "bg-white text-slate-600"}`}>Sem colaborador</Link>
        </div>
      )}

      {!query && groupKeys.length > 0 && (
        <section className="card !p-0 overflow-hidden border border-emerald-200">
          <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-3">
            <CircleCheckBig size={17} className="text-emerald-600" />
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-900">Fichas disponíveis para novos clientes</p>
              <p className="text-[11px] text-emerald-700">
                {totalAvailable > 0 ? `${totalAvailable} ficha(s) livre(s). Toque numa ficha para cadastrar o cliente já com esse número.` : "Nenhuma ficha liberada no momento. Use o próximo número da sequência."}
              </p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {groupKeys.map((key) => {
              const info = availabilityByGroup.get(key);
              if (!info) return null;
              const collaborator = key === "sem" ? null : collaboratorMap.get(key);
              const chips = [
                ...info.released.map(([number, name]) => ({ number, name })),
                ...info.gaps.map((number) => ({ number, name: null as string | null })),
              ].sort((x, y) => x.number - y.number);
              return (
                <div key={key} className="px-4 py-3">
                  <p className="mb-2 text-xs font-bold text-slate-700">
                    {collaborator?.name ?? "Sem colaborador"}
                    <span className="ml-1 font-normal text-slate-400">· {info.count} disponível(is)</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {chips.slice(0, 40).map(({ number, name }) => (
                      <Link
                        key={number}
                        href={newCustomerHref(number, key)}
                        title={name ? `Cadastrar cliente na ficha #${number} (era de ${name})` : `Cadastrar cliente na ficha #${number}`}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-sm transition ${
                          name
                            ? "border-emerald-300 bg-white text-emerald-700 hover:border-emerald-600 hover:bg-emerald-600 hover:text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-brand-500 hover:bg-brand-500 hover:text-white"
                        }`}
                      >
                        <Plus size={12} /> Ficha #{number}
                        {name && <span className="font-normal opacity-80">· era de {name.split(" ")[0]}</span>}
                      </Link>
                    ))}
                    {chips.length > 40 && <span className="px-1 py-1.5 text-xs text-slate-500">e mais {chips.length - 40}</span>}
                    <Link
                      href={newCustomerHref(info.highest + 1, key)}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-brand-300 bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-500 hover:text-white"
                    >
                      <Plus size={12} /> Próxima nova: #{info.highest + 1}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!customers || customers.length === 0 ? (
        <div className="card py-12 text-center">
          <ClipboardList className="mx-auto mb-2 text-slate-300" size={30} />
          <p className="text-sm text-slate-500">Nenhuma ficha encontrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupKeys.map((key) => {
            const groupCustomers = grouped.get(key) ?? [];
            const releasedCount = groupCustomers.filter((customer) => isReleased(customer.id)).length;
            const activeCount = groupCustomers.length - releasedCount;

            const availableCount = availabilityByGroup.get(key)?.count ?? 0;
            const collaborator = key === "sem" ? null : collaboratorMap.get(key);
            return (
              <section key={key} className="card !p-0 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-surface-muted px-4 py-3">
                  <Users size={16} className="text-brand-600" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{collaborator?.name ?? "Sem colaborador"}</p>
                    <p className="text-[11px] text-slate-500">
                      {activeCount} ficha(s) ativa(s)
                      {releasedCount > 0 && ` · ${releasedCount} quitada(s)`}
                      {!query && availableCount > 0 && ` · ${availableCount} disponível(is)`}
                    </p>
                  </div>
                  {collaborator && <span className="text-[11px] font-semibold text-slate-400">{collaborator.role === "vendedor" ? "Vendedor" : "Cobrador"}</span>}
                </div>

                <div className="divide-y divide-slate-100">
                  {groupCustomers.map((customer) => {
                    const stats = salesByCustomer.get(customer.id) ?? { count: 0, total: 0, saleIds: [] };
                    const open = openBalance(customer.id);
                    const released = isReleased(customer.id);
                    return (
                      <Link key={customer.id} href={`/fichas/${customer.id}`} className="flex items-center gap-3 px-4 py-3.5">
                        <span className={`flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-xs font-bold ${released ? "bg-slate-100 text-slate-400" : "bg-brand-50 text-brand-700"}`}>#{customer.ficha_number}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{customer.name}</p>
                          {(customer.address || customer.neighborhood) && (
                            <p className="truncate text-xs text-slate-500">
                              {[customer.address ? `${customer.address}${customer.house_number ? `, ${customer.house_number}` : ""}` : null, customer.neighborhood].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          <p className="text-xs text-slate-500">{stats.count} compra(s) · {formatCurrency(stats.total)} comprado</p>
                        </div>
                        {open > 0 ? (
                          <div className="text-right"><p className="text-xs text-slate-500">Em aberto</p><p className="text-sm font-bold text-warning">{formatCurrency(open)}</p></div>
                        ) : stats.saleIds.length > 0 ? (
                          <span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success">Quitado · ficha liberada</span>
                        ) : null}
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
