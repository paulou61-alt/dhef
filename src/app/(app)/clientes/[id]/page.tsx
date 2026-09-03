import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageCircle, Pencil, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CustomerStat } from "@/components/customers/CustomerStat";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { formatCurrency, formatDate } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";
import { deleteCustomer } from "@/app/(app)/clientes/actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-slate-100 text-slate-600" },
  parcial: { label: "Parcial", className: "bg-warning/10 text-warning" },
  vencido: { label: "Vencido", className: "bg-danger/10 text-danger" },
  pago: { label: "Pago", className: "bg-success/10 text-success" },
};

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!customer) notFound();

  const { data: sales } = await supabase
    .from("sales")
    .select("id, sale_number, total, down_payment, created_at, payment_method, is_paid, status, is_opening_balance")
    .eq("customer_id", params.id)
    .order("created_at", { ascending: false });

  const saleIds = (sales ?? []).map((s) => s.id);
  const saleMap = new Map((sales ?? []).map((sale) => [sale.id, sale]));

  const { data: installments } = saleIds.length
    ? await supabase
        .from("installments")
        .select("id, sale_id, installment_number, total_installments, amount, paid_amount, due_date, status")
        .in("sale_id", saleIds)
        .order("due_date", { ascending: true })
    : { data: [] as any[] };

  const actualSales = (sales ?? []).filter((sale) => !sale.is_opening_balance);
  const completedPurchases = actualSales.filter((sale) => sale.status === "completed");

  const totalPurchased = completedPurchases.reduce((sum, sale) => sum + Number(sale.total), 0);

  const totalOpen = (installments ?? [])
    .filter((i) => i.status !== "pago")
    .reduce((sum, i) => sum + Math.max(0, Number(i.amount) - Number(i.paid_amount)), 0);

  const installmentPaid = (installments ?? []).reduce((sum, installment) => sum + Number(installment.paid_amount), 0);
  const directPaid = completedPurchases.reduce(
    (sum, sale) => sum + (sale.is_paid ? Number(sale.total) : Number(sale.down_payment ?? 0)),
    0,
  );
  const totalPaid = directPaid + installmentPaid;

  const pendingInstallments = (installments ?? []).filter((i) => i.status !== "pago" && Number(i.amount) - Number(i.paid_amount) > 0);

  const whatsappNumber = customer.whatsapp ?? customer.phone;
  const chargeMessage = `Olá ${customer.name}, tudo bem? Você tem ${formatCurrency(
    totalOpen
  )} em aberto comigo. Pode me confirmar quando consegue acertar?`;

  return (
    <div className="space-y-4">
      <Link href="/clientes" className="inline-flex items-center gap-1 text-[14px] font-medium text-slate-500">
        <ChevronLeft size={18} />
        Clientes
      </Link>

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-600">
              {customer.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{customer.name}</h1>
              {customer.phone && <p className="text-[13px] text-slate-500">{customer.phone}</p>}
              {(customer.city || customer.neighborhood) && (
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-slate-400">
                  <MapPin size={12} />
                  {[customer.neighborhood, customer.city].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/clientes/${customer.id}/editar`}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-muted text-slate-500"
          >
            <Pencil size={16} />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <CustomerStat label="Total comprado" value={formatCurrency(totalPurchased)} />
          <CustomerStat label="Total pago" value={formatCurrency(totalPaid)} tone="success" />
          <CustomerStat label="Em aberto" value={formatCurrency(totalOpen)} tone={totalOpen > 0 ? "warning" : undefined} />
          <CustomerStat label="Compras" value={String(completedPurchases.length)} />
        </div>

        {totalOpen > 0 && whatsappNumber && (
          <a
            href={whatsappLink(whatsappNumber, chargeMessage)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-success px-5 py-3.5 text-[15px] font-semibold text-white active:scale-[0.98]"
          >
            <MessageCircle size={18} />
            Cobrar no WhatsApp
          </a>
        )}
      </div>

      {pendingInstallments.length > 0 && (
        <div className="card">
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">Valores em aberto</h2>
          <ul className="divide-y divide-slate-100">
            {pendingInstallments.map((i) => {
              const sale = saleMap.get(i.sale_id);
              return (
                <li key={i.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className={`text-[13px] font-medium ${sale?.is_opening_balance ? "text-amber-700" : "text-slate-700"}`}>
                      {sale?.is_opening_balance ? "Saldo devedor inicial" : `Parcela ${i.installment_number}/${i.total_installments}`}
                    </p>
                    <p className="text-[12px] text-slate-500">Vence em {formatDate(i.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-900">
                      {formatCurrency(Number(i.amount) - Number(i.paid_amount))}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_LABELS[i.status]?.className}`}>
                      {STATUS_LABELS[i.status]?.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 text-[15px] font-bold text-slate-900">Histórico de vendas</h2>
        {actualSales.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma venda registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {actualSales.map((s) => (
              <li key={s.id}>
                <Link href={`/vender/${s.id}`} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-[13px] font-medium text-slate-700">Venda #{s.sale_number}</p>
                    <p className="text-[12px] text-slate-500">{formatDate(s.created_at)}</p>
                  </div>
                  <span className="text-[13px] font-bold text-slate-900">{formatCurrency(Number(s.total))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {customer.notes && (
        <div className="card">
          <h2 className="mb-2 text-[15px] font-bold text-slate-900">Observações</h2>
          <p className="text-sm text-slate-600">{customer.notes}</p>
        </div>
      )}

      <DeleteButton
        action={deleteCustomer.bind(null, customer.id)}
        confirmMessage={`Excluir ${customer.name}? Essa ação não pode ser desfeita.`}
      />
    </div>
  );
}
