import Link from "next/link";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Banknote, HandCoins, PackageX, Plus, Receipt, Target, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { getAccessContext } from "@/lib/access";
import { CountUp } from "@/components/dashboard/CountUp";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { OverdueList, type OverdueItem } from "@/components/dashboard/OverdueList";
import { ActivityFeed, type ActivityItem } from "@/components/dashboard/ActivityFeed";
import {
  addDays, brazilDate, collectionRate, cumulative, dailyTotals, lastDays, monthPeriod, percentChange, splitPortfolio, startOfBrazilDay,
} from "@/lib/dashboard";
import { formatCurrency, todayInBrazil } from "@/utils/format";

export const dynamic = "force-dynamic";

const monthName = (date: string, style: "long" | "short") =>
  new Intl.DateTimeFormat("pt-BR", { month: style, timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(".", "");

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return null;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11.5px] font-medium ${up ? "text-emerald-700" : "text-rose-700"}`}>
      <Icon size={13} />{Math.abs(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%{suffix}
    </span>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();
  const access = await getAccessContext();
  const period = monthPeriod(todayInBrazil());
  const { today, monthStart, prevMonthStart, prevSamePeriodEnd } = period;
  const monthEnd = addDays(monthStart, period.monthDays - 1);
  const sparkStart = addDays(today, -13);
  const historyStart = sparkStart < prevMonthStart ? sparkStart : prevMonthStart;

  const [
    { data: salesRecent },
    { data: openInstallments },
    { data: overdueInstallments },
    { data: monthInstallments },
    { data: lowStockVariants },
    { data: monthExpenses },
    { data: paymentsRecent },
    { data: latestPayments },
    { data: latestSales },
    { data: latestDiscounts },
    { data: latestCustomers },
  ] = await Promise.all([
    // Vendas do mês anterior em diante: gráfico, comparação e minigráfico.
    fetchAll((from, to) =>
      supabase
        .from("sales")
        .select("id, total, created_at, sale_items(quantity, unit_cost_snapshot, unit_price_snapshot)")
        .eq("status", "completed")
        .eq("is_opening_balance", false)
        .gte("created_at", startOfBrazilDay(historyStart))
        .order("id")
        .range(from, to)
    ),
    fetchAll((from, to) =>
      supabase
        .from("installments")
        .select("id, amount, paid_amount, due_date, sales!inner(customer_id)")
        .in("status", ["pendente", "parcial", "vencido"])
        .order("id")
        .range(from, to)
    ),
    supabase
      .from("installments")
      .select("id, amount, paid_amount, due_date, sales!inner(customer_id, customers(name, phone, whatsapp))")
      .in("status", ["pendente", "parcial", "vencido"])
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(5),
    fetchAll((from, to) =>
      supabase
        .from("installments")
        .select("id, amount, paid_amount")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .order("id")
        .range(from, to)
    ),
    supabase
      .from("product_variants")
      .select("id, variant_name, stock_quantity, min_stock, products(name)")
      .order("stock_quantity", { ascending: true })
      .limit(100),
    fetchAll((from, to) =>
      supabase.from("expenses").select("amount").gte("expense_date", monthStart).order("id").range(from, to)
    ),
    fetchAll((from, to) =>
      supabase.from("payments").select("amount, payment_date").gte("payment_date", historyStart).order("id").range(from, to)
    ),
    supabase
      .from("payments")
      .select("id, amount, payment_method, created_at, installments(sales(customers(name)))")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("sales")
      .select("id, total, created_at, sale_number, payment_method, customers(name)")
      .eq("status", "completed")
      .eq("is_opening_balance", false)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("customer_discounts")
      .select("id, amount, note, created_at, reversed_at, customers(name)")
      .is("reversed_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("customers")
      .select("id, name, ficha_number, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  // Vendas
  const sales = (salesRecent ?? []).map((sale: any) => ({ ...sale, date: brazilDate(sale.created_at), amount: Number(sale.total) }));
  const monthSales = sales.filter((sale) => sale.date >= monthStart);
  const prevPeriodSales = sales.filter((sale) => sale.date >= prevMonthStart && sale.date <= prevSamePeriodEnd);
  const revenueMonth = monthSales.reduce((sum, sale) => sum + sale.amount, 0);
  const revenuePrev = prevPeriodSales.reduce((sum, sale) => sum + sale.amount, 0);
  const salesToday = sales.filter((sale) => sale.date === today);
  const revenueToday = salesToday.reduce((sum, sale) => sum + sale.amount, 0);
  const ticket = monthSales.length ? revenueMonth / monthSales.length : 0;
  const ticketPrev = prevPeriodSales.length ? revenuePrev / prevPeriodSales.length : 0;
  const grossProfit = monthSales.reduce((sum, sale: any) => sum + (sale.sale_items ?? []).reduce(
    (itemSum: number, item: any) => itemSum + (Number(item.unit_price_snapshot) - Number(item.unit_cost_snapshot)) * Number(item.quantity), 0), 0);
  const expenses = (monthExpenses ?? []).reduce((sum, item: any) => sum + Number(item.amount), 0);
  const netProfit = grossProfit - expenses;

  const currentSeries = cumulative(dailyTotals(monthSales, monthStart, period.monthDays)).slice(0, period.day);
  const previousSeries = cumulative(dailyTotals(sales, prevMonthStart, period.prevMonthDays));

  // Recebimentos
  const payments = (paymentsRecent ?? []).map((payment: any) => ({ date: payment.payment_date as string, amount: Number(payment.amount) }));
  const receivedMonth = payments.filter((p) => p.date >= monthStart).reduce((sum, p) => sum + p.amount, 0);
  const receivedPrev = payments.filter((p) => p.date >= prevMonthStart && p.date <= prevSamePeriodEnd).reduce((sum, p) => sum + p.amount, 0);

  // Carteira, clientes e cobrança do mês
  const portfolio = splitPortfolio((openInstallments ?? []) as any[], today);
  const owingCustomers = new Set((openInstallments ?? []).map((item: any) => item.sales?.customer_id).filter(Boolean)).size;
  const collection = collectionRate((monthInstallments ?? []) as any[]);
  const share = (value: number) => (portfolio.total > 0 ? (value / portfolio.total) * 100 : 0);

  const lowStock = (lowStockVariants ?? []).filter((v: any) => Number(v.stock_quantity) <= Number(v.min_stock));

  const overdueList: OverdueItem[] = (overdueInstallments ?? []).map((i: any) => ({
    installmentId: i.id,
    customerName: i.sales?.customers?.name ?? "Cliente",
    customerPhone: i.sales?.customers?.whatsapp ?? i.sales?.customers?.phone ?? null,
    amount: Math.max(0, Number(i.amount) - Number(i.paid_amount)),
    dueDate: i.due_date,
  }));

  const methodLabel: Record<string, string> = { pix: "Pix", dinheiro: "dinheiro", cartao: "cartão", fiado: "fiado", parcelado: "parcelado" };
  const activity: ActivityItem[] = [
    ...(latestPayments ?? []).map((p: any) => ({
      id: p.id, kind: "payment" as const, at: p.created_at, amount: Number(p.amount),
      title: `${p.installments?.sales?.customers?.name ?? "Cliente"} pagou`, detail: methodLabel[p.payment_method],
    })),
    ...(latestSales ?? []).map((s: any) => ({
      id: s.id, kind: "sale" as const, at: s.created_at, amount: Number(s.total),
      title: `Venda #${s.sale_number}${s.customers?.name ? ` para ${s.customers.name}` : ""}`, detail: methodLabel[s.payment_method],
    })),
    ...(latestDiscounts ?? []).map((d: any) => ({
      id: d.id, kind: "discount" as const, at: d.created_at, amount: Number(d.amount),
      title: `Desconto para ${d.customers?.name ?? "cliente"}`, detail: d.note ?? undefined,
    })),
    ...(latestCustomers ?? []).map((c: any) => ({
      id: c.id, kind: "customer" as const, at: c.created_at,
      title: `Novo cliente: ${c.name}`, detail: c.ficha_number ? `ficha #${c.ficha_number}` : undefined,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  const firstName = access?.name?.trim().split(/\s+/)[0];
  const monthLong = monthName(monthStart, "long");
  const prevLong = monthName(prevMonthStart, "long");
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${today}T12:00:00Z`));
  const revenueDelta = percentChange(revenueMonth, revenuePrev);
  const remainingToDue = Math.max(0, collection.due - collection.received);
  const ringOffset = 314.16 * (1 - Math.min(100, collection.rate) / 100);

  return (
    <div className="space-y-4">
      <header className="animate-rise flex flex-col gap-4 pt-1 md:flex-row md:items-end md:justify-between" style={{ animationDelay: "40ms" }}>
        <div>
          <p className="flex items-center gap-2 text-[13px] text-slate-500"><span className="live-dot h-2 w-2 rounded-full bg-emerald-400" />Caixa ao vivo · {dateLabel}</p>
          <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.035em] text-slate-900 md:text-[32px]">{greeting()}{firstName ? `, ${firstName}` : ""}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/receber" className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13.5px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"><Banknote size={16} className="text-slate-400" /> Receber</Link>
          <Link href="/vender" className="flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-brand-400 to-brand-500 px-4 text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_10px_24px_-8px_rgba(47,91,246,.7)] transition hover:-translate-y-0.5"><Plus size={16} /> Nova venda</Link>
        </div>
      </header>

      {/* Faturamento + gráfico */}
      <section className="glass glass-hover animate-rise p-5 md:p-7" style={{ animationDelay: "120ms" }} data-lift>
        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.55fr] [&>*]:min-w-0">
          <div className="flex flex-col">
            <p className="text-[13px] font-medium text-slate-500">Faturamento de {monthLong}</p>
            <p className="mt-3 whitespace-nowrap text-[40px] font-semibold leading-none tracking-[-0.045em] text-slate-900 sm:text-[48px] md:text-[56px]">
              <CountUp value={revenueMonth} format="currency" className="text-shine" duration={1900} />
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
              {revenueDelta !== null && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${revenueDelta >= 0 ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:ring-emerald-400/20" : "bg-rose-50 text-rose-700 ring-rose-600/15 dark:ring-rose-400/20"}`}>
                  {revenueDelta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  <CountUp value={Math.abs(revenueDelta)} format="percent" />
                </span>
              )}
              <span className="text-slate-500">{revenueDelta !== null ? `vs. ${prevLong} no mesmo período` : `Sem vendas em ${prevLong} para comparar`}</span>
            </div>
            <div className="mt-auto grid grid-cols-3 gap-2.5 pt-7">
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-3 dark:border-white/[.07] dark:!bg-white/[.03]">
                <p className="text-[11.5px] text-slate-500">Vendas</p>
                <p className="mt-1 text-[18px] font-semibold text-slate-900"><CountUp value={monthSales.length} delay={200} /></p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/60 p-3 dark:border-white/[.07] dark:!bg-white/[.03]">
                <p className="text-[11.5px] text-slate-500">Ticket médio</p>
                <p className="mt-1 whitespace-nowrap text-[18px] font-semibold text-slate-900"><CountUp value={ticket} format="currency-int" delay={260} /></p>
                <Delta value={percentChange(ticket, ticketPrev)} />
              </div>
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-400/15 dark:!bg-emerald-400/[.06]">
                <p className="text-[11.5px] text-emerald-800/70 dark:text-emerald-200/70">Lucro líquido</p>
                <p className={`mt-1 whitespace-nowrap text-[18px] font-semibold ${netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}><CountUp value={netProfit} format="currency-int" delay={320} /></p>
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-4 text-slate-500">
                <span className="flex items-center gap-2"><span className="h-[2px] w-4 rounded bg-brand-500 shadow-[0_0_8px_#4d7fff]" /><span className="capitalize">{monthLong}</span></span>
                <span className="flex items-center gap-2"><span className="h-[2px] w-4 rounded" style={{ background: "var(--chart-prev)" }} /><span className="capitalize">{prevLong}</span></span>
              </div>
              <span className="text-slate-400">acumulado</span>
            </div>
            <div className="mt-3">
              <RevenueChart
                current={currentSeries}
                previous={previousSeries}
                monthDays={period.monthDays}
                monthShort={monthName(monthStart, "short")}
                currentLabel={monthLong}
                previousLabel={prevLong}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Indicadores */}
      <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Link href="/financeiro" className="glass glass-hover animate-rise block p-4 md:p-5" style={{ animationDelay: "220ms" }} data-lift>
          <div className="relative">
            <div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:text-brand-300"><HandCoins size={17} /></span><Delta value={percentChange(receivedMonth, receivedPrev)} /></div>
            <p className="mt-4 text-[12.5px] text-slate-500">Recebido no mês</p>
            <p className="mt-1 whitespace-nowrap text-[20px] font-semibold tracking-[-0.03em] text-slate-900 md:text-[24px]"><CountUp value={receivedMonth} format="currency-int" delay={300} /></p>
            <Sparkline values={lastDays(payments, today, 14)} delay={600} className="mt-3" />
          </div>
        </Link>
        <Link href="/vender" className="glass glass-hover animate-rise block p-4 md:p-5" style={{ animationDelay: "290ms" }} data-lift>
          <div className="relative">
            <div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:text-brand-300"><Receipt size={17} /></span><span className="text-[11.5px] text-slate-500">{salesToday.length} {salesToday.length === 1 ? "venda" : "vendas"}</span></div>
            <p className="mt-4 text-[12.5px] text-slate-500">Vendas hoje</p>
            <p className="mt-1 whitespace-nowrap text-[20px] font-semibold tracking-[-0.03em] text-slate-900 md:text-[24px]"><CountUp value={revenueToday} format="currency-int" delay={360} /></p>
            <Sparkline values={lastDays(sales, today, 14)} delay={700} className="mt-3" />
          </div>
        </Link>
        <Link href="/clientes" className="glass glass-hover animate-rise block p-4 md:p-5" style={{ animationDelay: "360ms" }} data-lift>
          <div className="relative">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 dark:text-amber-300"><Users size={17} /></span>
            <p className="mt-4 text-[12.5px] text-slate-500">Clientes devendo</p>
            <p className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-slate-900 md:text-[24px]"><CountUp value={owingCustomers} delay={420} /></p>
            <p className="mt-3 text-[12px] leading-[34px] text-slate-500">Com saldo em aberto</p>
          </div>
        </Link>
        <Link href="/estoque" className="glass glass-hover animate-rise block p-4 md:p-5" style={{ animationDelay: "430ms" }} data-lift>
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 dark:text-rose-300"><PackageX size={17} /></span>
              {lowStock.length > 0 && <span className="rounded-full bg-rose-50 px-2 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15">repor</span>}
            </div>
            <p className="mt-4 text-[12.5px] text-slate-500">Estoque baixo</p>
            <p className="mt-1 text-[20px] font-semibold tracking-[-0.03em] text-slate-900 md:text-[24px]"><CountUp value={lowStock.length} delay={480} /> <span className="text-[14px] font-normal text-slate-400">{lowStock.length === 1 ? "item" : "itens"}</span></p>
            {lowStock.length > 0 ? (
              <div className="mt-3 flex h-[34px] gap-1.5">
                {lowStock.slice(0, 2).map((v: any) => (
                  <span key={v.id} className="min-w-0 flex-1 rounded-lg bg-slate-100/80 px-2 pt-1 text-[10.5px] leading-tight text-slate-500 dark:!bg-white/[.05]">
                    <span className="block truncate">{v.products?.name ?? v.variant_name}</span>
                    <b className={Number(v.stock_quantity) <= 0 ? "text-rose-600" : "text-amber-700"}>{Number(v.stock_quantity)} un</b>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-[12px] leading-[34px] text-slate-500"><AlertCircle size={13} className="text-emerald-500" />Tudo abastecido</p>
            )}
          </div>
        </Link>
      </section>

      {/* Carteira + cobrança do mês */}
      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="glass glass-hover animate-rise p-5 md:p-6" style={{ animationDelay: "500ms" }} data-lift>
          <div className="relative">
            <div className="flex items-baseline justify-between gap-3">
              <div><h2 className="text-[15px] font-semibold text-slate-900">Carteira a receber</h2><p className="mt-0.5 text-[12.5px] text-slate-500">{portfolio.upcoming.count + portfolio.nextWeek.count + portfolio.overdue.count} parcelas de {owingCustomers} clientes</p></div>
              <p className="whitespace-nowrap text-[20px] font-semibold tracking-tight text-slate-900 md:text-[22px]"><CountUp value={portfolio.total} format="currency-int" delay={550} /></p>
            </div>
            <div className="mt-6 flex h-3 gap-[3px] overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`A vencer ${Math.round(share(portfolio.upcoming.amount))}%, em 7 dias ${Math.round(share(portfolio.nextWeek.amount))}%, vencido ${Math.round(share(portfolio.overdue.amount))}%`}>
              {portfolio.upcoming.amount > 0 && <div className="animate-grow-x h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 shadow-[0_0_16px_rgba(77,127,255,.5)]" style={{ width: `${share(portfolio.upcoming.amount)}%`, animationDelay: "800ms" }} />}
              {portfolio.nextWeek.amount > 0 && <div className="animate-grow-x h-full rounded-full bg-brand-300" style={{ width: `${share(portfolio.nextWeek.amount)}%`, animationDelay: "1000ms" }} />}
              {portfolio.overdue.amount > 0 && <div className="animate-grow-x h-full rounded-full bg-rose-500 shadow-[0_0_16px_rgba(240,68,56,.45)]" style={{ width: `${share(portfolio.overdue.amount)}%`, animationDelay: "1200ms" }} />}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: "A vencer", dot: "bg-brand-500", data: portfolio.upcoming, tone: "" },
                { label: "Em 7 dias", dot: "bg-brand-300", data: portfolio.nextWeek, tone: "" },
                { label: "Vencido", dot: "bg-rose-500", data: portfolio.overdue, tone: "danger" },
              ].map((part, i) => (
                <div key={part.label} className={`rounded-2xl border p-3 sm:p-3.5 ${part.tone ? "border-rose-200/80 bg-rose-50/70 dark:border-rose-400/20 dark:!bg-rose-500/[.07]" : "border-slate-200/70 bg-white/60 dark:border-white/[.07] dark:!bg-white/[.03]"}`}>
                  <p className={`flex items-center gap-2 whitespace-nowrap text-[12px] ${part.tone ? "text-rose-700" : "text-slate-500"}`}><span className={`h-2 w-2 flex-none rounded-full ${part.dot}`} />{part.label}</p>
                  <p className={`mt-1.5 whitespace-nowrap text-[15px] font-semibold sm:text-[17px] ${part.tone ? "text-rose-700" : "text-slate-900"}`}><CountUp value={part.data.amount} format="currency-int" delay={650 + i * 80} /></p>
                  <p className="text-[11.5px] text-slate-500">{part.data.count} {part.data.count === 1 ? "parcela" : "parcelas"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link href="/receber" className="glass glass-hover animate-rise block p-5 md:p-6" style={{ animationDelay: "580ms" }} data-lift>
          <div className="relative flex h-full items-center gap-5 md:gap-6">
            <div className="relative h-[132px] w-[132px] flex-none md:h-[150px] md:w-[150px]">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
                <defs><linearGradient id="dash-ring" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#80a9ff" /><stop offset="1" stopColor="#2f5bf6" /></linearGradient></defs>
                <circle cx="60" cy="60" r="50" fill="none" strokeWidth="10" className="stroke-slate-200 dark:stroke-white/[.07]" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="url(#dash-ring)" strokeWidth="10" strokeLinecap="round" strokeDasharray="314.16" strokeDashoffset={ringOffset} className="animate-ring" style={{ animationDelay: "700ms", filter: "drop-shadow(0 0 8px rgba(77,127,255,.55))" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[28px] font-semibold tracking-tight text-slate-900"><CountUp value={Math.round(collection.rate)} delay={700} /><span className="text-[15px] text-slate-400">%</span></p>
                <p className="text-[11px] text-slate-500">recebido</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900"><Target size={15} className="text-brand-500" />Cobrança do mês</p>
              <p className="mt-1 text-[13px] leading-5 text-slate-500">
                Das parcelas que vencem em {monthLong}, já entraram <b className="font-semibold text-slate-900">{formatCurrency(collection.received)}</b> de <b className="font-semibold text-slate-900">{formatCurrency(collection.due)}</b>.
              </p>
              {remainingToDue > 0 && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] text-brand-700 ring-1 ring-inset ring-brand-600/15 dark:ring-brand-400/20">
                  Faltam {formatCurrency(remainingToDue)}
                </p>
              )}
            </div>
          </div>
        </Link>
      </section>

      {/* Vencidas + atividade */}
      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <OverdueList items={overdueList} total={portfolio.overdue.amount} count={portfolio.overdue.count} />
        <ActivityFeed items={activity} />
      </section>
    </div>
  );
}
