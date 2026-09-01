import Link from "next/link";
import { Users, ChevronRight, MessageCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FabButton } from "@/components/ui/FabButton";
import { formatCurrency } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";
import { buildChargeMessage, type ChargeInstallment } from "@/utils/charge-message";

export const dynamic = "force-dynamic";

export default async function ClientesPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const access = await getAccessContext();
  const query = searchParams.q?.trim() ?? "";
  const canCreate = access?.role !== "cobrador";

  let customersQuery = supabase.from("customers").select("id, name, phone, whatsapp, city").order("name", { ascending: true });
  if (query) customersQuery = customersQuery.ilike("name", `%${query}%`);

  const [{ data: customers }, { data: openInstallments }, { data: sales }] = await Promise.all([
    customersQuery,
    supabase.from("installments").select("id, sale_id, installment_number, total_installments, amount, paid_amount, due_date, status").in("status", ["pendente", "parcial", "vencido"]),
    supabase.from("sales").select("id, customer_id, sale_number").neq("status", "cancelled"),
  ]);

  const saleMap = new Map((sales ?? []).map((sale) => [sale.id, sale]));
  const customersWithPurchases = new Set((sales ?? []).map((sale) => sale.customer_id).filter(Boolean) as string[]);
  const chargesByCustomer = new Map<string, ChargeInstallment[]>();
  (openInstallments ?? []).forEach((item) => {
    const sale = saleMap.get(item.sale_id);
    if (!sale?.customer_id) return;
    const charge: ChargeInstallment = {
      installmentNumber: item.installment_number,
      totalInstallments: item.total_installments,
      saleNumber: sale.sale_number,
      dueDate: item.due_date,
      openAmount: Number(item.amount) - Number(item.paid_amount),
      status: item.status,
    };
    chargesByCustomer.set(sale.customer_id, [...(chargesByCustomer.get(sale.customer_id) ?? []), charge]);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1"><SearchBar placeholder="Buscar cliente..." /></div>
        {canCreate && <Link href="/clientes/novo" className="btn-primary hidden px-5 py-3 md:flex">Novo cliente</Link>}
      </div>

      {!customers || customers.length === 0 ? (
        <EmptyState icon={Users} title={query ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"} description={query ? "Tente buscar por outro nome." : "Cadastre seu primeiro cliente para começar a vender."} actionLabel={!query && canCreate ? "Novo cliente" : undefined} actionHref={!query && canCreate ? "/clientes/novo" : undefined} />
      ) : (
        <ul className="card divide-y divide-slate-100 !p-0 overflow-hidden">
          {customers.map((c) => {
            const charges = chargesByCustomer.get(c.id) ?? [];
            const balance = charges.reduce((sum, item) => sum + item.openAmount, 0);
            const phone = c.whatsapp ?? c.phone;
            const message = buildChargeMessage(c.name, charges);
            const isSettled = customersWithPurchases.has(c.id) && balance <= 0;

            return (
              <li key={c.id} className={`flex items-center gap-2 px-3 py-3 transition-colors ${isSettled ? "bg-success/5" : "bg-white"}`}>
                <Link href={`/clientes/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1">
                  <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${isSettled ? "bg-success/10 text-success" : "bg-brand-50 text-brand-600"}`}>{c.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className={`truncate text-[14px] font-semibold ${isSettled ? "text-success" : "text-slate-800"}`}>{c.name}</p>
                      {isSettled && <span className="hidden flex-shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success sm:inline-flex"><CheckCircle2 size={11} /> Quitado</span>}
                    </div>
                    <p className="truncate text-[12px] text-slate-500">{c.phone ?? c.city ?? "Sem informações"}</p>
                  </div>
                  {balance > 0 ? <span className="flex-shrink-0 text-[13px] font-bold text-warning">{formatCurrency(balance)}</span> : isSettled ? <span className="flex flex-shrink-0 items-center gap-1 text-[12px] font-bold text-success"><CheckCircle2 size={14} /> Pago</span> : null}
                  <ChevronRight size={18} className={`flex-shrink-0 ${isSettled ? "text-success/50" : "text-slate-300"}`} />
                </Link>
                {balance > 0 && phone && <a href={whatsappLink(phone, message)} target="_blank" rel="noreferrer" aria-label={`Cobrar ${c.name} no WhatsApp`} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-success text-white"><MessageCircle size={18} /></a>}
              </li>
            );
          })}
        </ul>
      )}

      {canCreate && <FabButton href="/clientes/novo" label="Novo cliente" />}
    </div>
  );
}
