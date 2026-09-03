import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, MapPin, MessageCircle, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { ReceiveButton } from "@/components/finance/ReceiveButton";
import { formatCurrency, formatDate } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";
import { buildChargeMessage, type ChargeInstallment } from "@/utils/charge-message";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = new Set(["pendente", "parcial", "vencido"]);

export default async function CobrancasPage({ searchParams }: { searchParams: { status?: string } }) {
  const access = await getAccessContext();
  if (!access) redirect("/login");
  if (access.role === "vendedor") redirect("/vender");

  const activeFilter = searchParams.status === "pagos" ? "pagos" : "devedores";
  const supabase = createClient();
  const [{ data: installments }, { data: sales }, { data: customers }] = await Promise.all([
    supabase.from("installments").select("*").order("due_date"),
    supabase.from("sales").select("id, customer_id, sale_number, is_opening_balance").neq("status", "cancelled"),
    supabase.from("customers").select("id, name, phone, whatsapp, address, neighborhood, city, state, zip_code").order("name"),
  ]);

  const saleMap = new Map((sales ?? []).map((sale) => [sale.id, sale]));
  const customerMap = new Map((customers ?? []).map((customer) => [customer.id, customer]));
  const grouped = new Map<string, { customer: any; items: any[] }>();

  (installments ?? []).forEach((installment) => {
    const sale = saleMap.get(installment.sale_id);
    if (!sale?.customer_id) return;
    const customer = customerMap.get(sale.customer_id);
    if (!customer) return;
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
    .map((group) => ({ ...group, openItems: group.items.filter((item) => OPEN_STATUSES.has(item.status) && Number(item.amount) - Number(item.paid_amount) > 0) }))
    .filter((group) => group.openItems.length > 0)
    .sort((a, b) => String(a.openItems[0]?.due_date ?? "").localeCompare(String(b.openItems[0]?.due_date ?? "")));

  const paidAccounts = accounts
    .filter((group) => group.items.length > 0 && group.items.every((item) => !OPEN_STATUSES.has(item.status) || Number(item.amount) - Number(item.paid_amount) <= 0))
    .sort((a, b) => a.customer.name.localeCompare(b.customer.name));

  const totalOpen = debtors.reduce((sum, group) => sum + group.openItems.reduce((subtotal, item) => subtotal + Number(item.amount) - Number(item.paid_amount), 0), 0);
  const totalPaid = paidAccounts.reduce((sum, group) => sum + group.items.reduce((subtotal, item) => subtotal + Number(item.paid_amount), 0), 0);

  return (
    <div className="space-y-4">
      <div className={`card flex items-center justify-between gap-3 ${activeFilter === "pagos" ? "border border-success/20 bg-success/5" : ""}`}>
        <div>
          <p className="text-sm text-slate-500">{activeFilter === "pagos" ? "Clientes quitados" : "Carteira de cobrança"}</p>
          <p className={`mt-1 text-2xl font-bold ${activeFilter === "pagos" ? "text-success" : "text-slate-900"}`}>{formatCurrency(activeFilter === "pagos" ? totalPaid : totalOpen)}</p>
          <p className="mt-1 text-xs text-slate-500">{activeFilter === "pagos" ? `${paidAccounts.length} cliente(s) com conta quitada` : `${debtors.length} cliente(s) com pendência`}</p>
        </div>
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${activeFilter === "pagos" ? "bg-success/10 text-success" : "bg-brand-50 text-brand-600"}`}>{activeFilter === "pagos" ? <CheckCircle2 size={22} /> : <WalletCards size={22} />}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
        <Link href="/cobrancas?status=devedores" className={`rounded-xl px-4 py-2.5 text-center text-sm font-bold transition ${activeFilter === "devedores" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Devedores <span className="ml-1 text-xs">({debtors.length})</span></Link>
        <Link href="/cobrancas?status=pagos" className={`rounded-xl px-4 py-2.5 text-center text-sm font-bold transition ${activeFilter === "pagos" ? "bg-white text-success shadow-sm" : "text-slate-500"}`}>Pagos <span className="ml-1 text-xs">({paidAccounts.length})</span></Link>
      </div>

      {activeFilter === "devedores" ? (
        debtors.length === 0 ? (
          <div className="card py-12 text-center text-sm text-slate-500">Nenhuma cobrança pendente.</div>
        ) : debtors.map(({ customer, openItems }) => {
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

          return (
            <div key={customer.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="text-base font-bold text-slate-900">{customer.name}</h2>{fullAddress && <p className="mt-1 flex items-start gap-1 text-xs text-slate-500"><MapPin size={13} className="mt-0.5 flex-shrink-0" /> {fullAddress}</p>}</div>
                <div className="text-right"><p className="text-xs text-slate-500">Em aberto</p><p className="text-lg font-bold text-warning">{formatCurrency(openTotal)}</p></div>
              </div>

              <div className="mt-4 space-y-2">
                {openItems.map((item) => {
                  const open = Number(item.amount) - Number(item.paid_amount);
                  const paid = Number(item.paid_amount);
                  const overdue = item.status === "vencido" || item.due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted p-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${item.isOpeningBalance ? "text-amber-700" : "text-slate-800"}`}>
                          {item.isOpeningBalance ? "Saldo devedor inicial" : `Parcela ${item.installment_number}/${item.total_installments} · Venda #${item.saleNumber}`}
                        </p>
                        <p className={`text-xs ${overdue ? "text-danger" : "text-slate-500"}`}>{overdue ? "Vencida" : "Vence"} em {formatDate(item.due_date)}</p>
                        {paid > 0 && <p className="mt-1 text-xs font-semibold text-success">Já pago: {formatCurrency(paid)}</p>}
                      </div>
                      <div className="text-right"><p className="text-[10px] uppercase tracking-wide text-slate-400">Falta</p><p className="text-sm font-bold text-slate-900">{formatCurrency(open)}</p></div>
                      <ReceiveButton installmentId={item.id} openAmount={open} buttonLabel={item.isOpeningBalance ? "Receber saldo" : `Pagar ${item.installment_number}/${item.total_installments}`} />
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {phone && <a href={whatsappLink(phone, message)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white"><MessageCircle size={17} /> Cobrar no WhatsApp</a>}
                {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-secondary flex items-center justify-center gap-2"><MapPin size={17} /> Abrir endereço no Maps</a>}
              </div>
            </div>
          );
        })
      ) : paidAccounts.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">Nenhum cliente quitado ainda.</div>
      ) : paidAccounts.map(({ customer, items }) => {
        const paidTotal = items.reduce((sum, item) => sum + Number(item.paid_amount), 0);
        return (
          <div key={customer.id} className="card border border-success/20 bg-success/5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><h2 className="truncate text-base font-bold text-success">{customer.name}</h2><span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success"><CheckCircle2 size={11} /> Quitado</span></div>
                <p className="mt-1 text-xs text-slate-500">Todas as pendências registradas estão pagas.</p>
              </div>
              <div className="text-right"><p className="text-xs text-slate-500">Total pago</p><p className="text-lg font-bold text-success">{formatCurrency(paidTotal)}</p></div>
            </div>

            <div className="mt-4 space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/80 p-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${item.isOpeningBalance ? "text-amber-700" : "text-slate-800"}`}>
                      {item.isOpeningBalance ? "Saldo devedor inicial" : `Parcela ${item.installment_number}/${item.total_installments} · Venda #${item.saleNumber}`}
                    </p>
                    <p className="text-xs text-slate-500">Vencimento {formatDate(item.due_date)}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 font-bold text-success"><CheckCircle2 size={16} /><span className="text-sm">{formatCurrency(Number(item.paid_amount))}</span></div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
