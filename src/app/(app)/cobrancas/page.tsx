import { redirect } from "next/navigation";
import { MapPin, MessageCircle, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { ReceiveButton } from "@/components/finance/ReceiveButton";
import { formatCurrency, formatDate } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";
import { buildChargeMessage, type ChargeInstallment } from "@/utils/charge-message";

export const dynamic = "force-dynamic";

export default async function CobrancasPage() {
  const access = await getAccessContext();
  if (!access) redirect("/login");
  if (access.role === "vendedor") redirect("/vender");

  const supabase = createClient();
  const [{ data: installments }, { data: sales }, { data: customers }] = await Promise.all([
    supabase.from("installments").select("*").in("status", ["pendente", "parcial", "vencido"]).order("due_date"),
    supabase.from("sales").select("id, customer_id, sale_number"),
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
    current.items.push({ ...installment, saleNumber: sale.sale_number });
    grouped.set(customer.id, current);
  });

  const customersToCollect = Array.from(grouped.values()).sort((a, b) => {
    const aDate = a.items[0]?.due_date ?? "";
    const bDate = b.items[0]?.due_date ?? "";
    return aDate.localeCompare(bDate);
  });
  const totalOpen = customersToCollect.reduce((sum, group) => sum + group.items.reduce((subtotal, item) => subtotal + Number(item.amount) - Number(item.paid_amount), 0), 0);

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between gap-3">
        <div><p className="text-sm text-slate-500">Carteira de cobrança</p><p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totalOpen)}</p><p className="mt-1 text-xs text-slate-500">{customersToCollect.length} cliente(s) com pendência</p></div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><WalletCards size={22} /></span>
      </div>

      {customersToCollect.length === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">Nenhuma cobrança pendente.</div>
      ) : customersToCollect.map(({ customer, items }) => {
        const openTotal = items.reduce((sum, item) => sum + Number(item.amount) - Number(item.paid_amount), 0);
        const phone = customer.whatsapp ?? customer.phone;
        const addressParts = [customer.address, customer.neighborhood, customer.city, customer.state, customer.zip_code].filter(Boolean);
        const fullAddress = addressParts.join(", ");
        const chargeItems: ChargeInstallment[] = items.map((item) => ({ installmentNumber: item.installment_number, totalInstallments: item.total_installments, saleNumber: item.saleNumber, dueDate: item.due_date, openAmount: Number(item.amount) - Number(item.paid_amount), status: item.status }));
        const message = buildChargeMessage(customer.name, chargeItems);
        const mapsUrl = fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : null;

        return (
          <div key={customer.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h2 className="text-base font-bold text-slate-900">{customer.name}</h2>{fullAddress && <p className="mt-1 flex items-start gap-1 text-xs text-slate-500"><MapPin size={13} className="mt-0.5 flex-shrink-0" /> {fullAddress}</p>}</div>
              <div className="text-right"><p className="text-xs text-slate-500">Em aberto</p><p className="text-lg font-bold text-warning">{formatCurrency(openTotal)}</p></div>
            </div>

            <div className="mt-4 space-y-2">
              {items.map((item) => {
                const open = Number(item.amount) - Number(item.paid_amount);
                const overdue = item.status === "vencido" || item.due_date < new Date().toISOString().slice(0, 10);
                return (
                  <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted p-3">
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">Parcela {item.installment_number}/{item.total_installments} · Venda #{item.saleNumber}</p><p className={`text-xs ${overdue ? "text-danger" : "text-slate-500"}`}>{overdue ? "Vencida" : "Vence"} em {formatDate(item.due_date)}</p></div>
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(open)}</p>
                    <ReceiveButton installmentId={item.id} openAmount={open} buttonLabel={`Pagar ${item.installment_number}/${item.total_installments}`} />
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
      })}
    </div>
  );
}
