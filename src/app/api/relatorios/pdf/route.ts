import { createSimplePdf, type PdfSection } from "@/lib/pdf/simple-pdf";
import { getMonthlyBusinessReport, normalizeReportMonth } from "@/lib/reports/monthly-report";
import { formatCurrency } from "@/utils/format";
import { companyHasFeature } from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await companyHasFeature("relatorios"))) {
    return new Response("O relatório em PDF está disponível a partir do plano Profissional.", { status: 403 });
  }
  const url = new URL(request.url);
  const month = normalizeReportMonth(url.searchParams.get("month"));
  const report = await getMonthlyBusinessReport(month);

  if (!report) {
    return new Response("Não autorizado.", { status: 401 });
  }

  const s = report.summary;
  const sections: PdfSection[] = [
    {
      title: "Principais dados do mês",
      lines: [
        `Faturamento: ${formatCurrency(s.revenue)}`,
        `Lucro bruto: ${formatCurrency(s.grossProfit)}`,
        `Despesas: ${formatCurrency(s.expenses)}`,
        `Lucro líquido estimado: ${formatCurrency(s.netProfit)}`,
        `Quantidade de vendas: ${s.salesCount}`,
        `Ticket médio: ${formatCurrency(s.averageTicket)}`,
        `Recebimentos de parcelas no mês: ${formatCurrency(s.paymentsReceived)}`,
        `Saldo atual a receber: ${formatCurrency(s.openReceivables)}`,
        `Saldo atual vencido: ${formatCurrency(s.overdueReceivables)}`,
      ],
    },
  ];

  const businessInfo = [report.business.name, `Fechamento de ${report.monthLabel}`, `Responsável: ${report.business.ownerName}`];
  if (report.business.phone) businessInfo.push(`Telefone: ${report.business.phone}`);
  businessInfo.push(`Gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR")}`);

  const pdf = createSimplePdf("Resumo mensal do negócio", businessInfo.join(" | "), sections);

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="resumo-negocio-${report.monthKey}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
