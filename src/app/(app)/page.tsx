import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  DollarSign,
  PackageX,
  Plus,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/access";
import { StatCard } from "@/components/dashboard/StatCard";
import { OverdueList, type OverdueItem } from "@/components/dashboard/OverdueList";
import { SimpleList, type SimpleListItem } from "@/components/dashboard/SimpleList";
import { formatCurrency, formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonth() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthLabel() {
  const text = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function DashboardPage() {
  const supabase = createClient();
  const access = await getAccessContext();
  const today = startOfToday();
  const monthStart = startOfMonth();
  const todayDate = new Date().toISOString().slice(0, 10);
  const in7days = daysFromNow(7);

  const [
    { data: salesToday },
    { data: salesMonth },
    { data: openInstallments },
    { data: overdueInstallments },
    { data: upcomingInstallments },
    { data: recentSales },
    { data: lowStockVariants },
    { data: monthExpenses },
    { data: monthPayments },
  ] = await Promise.all([
    supabase.from("sales").select("total").eq("status", "completed").gte("created_at", today),
    supabase
      .from("sales")
      .select("id, total, sale_items(quantity, unit_cost_snapshot, unit_price_snapshot)")
      .eq("status", "completed")
      .gte("created_at", monthStart),
    supabase
      .from("installments")
      .select("id, amount, paid_amount, sale_id, sales!inner(customer_id)")
      .in("status", ["pendente", "parcial", "vencido"]),
    supabase
      .from("installments")
      .select("id, amount, paid_amount, due_date, sales!inner(customer_id, customers(name, phone, whatsapp))")
      .in("status", ["pendente", "parcial", "vencido"])
      .lt("due_date", todayDate)
      .order("due_date", { ascending: true })
      .limit(10),
    supabase
      .from("installments")
      .select("id, amount, paid_amount, due_date, sales!inner(customers(name))")
      .in("status", ["pendente", "parcial"])
      .gte("due_date", todayDate)
      .lte("due_date", in7days)
      .order("due_date", { ascending: true })
      .limit(6),
    supabase
      .from("sales")
      .select("id, total, created_at, sale_number, customers(name)")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("product_variants")
      .select("id, variant_name, stock_quantity, min_stock, products(name)")
      .order("stock_quantity", { ascending: true })
      .limit(100),
    supabase.from("expenses").select("amount").gte("expense_date", monthStart.slice(0, 10)),
    supabase.from("payments").select("amount").gte("payment_date", monthStart.slice(0, 10)),
  ]);

  const revenueToday = (salesToday ?? []).reduce((sum, s) => sum + Number(s.total), 0);
  const revenueMonth = (salesMonth ?? []).reduce((sum, s) => sum + Number(s.total), 0);
  const grossProfitMonth = (salesMonth ?? []).reduce((sum, sale: any) => {
    const saleProfit = (sale.sale_items ?? []).reduce(
      (itemSum: number, item: any) => itemSum + (Number(item.unit_price_snapshot) - Number(item.unit_cost_snapshot)) * Number(item.quantity),
      0
    );
    return sum + saleProfit;
  }, 0);
  const expensesMonth = (monthExpenses ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
  const netProfitMonth = grossProfitMonth - expensesMonth;
  const receivedMonth = (monthPayments ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
  const totalOpen = (openInstallments ?? []).reduce((sum, item: any) => sum + Math.max(0, Number(item.amount) - Number(item.paid_amount)), 0);
  const owingCustomerIds = new Set((openInstallments ?? []).map((item: any) => item.sales?.customer_id).filter(Boolean));
  const lowStockItems = (lowStockVariants ?? []).filter((v: any) => Number(v.stock_quantity) <= Number(v.min_stock));

  const overdueList: OverdueItem[] = (overdueInstallments ?? []).map((i: any) => ({
    installmentId: i.id,
    customerName: i.sales?.customers?.name ?? "Cliente",
    customerPhone: i.sales?.customers?.whatsapp ?? i.sales?.customers?.phone ?? null,
    amount: Number(i.amount) - Number(i.paid_amount),
    dueDate: i.due_date,
  }));

  const upcomingList: SimpleListItem[] = (upcomingInstallments ?? []).map((i: any) => ({
    id: i.id,
    title: i.sales?.customers?.name ?? "Cliente",
    subtitle: `Vence em ${formatDate(i.due_date)}`,
    value: Math.max(0, Number(i.amount) - Number(i.paid_amount)),
    href: "/receber",
  }));

  const recentSalesList: SimpleListItem[] = (recentSales ?? []).map((s: any) => ({
    id: s.id,
    title: s.customers?.name ?? "Venda avulsa",
    subtitle: `Venda #${s.sale_number} · ${formatDate(s.created_at)}`,
    value: Number(s.total),
    href: `/vender/${s.id}`,
  }));

  const firstName = access?.name?.trim().split(/\s+/)[0] || "Olá";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-slate-950 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] md:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-400"><CalendarDays size={14} /> {monthLabel()}</div>
            <h1 className="text-2xl font-black tracking-[-0.035em] md:text-3xl">Bom trabalho, {firstName}.</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Acompanhe o caixa, as vendas e as cobranças do seu negócio em um só lugar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/vender" className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100"><Plus size={17} /> Nova venda</Link>
            <Link href="/receber" className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"><Banknote size={17} /> Receber</Link>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 lg:grid-cols-4">
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Faturamento</p><p className="mt-1 text-xl font-black tracking-tight">{formatCurrency(revenueMonth)}</p></div>
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Lucro líquido est.</p><p className={`mt-1 text-xl font-black tracking-tight ${netProfitMonth >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(netProfitMonth)}</p></div>
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">A receber</p><p className="mt-1 text-xl font-black tracking-tight text-amber-300">{formatCurrency(totalOpen)}</p></div>
          <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vendas no mês</p><p className="mt-1 text-xl font-black tracking-tight">{(salesMonth ?? []).length}</p></div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><p className="eyebrow">Visão geral</p><h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">Números que importam hoje</h2></div>
          <Link href="/relatorios" className="hidden items-center gap-1 text-xs font-bold text-brand-600 sm:flex">Ver relatórios <ArrowRight size={14} /></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Vendas hoje" value={formatCurrency(revenueToday)} icon={DollarSign} hint="Faturamento de hoje" />
          <StatCard label="Recebido no mês" value={formatCurrency(receivedMonth)} icon={CircleDollarSign} tone="success" hint="Pagamentos registrados" />
          <StatCard label="Clientes devendo" value={String(owingCustomerIds.size)} icon={Users} tone="warning" hint="Com saldo em aberto" />
          <StatCard label="Estoque baixo" value={String(lowStockItems.length)} icon={PackageX} tone={lowStockItems.length > 0 ? "danger" : "default"} hint="Itens no mínimo ou abaixo" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/vender" className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><ShoppingBag size={19} /></span><div><p className="text-sm font-bold text-slate-800">Registrar venda</p><p className="text-xs text-slate-400">Nova movimentação</p></div><ArrowRight size={15} className="ml-auto text-slate-300 group-hover:text-brand-500" /></Link>
        <Link href="/clientes/novo" className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><UserPlus size={19} /></span><div><p className="text-sm font-bold text-slate-800">Novo cliente</p><p className="text-xs text-slate-400">Criar ficha</p></div><ArrowRight size={15} className="ml-auto text-slate-300 group-hover:text-violet-500" /></Link>
        <Link href="/despesas" className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><ReceiptText size={19} /></span><div><p className="text-sm font-bold text-slate-800">Lançar despesa</p><p className="text-xs text-slate-400">Controlar saída</p></div><ArrowRight size={15} className="ml-auto text-slate-300 group-hover:text-rose-500" /></Link>
        <Link href="/financeiro" className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Wallet size={19} /></span><div><p className="text-sm font-bold text-slate-800">Financeiro</p><p className="text-xs text-slate-400">Ver fluxo de caixa</p></div><ArrowRight size={15} className="ml-auto text-slate-300 group-hover:text-emerald-500" /></Link>
      </section>

      <OverdueList items={overdueList} />

      <section className="grid gap-5 lg:grid-cols-2">
        <SimpleList title="Próximos recebimentos · 7 dias" items={upcomingList} emptyMessage="Nenhum recebimento previsto para os próximos dias." />
        <SimpleList title="Últimas vendas" items={recentSalesList} emptyMessage="Nenhuma venda registrada ainda." />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Lucro bruto" value={formatCurrency(grossProfitMonth)} icon={TrendingUp} tone="success" compact />
        <StatCard label="Despesas do mês" value={formatCurrency(expensesMonth)} icon={ReceiptText} tone="danger" compact />
        <StatCard label="Carteira a receber" value={formatCurrency(totalOpen)} icon={Wallet} tone="warning" compact />
        <StatCard label="Vendas realizadas" value={String((salesMonth ?? []).length)} icon={ShoppingBag} compact />
      </section>
    </div>
  );
}
