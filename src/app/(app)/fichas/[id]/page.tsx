import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Phone, MessageCircle, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";

export const dynamic = "force-dynamic";

export default async function FichaClientePage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const access = await getAccessContext();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", params.id).single();
  if (!customer) notFound();

  const [{ data: responsible }, { data: sales }] = await Promise.all([
    customer.assigned_collaborator_id
      ? supabase.from("collaborators").select("id, name, role").eq("id", customer.assigned_collaborator_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    supabase.from("sales").select("*").eq("customer_id", params.id).eq("status", "completed").order("created_at", { ascending: false }),
  ]);

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
  const saleMap = new Map((sales ?? []).map((sale) => [sale.id, sale]));
  const purchaseSales = (sales ?? []).filter((sale) => !sale.is_opening_balance);

  const totalPurchased = purchaseSales.reduce((sum, sale) => sum + Number(sale.total), 0);
  const pendingInstallments = (installments ?? []).filter((i) => i.status !== "pago" && Number(i.amount) - Number(i.paid_amount) > 0);
  const totalOpen = pendingInstallments.reduce((sum, i) => sum + Number(i.amount) - Number(i.paid_amount), 0);
  const totalReceivedFromInstallments = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const directPaid = purchaseSales.reduce((sum, sale) => sum + (sale.is_paid ? Number(sale.total) : Number(sale.down_payment)), 0);
  const totalPaid = directPaid + totalReceivedFromInstallments;

  const whatsappNumber = customer.whatsapp ?? customer.phone;
  const chargeLines = pendingInstallments.map((inst) => {
    const sale = saleMap.get(inst.sale_id);
    const open = Number(inst.amount) - Number(inst.paid_amount);
    const dueLabel = inst.status === "vencido" ? `vencido em ${formatDate(inst.due_date)}` : `vence em ${formatDate(inst.due_date)}`;
    return sale?.is_opening_balance
      ? `• Saldo devedor inicial — ${formatCurrency(open)} — ${dueLabel}`
      : `• Parcela ${inst.installment_number}/${inst.total_installments} da venda #${sale?.sale_number ?? "-"} — ${formatCurrency(open)} — ${dueLabel}`;
  });
  const chargeText = `Olá ${customer.name}, tudo bem?\n\nEstou entrando em contato sobre ${chargeLines.length === 1 ? "um valor pendente" : "os valores pendentes"} da sua ficha #${customer.ficha_number}:\n\n${chargeLines.join("\n")}\n\nTotal pendente: ${formatCurrency(totalOpen)}. Quando puder, me confirme sobre o pagamento. Obrigado!`;

  return (
    <div className="space-y-4">
      <Link href="/fichas" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500"><ChevronLeft size={18} /> Fichas</Link>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 min-w-12 items-center justify-center rounded-xl bg-brand-50 px-2 text-sm font-bold text-brand-700">#{customer.ficha_number}</span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Ficha #{customer.ficha_number}</p>
              <h1 className="text-lg font-bold text-slate-900">{customer.name}</h1>
              {customer.phone && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><Phone size={12} /> {customer.phone}</p>}
              {(customer.city || customer.neighborhood) && <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {[customer.neighborhood, customer.city].filter(Boolean).join(", ")}</p>}
            </div>
          </div>
          {access?.role !== "cobrador" && <Link href={`/clientes/${customer.id}/editar`} className="btn-secondary px-4 py-2.5 text-sm">Editar cliente</Link>}
        </div>

        <div className="mt-4 rounded-xl bg-surface-muted p-3">
          <p className="text-xs text-slate-500">Colaborador responsável</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800"><UserRound size={15} /> {responsible?.name ?? "Sem colaborador"}{responsible ? ` · ${responsible.role === "vendedor" ? "Vendedor" : "Cobrador"}` : ""}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-xl bg-surface-muted p-3"><p className="text-xs text-slate-500">Total comprado</p><p className="mt-1 text-base font-bold text-slate-900">{formatCurrency(totalPurchased)}</p></div>
          <div className="rounded-xl bg-success/10 p-3"><p className="text-xs text-slate-500">Total pago</p><p className="mt-1 text-base font-bold text-success">{formatCurrency(totalPaid)}</p></div>
          <div className="rounded-xl bg-warning/10 p-3"><p className="text-xs text-slate-500">Em aberto</p><p className="mt-1 text-base font-bold text-warning">{formatCurrency(totalOpen)}</p></div>
          <div className="rounded-xl bg-surface-muted p-3"><p className="text-xs text-slate-500">Compras</p><p className="mt-1 text-base font-bold text-slate-900">{purchaseSales.length}</p></div>
        </div>

        {totalOpen > 0 && whatsappNumber && <a className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white" target="_blank" rel="noreferrer" href={whatsappLink(whatsappNumber, chargeText)}><MessageCircle size={17} /> Cobrar no WhatsApp</a>}
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Histórico completo da ficha</h2>
        {!sales || sales.length === 0 ? <div className="card py-10 text-center text-sm text-slate-500">Este cliente ainda não possui movimentações.</div> : sales.map((sale) => {
          const saleItems = itemsBySale.get(sale.id) ?? [];
          const saleInstallments = installmentsBySale.get(sale.id) ?? [];
          const open = saleInstallments.filter((i) => i.status !== "pago").reduce((sum, i) => sum + Number(i.amount) - Number(i.paid_amount), 0);
          return (
            <div key={sale.id} className={`card ${sale.is_opening_balance ? "border border-amber-200 bg-amber-50/30" : ""}`}>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  {sale.is_opening_balance ? (
                    <p className="text-sm font-bold text-amber-700">Saldo devedor inicial</p>
                  ) : (
                    <Link href={`/vender/${sale.id}`} className="text-sm font-bold text-brand-600">Venda #{sale.sale_number}</Link>
                  )}
                  <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(sale.created_at)}</p>
                </div>
                <div className="text-right"><p className="text-base font-bold text-slate-900">{formatCurrency(Number(sale.total))}</p><p className={`text-xs font-semibold ${open > 0 ? "text-warning" : "text-success"}`}>{open > 0 ? `${formatCurrency(open)} em aberto` : "Quitado"}</p></div>
              </div>

              {!sale.is_opening_balance && (
                <div className="py-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Produtos</p><ul className="space-y-2">{saleItems.map((item) => <li key={item.id} className="flex items-center justify-between text-sm"><span className="text-slate-700">{item.quantity}x {item.product_name_snapshot} {item.variant_name_snapshot ? `— ${item.variant_name_snapshot}` : ""}</span><span className="font-semibold text-slate-900">{formatCurrency(Number(item.subtotal))}</span></li>)}</ul></div>
              )}

              {saleInstallments.length > 0 && <div className={`${sale.is_opening_balance ? "pt-3" : "border-t border-slate-100 pt-3"}`}><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{sale.is_opening_balance ? "Saldo e pagamentos" : "Parcelas e pagamentos"}</p><div className="space-y-2">{saleInstallments.map((inst) => <div key={inst.id} className="rounded-xl bg-white/80 p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-800">{sale.is_opening_balance ? "Saldo inicial" : `Parcela ${inst.installment_number}/${inst.total_installments}`}</p><p className="text-xs text-slate-500">Vence {formatDate(inst.due_date)}</p></div><div className="text-right"><p className="text-sm font-bold">{formatCurrency(Number(inst.amount))}</p><p className="text-xs text-slate-500">Pago: {formatCurrency(Number(inst.paid_amount))}</p></div></div>{(paymentsByInstallment.get(inst.id) ?? []).map((p) => <p key={p.id} className="mt-2 border-t border-slate-200 pt-2 text-xs text-success">Recebido {formatCurrency(Number(p.amount))} em {formatDate(p.payment_date)} via {p.payment_method}</p>)}</div>)}</div></div>}
            </div>
          );
        })}
      </div>

      {customer.notes && <div className="card"><h2 className="mb-2 text-sm font-bold text-slate-900">Observações da ficha</h2><p className="text-sm text-slate-600">{customer.notes}</p></div>}
    </div>
  );
}
