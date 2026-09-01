import { redirect } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { getMonthlyBusinessReport, normalizeReportMonth } from "@/lib/reports/monthly-report";
import { formatCurrency } from "@/utils/format";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage({ searchParams }: { searchParams: { month?: string } }) {
  const monthKey = normalizeReportMonth(searchParams.month);
  const report = await getMonthlyBusinessReport(monthKey);
  if (!report) redirect("/");

  const { summary } = report;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Relatório do mês</h1>
          <p className="mt-1 text-sm text-slate-500">Fechamento de {report.monthLabel} com visão financeira e operacional do negócio.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <form method="get" className="flex items-end gap-2">
            <div>
              <label htmlFor="month" className="mb-1 block text-xs font-semibold text-slate-500">Mês do relatório</label>
              <input id="month" name="month" type="month" defaultValue={report.monthKey} className="input-field min-w-[170px]" />
            </div>
            <button type="submit" className="btn-secondary h-[46px] px-4">Ver mês</button>
          </form>
          <a href={`/api/relatorios/pdf?month=${report.monthKey}`} className="btn-primary flex h-[46px] items-center justify-center gap-2 px-4">
            <Download size={18} /> Exportar relatório
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm"><FileText size={19} /></span>
          <div>
            <p className="text-sm font-bold text-slate-900">PDF completo do fechamento</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">O arquivo inclui resumo financeiro, vendas, recebimentos, dívidas atuais, despesas, produtos vendidos, estoque, clientes e desempenho dos colaboradores.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card"><p className="text-xs text-slate-500">Faturamento</p><p className="mt-1 text-xl font-bold text-brand-600">{formatCurrency(summary.revenue)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Lucro estimado</p><p className={`mt-1 text-xl font-bold ${summary.netProfit >= 0 ? "text-success" : "text-danger"}`}>{formatCurrency(summary.netProfit)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Despesas</p><p className="mt-1 text-xl font-bold text-danger">{formatCurrency(summary.expenses)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Recebido em parcelas</p><p className="mt-1 text-xl font-bold text-success">{formatCurrency(summary.paymentsReceived)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Vendas</p><p className="mt-1 text-xl font-bold text-slate-900">{summary.salesCount}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Pares/itens vendidos</p><p className="mt-1 text-xl font-bold text-slate-900">{summary.units}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Ticket médio</p><p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(summary.averageTicket)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Saldo atual a receber</p><p className="mt-1 text-xl font-bold text-warning">{formatCurrency(summary.openReceivables)}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">Clientes que mais compraram</h2>
          {report.topCustomers.length === 0 ? <p className="text-sm text-slate-500">Sem dados neste mês.</p> : (
            <ol className="space-y-3">{report.topCustomers.slice(0, 5).map((customer, index) => <li key={customer.id} className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{index + 1}</span><span className="truncate text-sm font-semibold text-slate-800">{customer.name}</span></div><span className="flex-shrink-0 text-sm font-bold text-slate-900">{formatCurrency(customer.total)}</span></li>)}</ol>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-[15px] font-bold text-slate-900">Produtos mais vendidos</h2>
          {report.topProducts.length === 0 ? <p className="text-sm text-slate-500">Sem dados neste mês.</p> : (
            <ol className="space-y-3">{report.topProducts.slice(0, 5).map((product, index) => <li key={product.name} className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{product.name}</p><p className="text-xs text-slate-500">{product.qty} unidade(s)</p></div></div><span className="flex-shrink-0 text-sm font-bold text-slate-900">{formatCurrency(product.revenue)}</span></li>)}</ol>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card"><p className="text-xs text-slate-500">Saldo vencido atual</p><p className="mt-1 text-lg font-bold text-danger">{formatCurrency(summary.overdueReceivables)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Estoque atual</p><p className="mt-1 text-lg font-bold text-slate-900">{summary.stockUnits} unidade(s)</p><p className="mt-1 text-xs text-slate-500">Custo: {formatCurrency(summary.stockCostValue)}</p></div>
        <div className="card"><p className="text-xs text-slate-500">Vales dos colaboradores</p><p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(summary.totalValeBalance)}</p></div>
      </div>
    </div>
  );
}
