import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Filter, MapPin, MessageCircle, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FichaBadge, InitialsAvatar, StatusPill } from "@/components/ui/Badges";
import { CountUp } from "@/components/dashboard/CountUp";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getAccessContext } from "@/lib/access";
import { PurchaseCatalogProvider } from "@/components/sales/PurchaseCatalog";
import { ShowMoreLink } from "@/components/ui/ShowMoreLink";
import { LIST_PAGE_SIZE, visibleCount } from "@/lib/pagination";
import { ReceiveButton } from "@/components/finance/ReceiveButton";
import { CollaboratorFilterSelect } from "@/components/finance/CollaboratorFilterSelect";
import { formatCurrency, formatDate, todayInBrazil } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";
import { buildChargeMessage, type ChargeInstallment } from "@/utils/charge-message";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = new Set(["pendente", "parcial", "vencido"]);

export default async function CobrancasPage({
  searchParams,
}: {
  searchParams: { status?: string; colaborador?: string; mostrar?: string };
}) {
  const access = await getAccessContext();
  if (!access) redirect("/login");
  if (access.role === "vendedor") redirect("/vender");

  const activeFilter = searchParams.status === "pagos" ? "pagos" : "devedores";
  const supabase = createClient();
  // Uma consulta só: cada parcela já vem com a venda e o cliente, e só as colunas usadas.
  // Antes eram três tabelas inteiras (todas as parcelas, vendas e clientes, com todas as colunas).
  const [
    { data: installments },
    { data: collaborators },
    { data: products },
    { data: variants },
  ] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("installments")
        .select(
          "id, sale_id, amount, paid_amount, due_date, installment_number, total_installments, status, " +
            "sales!inner(id, customer_id, sale_number, is_opening_balance, " +
            "customers!inner(id, name, ficha_number, phone, whatsapp, address, neighborhood, city, state, zip_code, assigned_collaborator_id, write_off_status))"
        )
        .neq("sales.status", "cancelled")
        .order("due_date")
        .order("id")
        .range(from, to)
    ),
    supabase.from("collaborators").select("id, name, role, is_active").eq("is_active", true).order("name"),
    fetchAll((from, to) => supabase.from("products").select("id, name, sale_price").eq("is_active", true).order("name").order("id").range(from, to)),
    fetchAll((from, to) =>
      supabase.from("product_variants").select("id, product_id, variant_name, stock_quantity, sale_price").order("variant_name").order("id").range(from, to)
    ),
  ]);

  const activeCollaborators = collaborators ?? [];
  const validCollaboratorIds = new Set(activeCollaborators.map((collaborator) => collaborator.id));
  const selectedCollaboratorId = searchParams.colaborador && validCollaboratorIds.has(searchParams.colaborador)
    ? searchParams.colaborador
    : "";
  const selectedCollaborator = activeCollaborators.find((collaborator) => collaborator.id === selectedCollaboratorId) ?? null;

  // "Quem cobrou" no recebimento: só o proprietário escolhe, entre os cobradores ativos.
  const collectors = access?.role === "owner"
    ? activeCollaborators.filter((collaborator) => collaborator.role === "cobrador").map(({ id, name }) => ({ id, name }))
    : [];

  const grouped = new Map<string, { customer: any; items: any[] }>();

  ((installments ?? []) as any[]).forEach(({ sales: sale, ...installment }) => {
    const customer = sale?.customers;
    if (!sale?.customer_id || !customer) return;
    // Clientes marcados como prego ou mudou saem das cobranças.
    if (customer.write_off_status) return;
    if (selectedCollaboratorId && customer.assigned_collaborator_id !== selectedCollaboratorId) return;
    const current = grouped.get(customer.id) ?? { customer, items: [] };
    current.items.push({
      ...installment,
      saleNumber: sale.sale_number,
      isOpeningBalance: Boolean(sale.is_opening_balance),
    });
    grouped.set(customer.id, current);
  });

  const accounts = Array.from(grouped.values());
  const debtors = accounts
    .map((group) => ({
      ...group,
      openItems: group.items.filter(
        (item) => OPEN_STATUSES.has(item.status) && Number(item.amount) - Number(item.paid_amount) > 0
      ),
    }))
    .filter((group) => group.openItems.length > 0)
    .sort((a, b) => Number(a.customer.ficha_number) - Number(b.customer.ficha_number));

  const paidAccounts = accounts
    .filter(
      (group) =>
        group.items.length > 0 &&
        group.items.every(
          (item) => !OPEN_STATUSES.has(item.status) || Number(item.amount) - Number(item.paid_amount) <= 0
        )
    )
    .sort((a, b) => Number(a.customer.ficha_number) - Number(b.customer.ficha_number));

  const totalOpen = debtors.reduce(
    (sum, group) =>
      sum + group.openItems.reduce((subtotal, item) => subtotal + Number(item.amount) - Number(item.paid_amount), 0),
    0
  );
  const totalPaid = paidAccounts.reduce(
    (sum, group) => sum + group.items.reduce((subtotal, item) => subtotal + Number(item.paid_amount), 0),
    0
  );

  // Mostra os primeiros clientes e um "Mostrar mais"; os totais acima continuam com todos.
  const shownCount = visibleCount(searchParams.mostrar);
  const activeList = activeFilter === "pagos" ? paidAccounts : debtors;
  const moreParams = new URLSearchParams();
  if (activeFilter === "pagos") moreParams.set("status", "pagos");
  if (selectedCollaboratorId) moreParams.set("colaborador", selectedCollaboratorId);
  moreParams.set("mostrar", String(shownCount + LIST_PAGE_SIZE));

  const today = todayInBrazil();
  const collaboratorQuery = selectedCollaboratorId
    ? `&colaborador=${encodeURIComponent(selectedCollaboratorId)}`
    : "";

  const isPaidView = activeFilter === "pagos";
  const tabClass = (active: boolean) =>
    `flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${active ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5 dark:bg-white/15 dark:text-white dark:ring-white/10" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`;

  return (
    <PurchaseCatalogProvider products={(products ?? []) as any} variants={(variants ?? []) as any}>
    <div className="space-y-4">
      <PageHeader icon={WalletCards} eyebrow="Cobrança" title="Cobranças" subtitle="Parcelas por cliente, com cobrança no WhatsApp e endereço no mapa." />

      <section className="glass animate-rise p-5 md:p-6" style={{ animationDelay: "100ms" }}>
        <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-[13px] font-medium text-slate-500">{isPaidView ? "Total pago pelos clientes quitados" : "Carteira de cobrança"}</p>
            <p className={`mt-2 whitespace-nowrap text-[34px] font-semibold leading-none tracking-[-0.04em] md:text-[42px] ${isPaidView ? "text-emerald-700" : "text-slate-900"}`}>
              <CountUp value={isPaidView ? totalPaid : totalOpen} format="currency" className="text-shine" />
            </p>
            <p className="mt-2 text-[13px] text-slate-500">
              {isPaidView ? `${paidAccounts.length} cliente(s) com conta quitada` : `${debtors.length} cliente(s) com pendência`}
              {selectedCollaborator ? ` · ${selectedCollaborator.name}` : ""}
            </p>
          </div>
          <div className="grid grid-cols-2 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-white/10 dark:!bg-white/5 md:w-[280px]">
            <Link href={`/cobrancas?status=devedores${collaboratorQuery}`} className={tabClass(!isPaidView)}>
              Devedores <span className="text-[11.5px] tabular-nums text-slate-400">{debtors.length}</span>
            </Link>
            <Link href={`/cobrancas?status=pagos${collaboratorQuery}`} className={tabClass(isPaidView)}>
              Pagos <span className="text-[11.5px] tabular-nums text-slate-400">{paidAccounts.length}</span>
            </Link>
          </div>
        </div>

        <form method="get" className="mt-5 border-t border-slate-100 pt-4">
          <input type="hidden" name="status" value={activeFilter} />
          <label className="label flex items-center gap-1.5"><Filter size={13} className="text-brand-500" /> Filtrar por colaborador</label>
          <div className="md:max-w-sm">
            <CollaboratorFilterSelect
              collaborators={activeCollaborators}
              defaultValue={selectedCollaboratorId}
              includeUnassigned={false}
            />
          </div>
          <p className="mt-2 text-[11.5px] text-slate-500">Usa o colaborador responsável cadastrado na ficha.</p>
        </form>
      </section>

      {activeFilter === "devedores" ? (
        debtors.length === 0 ? (
          <div className="glass py-12 text-center text-sm text-slate-500">Nenhuma cobrança pendente para este filtro.</div>
        ) : debtors.slice(0, shownCount).map(({ customer, openItems }, index) => {
          const openTotal = openItems.reduce((sum, item) => sum + Number(item.amount) - Number(item.paid_amount), 0);
          const phone = customer.whatsapp ?? customer.phone;
          const addressParts = [customer.address, customer.neighborhood, customer.city, customer.state, customer.zip_code].filter(Boolean);
          const fullAddress = addressParts.join(", ");
          const chargeItems: ChargeInstallment[] = openItems.map((item) => ({
            installmentNumber: item.installment_number,
            totalInstallments: item.total_installments,
            saleNumber: item.saleNumber,
            dueDate: item.due_date,
            openAmount: Number(item.amount) - Number(item.paid_amount),
            status: item.status,
            isOpeningBalance: item.isOpeningBalance,
          }));
          const message = buildChargeMessage(customer.name, chargeItems);
          const mapsUrl = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null;
          const hasOverdue = openItems.some((item) => item.status === "vencido" || item.due_date < today);

          return (
            <section key={customer.id} className={`glass p-4 md:p-5 ${index < 6 ? "animate-rise" : ""}`} style={index < 6 ? { animationDelay: `${160 + index * 50}ms` } : undefined}>
              <div className="flex items-start gap-3">
                <InitialsAvatar name={customer.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-slate-900">{customer.name}</h2>
                    <FichaBadge number={customer.ficha_number} />
                  </div>
                  {fullAddress && (
                    <p className="mt-1 flex items-start gap-1 text-[12px] text-slate-500">
                      <MapPin size={13} className="mt-0.5 flex-shrink-0" /> {fullAddress}
                    </p>
                  )}
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <p className="whitespace-nowrap text-[18px] font-semibold tabular-nums tracking-tight text-slate-900">{formatCurrency(openTotal)}</p>
                  <StatusPill tone={hasOverdue ? "danger" : "warning"}>{hasOverdue ? "Em atraso" : "Em aberto"}</StatusPill>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {openItems.map((item) => {
                  const open = Number(item.amount) - Number(item.paid_amount);
                  const paid = Number(item.paid_amount);
                  const overdue = item.status === "vencido" || item.due_date < today;
                  return (
                    <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/[.07] dark:!bg-white/[.03]">
                      <span className={`h-8 w-1 flex-none rounded-full ${overdue ? "bg-rose-500" : "bg-brand-300"}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13.5px] font-medium ${item.isOpeningBalance ? "text-amber-700" : "text-slate-900"}`}>
                          {item.isOpeningBalance ? "Saldo devedor inicial" : `Parcela ${item.installment_number}/${item.total_installments} · Venda #${item.saleNumber}`}
                        </p>
                        <p className={`text-[12px] ${overdue ? "text-rose-600 dark:text-rose-300" : "text-slate-500"}`}>
                          {overdue ? "Vencida" : "Vence"} em {formatDate(item.due_date)}
                          {paid > 0 && <span className="text-emerald-700"> · já pago {formatCurrency(paid)}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-500">Falta</p>
                        <p className="text-[14px] font-semibold tabular-nums text-slate-900">{formatCurrency(open)}</p>
                      </div>
                      <ReceiveButton
                        installmentId={item.id}
                        openAmount={open}
                        buttonLabel={item.isOpeningBalance ? "Receber saldo" : `Pagar ${item.installment_number}/${item.total_installments}`}
                        allowDiscount={access?.role === "owner"}
                        collectors={collectors}
                        defaultCollectorId={customer.assigned_collaborator_id ?? ""}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {phone && (
                  <a href={whatsappLink(phone, message)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2.5 text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_8px_20px_-8px_rgba(16,185,129,.7)] transition hover:-translate-y-0.5">
                    <MessageCircle size={16} /> Cobrar no WhatsApp
                  </a>
                )}
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-secondary !py-2.5 text-[13.5px] font-medium">
                    <MapPin size={16} /> Abrir endereço no Maps
                  </a>
                )}
              </div>
            </section>
          );
        })
      ) : paidAccounts.length === 0 ? (
        <div className="glass py-12 text-center text-sm text-slate-500">Nenhum cliente quitado para este filtro.</div>
      ) : paidAccounts.slice(0, shownCount).map(({ customer, items }, index) => {
        const paidTotal = items.reduce((sum, item) => sum + Number(item.paid_amount), 0);
        return (
          <section key={customer.id} className={`glass p-4 md:p-5 ${index < 6 ? "animate-rise" : ""}`} style={index < 6 ? { animationDelay: `${160 + index * 50}ms` } : undefined}>
            <div className="flex items-start gap-3">
              <InitialsAvatar name={customer.name} tone="success" size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-[15px] font-semibold text-slate-900">{customer.name}</h2>
                  <FichaBadge number={customer.ficha_number} />
                  <StatusPill tone="success">Quitado</StatusPill>
                </div>
                <p className="mt-1 text-[12px] text-slate-500">Todas as pendências registradas estão pagas.</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500">Total pago</p>
                <p className="whitespace-nowrap text-[18px] font-semibold tabular-nums text-emerald-700">{formatCurrency(paidTotal)}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-white/[.07] dark:!bg-white/[.03]">
                  <div className="min-w-0">
                    <p className={`text-[13.5px] font-medium ${item.isOpeningBalance ? "text-amber-700" : "text-slate-900"}`}>
                      {item.isOpeningBalance ? "Saldo devedor inicial" : `Parcela ${item.installment_number}/${item.total_installments} · Venda #${item.saleNumber}`}
                    </p>
                    <p className="text-[12px] text-slate-500">Vencimento {formatDate(item.due_date)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 size={15} />
                    <span className="text-[14px] font-semibold tabular-nums">{formatCurrency(Number(item.paid_amount))}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <ShowMoreLink href={`/cobrancas?${moreParams.toString()}`} remaining={activeList.length - Math.min(shownCount, activeList.length)} shown={Math.min(shownCount, activeList.length)} total={activeList.length} />
    </div>
    </PurchaseCatalogProvider>
  );
}
