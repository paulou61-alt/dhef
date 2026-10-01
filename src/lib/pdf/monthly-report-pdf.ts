import "server-only";

import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { MonthlyBusinessReport } from "@/lib/reports/monthly-report";
import { formatCurrency, formatDate } from "@/utils/format";

type RGB = [number, number, number];

const BRAND: RGB = [47, 91, 246];
const BRAND_DARK: RGB = [29, 63, 201];
const BRAND_SOFT: RGB = [235, 240, 255];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const LINE: RGB = [226, 232, 240];
const SURFACE: RGB = [248, 250, 252];
const SUCCESS: RGB = [5, 150, 105];
const DANGER: RGB = [220, 38, 38];
const WARNING: RGB = [217, 119, 6];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  fiado: "Fiado",
  parcelado: "Parcelado",
};

const money = (value: number) => formatCurrency(value);
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);

// Relatório mensal em PDF com cabeçalho da marca, indicadores, gráfico e tabelas.
export function createMonthlyReportPdf(report: MonthlyBusinessReport): ArrayBuffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const monthTitle = capitalize(report.monthLabel);
  const s = report.summary;
  let y = 0;

  const setColor = (rgb: RGB) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb: RGB) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: RGB) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);

  function ensureSpace(height: number) {
    if (y + height > PAGE_H - 18) {
      doc.addPage();
      y = 18;
    }
  }

  function sectionTitle(title: string, subtitle?: string) {
    ensureSpace(subtitle ? 22 : 18);
    setFill(BRAND);
    doc.roundedRect(MARGIN, y, 1.6, subtitle ? 9 : 6, 0.8, 0.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    setColor(INK);
    doc.text(title, MARGIN + 4.5, y + 4.6);
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setColor(MUTED);
      doc.text(subtitle, MARGIN + 4.5, y + 9);
    }
    y += subtitle ? 13 : 9.5;
  }

  function table(head: string[], body: RowInput[], options: {
    align?: Record<number, "left" | "right" | "center">;
    widths?: Record<number, number>;
    foot?: string[];
    tone?: (row: number, column: number) => RGB | null;
    empty?: string;
  } = {}) {
    if (body.length === 0) {
      ensureSpace(14);
      setFill(SURFACE);
      doc.roundedRect(MARGIN, y, CONTENT_W, 11, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setColor(MUTED);
      doc.text(options.empty ?? "Sem registros neste mês.", MARGIN + 4, y + 7);
      y += 17;
      return;
    }

    const columnStyles: Record<number, { halign?: "left" | "right" | "center"; cellWidth?: number }> = {};
    Object.entries(options.align ?? {}).forEach(([key, halign]) => {
      columnStyles[Number(key)] = { ...columnStyles[Number(key)], halign };
    });
    Object.entries(options.widths ?? {}).forEach(([key, cellWidth]) => {
      columnStyles[Number(key)] = { ...columnStyles[Number(key)], cellWidth };
    });

    autoTable(doc, {
      startY: y,
      head: [head],
      body,
      foot: options.foot ? [options.foot] : undefined,
      showFoot: "lastPage",
      margin: { left: MARGIN, right: MARGIN, top: 18, bottom: 18 },
      theme: "plain",
      styles: { font: "helvetica", fontSize: 8.4, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, textColor: INK, lineColor: LINE, overflow: "linebreak" },
      headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.2 },
      footStyles: { fillColor: BRAND_SOFT, textColor: BRAND_DARK, fontStyle: "bold" },
      alternateRowStyles: { fillColor: SURFACE },
      bodyStyles: { lineWidth: { bottom: 0.15 } },
      columnStyles,
      didParseCell: (data) => {
        if (data.section === "foot" || data.section === "head") {
          const align = options.align?.[data.column.index];
          if (align) data.cell.styles.halign = align;
        }
        if (data.section !== "body" || !options.tone) return;
        const tone = options.tone(data.row.index, data.column.index);
        if (tone) {
          data.cell.styles.textColor = tone;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
  }

  // ---------- Cabeçalho ----------
  setFill(BRAND);
  doc.rect(0, 0, PAGE_W, 46, "F");
  setFill(BRAND_DARK);
  doc.circle(PAGE_W - 8, -6, 38, "F");
  setFill(BRAND);
  doc.circle(PAGE_W - 8, -6, 26, "F");

  // Marca: quadrado arredondado com o "C" e o sinal de pago.
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN, 11, 15, 15, 3.6, 3.6, "F");
  setDraw(BRAND);
  doc.setLineWidth(1.9);
  doc.setLineCap("round");
  doc.setLineJoin("round");
  // "C": círculo com uma abertura no lado direito, coberta por um retângulo branco.
  doc.circle(MARGIN + 7.5, 18.5, 4.1, "S");
  doc.setFillColor(255, 255, 255);
  doc.rect(MARGIN + 9.4, 13.2, 4.2, 5.2, "F");
  doc.lines([[2.4, 2.4], [4.4, -4.4]], MARGIN + 5.2, 18.4, [1, 1], "S", false);
  doc.setLineWidth(0.1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(report.business.name, MARGIN + 20, 17.5, { maxWidth: 120 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(214, 224, 255);
  doc.text(`Relatório mensal · ${monthTitle}`, MARGIN + 20, 24);

  doc.setFontSize(8);
  const generated = new Date(report.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const headerMeta = [`Responsável: ${report.business.ownerName}`, report.business.phone ? `Telefone: ${report.business.phone}` : null, `Gerado em ${generated}`]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(headerMeta, MARGIN, 38);

  y = 54;

  // ---------- Indicadores ----------
  const kpis: { label: string; value: string; hint?: string; tone?: RGB }[] = [
    { label: "Faturamento", value: money(s.revenue), hint: `${s.salesCount} venda(s)`, tone: BRAND },
    { label: "Lucro líquido estimado", value: money(s.netProfit), hint: s.revenue > 0 ? `Margem de ${Math.round((s.netProfit / s.revenue) * 100)}%` : undefined, tone: s.netProfit >= 0 ? SUCCESS : DANGER },
    { label: "Recebido em parcelas", value: money(s.paymentsReceived), tone: SUCCESS },
    { label: "Despesas", value: money(s.expenses), tone: DANGER },
    { label: "Ticket médio", value: money(s.averageTicket), hint: `${s.units} item(ns) vendido(s)` },
    { label: "A receber (hoje)", value: money(s.openReceivables), tone: WARNING },
    { label: "Vencido (hoje)", value: money(s.overdueReceivables), hint: s.openReceivables > 0 ? `${Math.round((s.overdueReceivables / s.openReceivables) * 100)}% do a receber` : undefined, tone: s.overdueReceivables > 0 ? DANGER : undefined },
    { label: "Clientes cadastrados", value: String(s.customersCount) },
  ];
  const cardGap = 4;
  const cardW = (CONTENT_W - cardGap * 3) / 4;
  const cardH = 23;
  kpis.forEach((kpi, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = MARGIN + col * (cardW + cardGap);
    const top = y + row * (cardH + cardGap);
    setFill([255, 255, 255]);
    setDraw(LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, top, cardW, cardH, 2.5, 2.5, "FD");
    setFill(kpi.tone ?? MUTED);
    doc.roundedRect(x, top + 4, 1.2, cardH - 8, 0.6, 0.6, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    setColor(MUTED);
    doc.text(kpi.label.toUpperCase(), x + 4, top + 6.5, { maxWidth: cardW - 6 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    setColor(kpi.tone ?? INK);
    doc.text(kpi.value, x + 4, top + 14);
    if (kpi.hint) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      setColor(MUTED);
      doc.text(kpi.hint, x + 4, top + 19.2);
    }
  });
  y += cardH * 2 + cardGap + 10;

  // ---------- Resultado do mês ----------
  sectionTitle("Resultado do mês", "Do faturamento ao lucro líquido estimado");
  const resultRows: [string, number, RGB | null, boolean][] = [
    ["Faturamento", s.revenue, null, false],
    ["(-) Custo dos produtos vendidos", -s.cost, null, false],
    ["= Lucro bruto", s.grossProfit, s.grossProfit >= 0 ? SUCCESS : DANGER, true],
    ["(-) Despesas do mês", -s.expenses, null, false],
    ["= Lucro líquido estimado", s.netProfit, s.netProfit >= 0 ? SUCCESS : DANGER, true],
  ];
  const maxResult = Math.max(...resultRows.map(([, value]) => Math.abs(value)), 1);
  const barX = MARGIN + 70;
  const barMaxW = CONTENT_W - 70 - 34;
  resultRows.forEach(([label, value, tone, strong]) => {
    ensureSpace(9);
    if (strong) {
      setFill(BRAND_SOFT);
      doc.roundedRect(MARGIN, y - 1.5, CONTENT_W, 8, 1.5, 1.5, "F");
    }
    doc.setFont("helvetica", strong ? "bold" : "normal");
    doc.setFontSize(9);
    setColor(INK);
    doc.text(label, MARGIN + 3, y + 3.8);
    const width = Math.max(0.8, (Math.abs(value) / maxResult) * barMaxW);
    setFill(value < 0 ? [252, 165, 165] : tone ?? [165, 186, 252]);
    doc.roundedRect(barX, y + 0.6, width, 3.6, 1, 1, "F");
    setColor(tone ?? (value < 0 ? DANGER : INK));
    doc.text(money(value), PAGE_W - MARGIN - 3, y + 3.8, { align: "right" });
    y += 9;
  });
  y += 6;

  // ---------- Produtos ----------
  sectionTitle("Produtos mais vendidos", "Faturamento por produto no mês");
  const products = report.topProducts.slice().sort((a, b) => b.revenue - a.revenue);
  const chartProducts = products.slice(0, 8);
  if (chartProducts.length > 0) {
    const maxRevenue = Math.max(...chartProducts.map((product) => product.revenue), 1);
    const labelW = 62;
    const chartW = CONTENT_W - labelW - 32;
    chartProducts.forEach((product) => {
      ensureSpace(8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      setColor(INK);
      const label = doc.splitTextToSize(product.name, labelW - 2)[0] as string;
      doc.text(label, MARGIN, y + 3.6);
      setFill(SURFACE);
      doc.roundedRect(MARGIN + labelW, y + 0.4, chartW, 4.2, 1.2, 1.2, "F");
      setFill(BRAND);
      doc.roundedRect(MARGIN + labelW, y + 0.4, Math.max(1, (product.revenue / maxRevenue) * chartW), 4.2, 1.2, 1.2, "F");
      doc.setFont("helvetica", "bold");
      doc.text(money(product.revenue), PAGE_W - MARGIN, y + 3.6, { align: "right" });
      y += 7.2;
    });
    y += 4;
  }
  table(
    ["Produto", "Qtd.", "Faturamento", "Custo", "Margem"],
    products.map((product) => [product.name, String(product.qty), money(product.revenue), money(product.cost), money(product.profit)]),
    {
      align: { 1: "center", 2: "right", 3: "right", 4: "right" },
      tone: (row, column) => (column === 4 ? (products[row].profit >= 0 ? SUCCESS : DANGER) : null),
      foot: products.length
        ? ["Total", String(products.reduce((sum, p) => sum + p.qty, 0)), money(products.reduce((sum, p) => sum + p.revenue, 0)), money(products.reduce((sum, p) => sum + p.cost, 0)), money(products.reduce((sum, p) => sum + p.profit, 0))]
        : undefined,
      empty: "Nenhum produto vendido neste mês.",
    }
  );

  // ---------- Clientes ----------
  sectionTitle("Clientes que mais compraram");
  table(
    ["#", "Cliente", "Total comprado"],
    report.topCustomers.map((customer, index) => [String(index + 1), customer.name, money(customer.total)]),
    { align: { 0: "center", 2: "right" }, widths: { 0: 12 }, empty: "Nenhuma compra de cliente neste mês." }
  );

  // ---------- Vendas ----------
  sectionTitle("Vendas do mês", `${report.salesRows.length} venda(s) · ${money(s.revenue)}`);
  table(
    ["Data", "Venda", "Cliente", "Vendedor", "Pagamento", "Total"],
    report.salesRows.map((sale) => [formatDate(sale.date), `#${sale.saleNumber}`, sale.customer, sale.seller, PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod, money(sale.total)]),
    {
      align: { 0: "center", 1: "center", 5: "right" },
      widths: { 0: 20, 1: 16 },
      foot: report.salesRows.length ? ["", "", "", "", "Total", money(s.revenue)] : undefined,
    }
  );

  // ---------- Recebimentos ----------
  sectionTitle("Recebimentos do mês", `${report.paymentRows.length} recebimento(s) · ${money(s.paymentsReceived)}`);
  table(
    ["Data", "Cliente", "Referência", "Forma", "Recebido por", "Valor"],
    report.paymentRows.map((payment) => [
      formatDate(payment.date),
      payment.customer,
      `${payment.reference}${payment.saleNumber ? ` #${payment.saleNumber}` : ""}`,
      PAYMENT_LABELS[payment.method] ?? payment.method,
      payment.collector,
      money(payment.amount),
    ]),
    {
      align: { 0: "center", 5: "right" },
      widths: { 0: 20 },
      foot: report.paymentRows.length ? ["", "", "", "", "Total", money(s.paymentsReceived)] : undefined,
    }
  );

  // ---------- Carteira a receber ----------
  const receivables = report.openReceivablesRows
    .slice()
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.localeCompare(b.dueDate));
  sectionTitle("Carteira a receber (hoje)", `${money(s.openReceivables)} em aberto · ${money(s.overdueReceivables)} vencido`);
  table(
    ["Situação", "Cliente", "Ficha", "Parcela", "Vencimento", "Em aberto"],
    receivables.map((row) => [
      row.overdue ? "Vencido" : "Em dia",
      row.customer,
      row.fichaNumber ? `#${row.fichaNumber}` : "-",
      row.saleNumber ? `${row.installmentNumber}/${row.totalInstallments} · #${row.saleNumber}` : row.reference,
      formatDate(row.dueDate),
      money(row.openAmount),
    ]),
    {
      align: { 0: "center", 2: "center", 3: "center", 4: "center", 5: "right" },
      widths: { 0: 20, 2: 15 },
      tone: (row, column) => (column === 0 ? (receivables[row].overdue ? DANGER : SUCCESS) : null),
      foot: receivables.length ? ["", "", "", "", "Total", money(s.openReceivables)] : undefined,
      empty: "Nenhum valor em aberto.",
    }
  );

  // ---------- Despesas ----------
  sectionTitle("Despesas do mês", money(s.expenses));
  table(
    ["Data", "Categoria", "Descrição", "Valor"],
    report.expenseRows.map((expense) => [formatDate(expense.date), expense.category, expense.description, money(expense.amount)]),
    {
      align: { 0: "center", 3: "right" },
      widths: { 0: 20 },
      tone: (_row, column) => (column === 3 ? DANGER : null),
      foot: report.expenseRows.length ? ["", "", "Total", money(s.expenses)] : undefined,
      empty: "Nenhuma despesa neste mês.",
    }
  );

  // ---------- Colaboradores ----------
  sectionTitle("Colaboradores", "Desempenho no mês e saldo de vale atual");
  const collaborators = report.collaboratorRows;
  table(
    ["Nome", "Função", "Vendas no mês", "Cobrado no mês", "Saldo de vale"],
    collaborators.map((row) => [row.name, row.role === "vendedor" ? "Vendedor" : "Cobrador", money(row.salesTotal), money(row.collectedTotal), money(row.valeBalance)]),
    {
      align: { 1: "center", 2: "right", 3: "right", 4: "right" },
      tone: (row, column) => (column === 4 ? (collaborators[row].valeBalance < 0 ? DANGER : collaborators[row].valeBalance > 0 ? SUCCESS : null) : null),
      empty: "Nenhum colaborador ativo.",
    }
  );

  // ---------- Estoque ----------
  sectionTitle("Estoque atual", `${s.stockUnits} unidade(s) · custo ${money(s.stockCostValue)} · potencial de venda ${money(s.stockSaleValue)}`);
  const stock = report.stockRows.slice().sort((a, b) => a.product.localeCompare(b.product, "pt-BR") || a.variant.localeCompare(b.variant, "pt-BR"));
  table(
    ["Produto", "Variação", "Qtd.", "Custo un.", "Venda un.", "Custo total", "Potencial"],
    stock.map((row) => [row.product, row.variant, String(row.quantity), money(row.unitCost), money(row.unitSale), money(row.costValue), money(row.saleValue)]),
    {
      align: { 2: "center", 3: "right", 4: "right", 5: "right", 6: "right" },
      tone: (row, column) => (column === 2 && stock[row].quantity <= 0 ? DANGER : null),
      foot: stock.length ? ["Total", "", String(s.stockUnits), "", "", money(s.stockCostValue), money(s.stockSaleValue)] : undefined,
      empty: "Nenhum produto em estoque.",
    }
  );

  // ---------- Rodapé em todas as páginas ----------
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    setDraw(LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setColor(MUTED);
    doc.text(`${report.business.name} · Relatório de ${monthTitle} · Gerado pelo Cobrei`, MARGIN, PAGE_H - 7);
    doc.text(`Página ${page} de ${pages}`, PAGE_W - MARGIN, PAGE_H - 7, { align: "right" });
  }

  return doc.output("arraybuffer");
}
