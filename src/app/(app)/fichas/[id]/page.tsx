import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Phone, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";

export const dynamic = "force-dynamic";

export default async function FichaClientePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", params.id).single();
  if (!customer) notFound();

  const { data: sales } = await supabase.from("sales").select("*").eq("customer_id", params.id).eq("status", "completed").order("created_at", { ascending: false });
  const saleIds = (sales ?? []).map((s) => s.id);
  const [{ data: items }, { data: installments }] = saleIds.length
    ? await Promise.all([
        supabase.from("sale_items").select("*").in("sale_id", saleIds).order("created_at"),
        supabase.from("installments").select("*").in("sale_id", saleIds).order("due_date"),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  const installmentIds = (installments ?? []).map((i) => i.id);
  const { data: payments } = installmentIds.length
    ? await supabase.from("payments").select("*").in("installment_id", installmentIds).order("payment_date", { ascending: false })
    : { data: [] as any[] };

  const itemsBySale = new Map<string, any[]>();
  (items ?? []).forEach((item) => itemsBySale.set(item.sale_id, [...(itemsBySale.get(item.sale_id) ?? []), item]));
  const installmentsBySale = new Map<string, any[]>();
  (installments ?? []).forEach((item) => installmentsBySale.set(item.sale_id, [...(installmentsBySale.get(item.sale_id) ?? []), item]));
  const paymentsByInstallment = new Map<string, any[]>();
  (payments ?? []).forEach((item) => paymentsByInstallment.set(item.installment_id, [...(paymentsByInstallment.get(item.installment_id) ?? []), item]));

  const totalPurchased = (sales ?? []).reduce((sum, s) => sum + Number(s.total), 0);
  const totalOpen = (installments ?? []).filter((i) => i.status !== "pago").reduce((sum, i) => sum + Number(i.amount) - Number(i.paid_amount), 0);
  const totalReceivedFromInstallments = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const directPaid = (sales ?? []).reduce((sum, s) => sum + (s.is_paid ? Number(s.total) : Number(s.down_payment)), 0);
  const totalPaid = directPaid + totalReceivedFromInstallments;

  const whatsappNumber = customer.whatsapp ?? customer.phone;
  const chargeText = `Olá ${customer.name}, tudo bem? Seu saldo em aberto é ${formatCurrency(totalOpen)}. Quando puder, me avise sobre o pagamento.`;

  return (
    <div className="space-y-4">
      <Link href="/fichas" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500"><ChevronLeft size={18} /> Fichas</Link>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-600">{customer.name.charAt(0).toUpperCase()}</span>
            <div><h1 className="text-lg font-bold text-slate-900">{customer.name}</h1>{customer.phone && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Phone size={12} /> {customer.phone}</p>}{(customer.city || customer.neighborhood) && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {[customer.neighborhood, customer.city].filter(Boolean).join(", ")}</p>}</div>
          </div>
          <Link href={`/clientes/${customer.id}/editar`} className="btn-secondary px-4 py-2.5 text-sm">Editar cliente</Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-xl bg-surface-muted p-3"><p className="text-xs text-slate-500">Total comprado</p><p className="mt-1 text-base font-bold text-slate-900">{formatCurrency(totalPurchased)}</p></div>
          <div className="rounded-xl bg-success/10 p-3"><p className="text-xs text-slate-500">Total pago</p><p className="mt-1 text-base font-bold text-success">{formatCurrency(totalPaid)}</p></div>
          <div className="rounded-xl bg-warning/10 p-3"><p className="text-xs text-slate-500">Em aberto</p><p className="mt-1 text-base font-bold text-warning">{formatCurrency(totalOpen)}</p></div>
          <div className="rounded-xl bg-surface-muted p-3"><p className="text-xs text-slate-500">Compras</p><p className="mt-1 text-base font-bold text-slate-900">{sales?.length ?? 0}</p></div>
        </div>

        {totalOpen > 0 && whatsappNumber && <a className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white" target="_blank" rel="noreferrer" href={whatsappLink(whatsappNumber, chargeText)}><MessageCircle size={17} /> Cobrar no WhatsApp</a>}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Histórico completo de compras</h2>
        {!sales || sales.length === 0 ? <div className="card py-10 text-center text-sm text-slate-500">Este cliente ainda não possui compras.</div> : sales.map((sale) => {
          const saleItems = itemsBySale.get(sale.id) ?? [];
          const saleInstallments = installmentsBySale.get(sale.id) ?? [];
          const open = saleInstallments.filter((i) => i.status !== "pago").reduce((sum, i) => sum + Number(i.amount) - Number(i.paid_amount), 0);
          return (
            <div key={sale.id} className="card">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div><Link href={`/vender/${sale.id}`} className="text-sm font-bold text-brand-600">Venda #{sale.sale_number}</Link><p className="mt-0.5 text-xs text-slate-500">{formatDateTime(sale.created_at)}</p></div>
                <div className="text-right"><p className="text-base font-bold text-slate-900">{formatCurrency(Number(sale.total))}</p><p className={`text-xs font-semibold ${open > 0 ? "text-warning" : "text-success"}`}>{open > 0 ? `${formatCurrency(open)} em aberto` : "Quitada"}</p></div>
              </div>

              <div className="py-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Produtos</p><ul className="space-y-2">{saleItems.map((item) => <li key={item.id} className="flex items-center justify-between text-sm"><span className="text-slate-700">{item.quantity}x {item.product_name_snapshot} {item.variant_name_snapshot ? `— ${item.variant_name_snapshot}` : ""}</span><span className="font-semibold text-slate-900">{formatCurrency(Number(item.subtotal))}</span></li>)}</ul></div>

              {saleInstallments.length > 0 && <div className="border-t border-slate-100 pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Parcelas e pagamentos</p><div className="space-y-2">{saleInstallments.map((inst) => <div key={inst.id} className="rounded-xl bg-surface-muted p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-800">Parcela {inst.installment_number}/{inst.total_installments}</p><p className="text-xs text-slate-500">Vence {formatDate(inst.due_date)}</p></div><div className="text-right"><p className="text-sm font-bold">{formatCurrency(Number(inst.amount))}</p><p className="text-xs text-slate-500">Pago: {formatCurrency(Number(inst.paid_amount))}</p></div></div>{(paymentsByInstallment.get(inst.id) ?? []).map((p) => <p key={p.id} className="mt-2 border-t border-slate-200 pt-2 text-xs text-success">Recebido {formatCurrency(Number(p.amount))} em {formatDate(p.payment_date)} via {p.payment_method}</p>)}</div>)}</div></div>}
            </div>
          );
        })}
      </div>

      {customer.notes && <div className="card"><h2 className="mb-2 text-sm font-bold text-slate-900">Observações da ficha</h2><p className="text-sm text-slate-600">{customer.notes}</p></div>}
    </div>
  );
}
