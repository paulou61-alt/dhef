import { createMonthlyReportPdf } from "@/lib/pdf/monthly-report-pdf";
import { getMonthlyBusinessReport, normalizeReportMonth } from "@/lib/reports/monthly-report";
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

  const pdf = createMonthlyReportPdf(report);

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-negocio-${report.monthKey}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
