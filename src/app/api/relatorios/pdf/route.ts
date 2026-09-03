import { createSimplePdf, type PdfSection } from "@/lib/pdf/simple-pdf";
import { getMonthlyBusinessReport, normalizeReportMonth } from "@/lib/reports/monthly-report";
import { formatCurrency, formatDate } from "@/utils/format";

export const dynamic = "force-dynamic";

const paymentLabels: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  fiado: "Fiado",
  parcelado: "Parcelado",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = normalizeReportMonth(url.searchParams.get("month"));
  const report = await getMonthlyBusinessReport(month);

  if (!report) {
    return new Response("Não autorizado.", { status: 401 });
  }

  const s = report.summary;
  const sections: PdfSection[] = [
    {
      title: "Resumo financeiro",
      lines: [
        `Faturamento: ${formatCurrency(s.revenue)}`,
        `Custo dos produtos vendidos: ${formatCurrency(s.cost)}`,
        `Lucro bruto: ${formatCurrency(s.grossProfit)}`,
        `Despesas: ${formatCurrency(s.expenses)}`,
        `Lucro líquido estimado: ${formatCurrency(s.netProfit)}`,
        `Entradas de caixa registradas no mês: ${formatCurrency(s.cashIn)}`,
        `Recebimentos de parcelas no mês: ${formatCurrency(s.paymentsReceived)}`,
        `Quantidade de vendas: ${s.salesCount}`,
        `Itens vendidos: ${s.units}`,
        `Ticket médio: ${formatCurrency(s.averageTicket)}`,
        `Clientes cadastrados: ${s.customersCount}`,
        `Saldo atual a receber: ${formatCurrency(s.openReceivables)}`,
        `Saldo atual vencido: ${formatCurrency(s.overdueReceivables)}`,
        `Estoque atual: ${s.stockUnits} unidade(s)`,
        `Valor de custo do estoque atual: ${formatCurrency(s.stockCostValue)}`,
        `Valor potencial de venda do estoque atual: ${formatCurrency(s.stockSaleValue)}`,
        `Saldo total atual de vales dos colaboradores: ${formatCurrency(s.totalValeBalance)}`,
      ],
    },
    {
      title: "Vendas do mês",
      lines: report.salesRows.map(
        (sale) => `${formatDate(sale.date)} | Venda #${sale.saleNumber} | ${sale.customer} | Vendedor: ${sale.seller} | ${paymentLabels[sale.paymentMethod] ?? sale.paymentMethod} | ${formatCurrency(sale.total)}`,
      ),
    },
    {
      title: "Recebimentos no mês",
      lines: report.paymentRows.map(
        (payment) => `${formatDate(payment.date)} | ${payment.customer} | ${payment.reference}${payment.saleNumber ? ` #${payment.saleNumber}` : ""} | ${paymentLabels[payment.method] ?? payment.method} | Recebido por: ${payment.collector} | ${formatCurrency(payment.amount)}`,
      ),
    },
    {
      title: "Carteira atual a receber",
      lines: report.openReceivablesRows.map(
        (row) => `${row.overdue ? "VENCIDO" : "EM ABERTO"} | ${row.customer}${row.fichaNumber ? ` | Ficha ${row.fichaNumber}` : ""} | ${row.reference}${row.saleNumber ? ` #${row.saleNumber}` : ""}${row.saleNumber ? ` | Parcela ${row.installmentNumber}/${row.totalInstallments}` : ""} | Vencimento ${formatDate(row.dueDate)} | ${formatCurrency(row.openAmount)}`,
      ),
    },
    {
      title: "Despesas do mês",
      lines: report.expenseRows.map(
        (expense) => `${formatDate(expense.date)} | ${expense.category} | ${expense.description} | ${formatCurrency(expense.amount)}`,
      ),
    },
    {
      title: "Produtos vendidos no mês",
      lines: report.topProducts.map(
        (product) => `${product.name} | ${product.qty} unidade(s) | Faturamento ${formatCurrency(product.revenue)} | Custo ${formatCurrency(product.cost)} | Margem bruta ${formatCurrency(product.profit)}`,
      ),
    },
    {
      title: "Clientes que mais compraram",
      lines: report.topCustomers.map((customer, index) => `${index + 1}. ${customer.name} | ${formatCurrency(customer.total)}`),
    },
    {
      title: "Estoque atual",
      lines: report.stockRows.map(
        (stock) => `${stock.product} - ${stock.variant} | Qtd. ${stock.quantity} | Custo un. ${formatCurrency(stock.unitCost)} | Venda un. ${formatCurrency(stock.unitSale)} | Custo em estoque ${formatCurrency(stock.costValue)} | Potencial ${formatCurrency(stock.saleValue)}`,
      ),
    },
    {
      title: "Colaboradores",
      lines: report.collaboratorRows.map(
        (collaborator) => `${collaborator.name} | ${collaborator.role === "vendedor" ? "Vendedor" : "Cobrador"} | Vendas no mês ${formatCurrency(collaborator.salesTotal)} | Recebido em cobranças ${formatCurrency(collaborator.collectedTotal)} | Saldo de vale ${formatCurrency(collaborator.valeBalance)}`,
      ),
    },
  ];

  const businessInfo = [report.business.name, `Fechamento de ${report.monthLabel}`, `Responsável: ${report.business.ownerName}`];
  if (report.business.phone) businessInfo.push(`Telefone: ${report.business.phone}`);
  businessInfo.push(`Gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR")}`);

  const pdf = createSimplePdf("Relatório mensal do negócio", businessInfo.join(" | "), sections);

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-negocio-${report.monthKey}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
