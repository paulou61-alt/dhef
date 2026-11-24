import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { openInstallment, statementDay, summarizeCustomerStatement, type CustomerStatement } from "../reports/customer-statement";
import { formatCurrency, formatDate } from "../../utils/format";

const methods: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", parcelado: "Parcelado", fiado: "Fiado" };
const statuses = { completed: "Concluída", pending: "Pendente", cancelled: "Cancelada" };
const installmentStatuses = { pago: "Paga", parcial: "Parcial", pendente: "Pendente", vencido: "Vencida" };
const money = (amount: number | string) => formatCurrency(Number(amount)).replace(/\u00a0/g, " ");
const date = (value: string) => formatDate(statementDay(value));
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

export function createCustomerStatementPdf(statement: CustomerStatement): ArrayBuffer {
  const { customer, sales, installments, items, discounts } = statement;
  const summary = summarizeCustomerStatement(statement);
  const saleById = new Map(sales.map((sale) => [sale.id, sale]));
  const installmentById = new Map(installments.map((item) => [item.id, item]));
  function saleLabel(id: string) {
    const sale = saleById.get(id);
    return sale?.is_opening_balance ? "Saldo inicial" : `Venda #${sale?.sale_number ?? "-"}`;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({ title: `Ficha #${customer.ficha_number} - ${customer.name}`, creator: "Cobrei" });
  let y = 32;
  function table(title: string, columns: string[], rows: RowInput[], widths: number[] = []) {
    if (y > 252) { doc.addPage(); y = 32; }
    autoTable(doc, {
      startY: y,
      margin: { top: 32, bottom: 19, left: 14, right: 14 },
      theme: "plain",
      head: [
        [{ content: title, colSpan: columns.length, styles: { fontSize: 11, textColor: [29, 63, 160], fillColor: [232, 238, 255] } }],
        columns,
      ],
      body: rows,
      styles: { font: "helvetica", fontSize: 9, textColor: [30, 41, 59], cellPadding: 2.2, overflow: "linebreak" },
      headStyles: { fontStyle: "bold", fontSize: 8, textColor: [71, 85, 105], fillColor: [246, 248, 252] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries(widths.map((width, i) => [i, { cellWidth: width }])),
      rowPageBreak: "avoid",
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  const writeOff = customer.write_off_status;
  const status = writeOff ? (writeOff === "mudou" ? "Baixa por mudança" : "Baixa por inadimplência")
    : summary.settled ? "Quitada" : summary.open > 0 ? "Em aberto" : "Sem saldo em aberto";
  let exit = "Sem saída registrada";
  if (writeOff) exit = customer.write_off_at ? date(customer.write_off_at) : "Data da baixa não registrada";
  else if (customer.ficha_released) {
    exit = summary.settledOn ? `${date(summary.settledOn)} (por quitação, conforme o histórico)` : "Ficha liberada, data não registrada";
  }

  table("Cadastro", ["Campo", "Dados do cliente"], [
    ["Nome", customer.name],
    ["CPF", customer.cpf || "Não informado"],
    ["Telefone / WhatsApp", `${customer.phone || "-"} / ${customer.whatsapp || "-"}`],
    ["Endereço", join([customer.address, customer.house_number].filter(Boolean).join(", "), customer.neighborhood,
      [customer.city, customer.state].filter(Boolean).join("/"), customer.zip_code && `CEP ${customer.zip_code}`) || "Não informado"],
    ["Entrada na ficha", date(customer.created_at)],
    ["Saída da ficha", exit],
    ["Situação", status],
    ["Responsável", statement.responsible || "Sem colaborador atribuído"],
    ["Limite de crédito", customer.credit_limit == null ? "Não informado" : money(customer.credit_limit)],
    ...(customer.notes ? [["Observações", customer.notes]] : []),
    ...(writeOff && customer.write_off_note ? [["Observação da baixa", customer.write_off_note]] : []),
  ], [47, 135]);

  table("Resumo financeiro", ["Compras concluídas", "Saldo devedor inicial", "Saldo em aberto"], [
    [money(summary.bought), money(summary.opening), money(summary.open)],
    ["Total pago", "Descontos vigentes", "Total quitado (pago + descontos)"].map((content) => ({
      content, styles: { fontStyle: "bold" as const, fontSize: 8, textColor: [71, 85, 105] as [number, number, number] },
    })),
    [money(summary.paid), money(summary.discounted), money(summary.cleared)],
    [{ content: summary.settled ? `Quitação integral: ${summary.settledOn ? date(summary.settledOn) + " (pelo histórico)" : "data não registrada"}`
      : summary.open > 0 ? "Quitação integral pendente." : "Sem quitação integral registrada.", colSpan: 3 }],
  ], [60, 59, 63]);

  if (!sales.length && !discounts.length) {
    table("Histórico", ["Movimentações"], [["Nenhuma movimentação registrada para este cliente."]]);
  }
  if (sales.length) {
    table("Vendas e saldo inicial", ["Data", "Lançamento", "Modalidade", "Situação", "Valor original"],
      sales.map((sale) => [date(sale.created_at), [saleLabel(sale.id), sale.notes].filter(Boolean).join("\n"),
        methods[sale.payment_method] ?? sale.payment_method, statuses[sale.status], money(sale.total)]), [25, 64, 31, 28, 34]);
  }
  if (items.length) {
    table("Produtos", ["Venda", "Produto / variação", "Qtd.", "Unitário", "Subtotal"],
      items.map((item) => [saleLabel(item.sale_id), join(item.product_name_snapshot, item.variant_name_snapshot),
        String(item.quantity), money(item.unit_price_snapshot), money(item.subtotal)]), [30, 74, 16, 30, 32]);
  }
  if (installments.length) {
    table("Parcelas", ["Referência", "Vencimento", "Situação", "Após desconto", "Pago", "Em aberto"],
      installments.map((item) => [
        `${saleLabel(item.sale_id)} · ${item.installment_number}/${item.total_installments}`, date(item.due_date),
        saleById.get(item.sale_id)?.status === "cancelled" ? "Cancelada" : installmentStatuses[item.status],
        money(item.amount), money(item.paid_amount), saleById.get(item.sale_id)?.status === "completed" ? money(openInstallment(item)) : "-",
      ]), [36, 27, 25, 34, 28, 32]);
  }
  const receipts = [
    ...summary.directPayments.map(({ sale, amount }) => {
      const credit = sale.payment_method === "parcelado" || sale.payment_method === "fiado";
      return { day: statementDay(sale.created_at), label: saleLabel(sale.id),
        detail: credit ? "Entrada na venda" : "Pagamento à vista", method: credit ? "-" : methods[sale.payment_method], amount };
    }),
    ...summary.payments.map((payment) => {
      const item = installmentById.get(payment.installment_id)!;
      return { day: payment.payment_date, label: saleLabel(item.sale_id),
        detail: join(`Parcela ${item.installment_number}/${item.total_installments}`, payment.notes),
        method: methods[payment.payment_method] ?? payment.payment_method, amount: payment.amount };
    }),
  ].sort((a, b) => a.day.localeCompare(b.day));
  if (receipts.length || sales.length) {
    table("Histórico de pagamentos", ["Data", "Referência", "Descrição", "Forma", "Recebido"],
      receipts.length ? receipts.map((row) => [date(row.day), row.label, row.detail, row.method, money(row.amount)])
        : [[{ content: "Nenhum pagamento individual registrado.", colSpan: 5 }]], [25, 33, 64, 28, 32]);
  }
  if (discounts.length) {
    table("Histórico de descontos", ["Concedido em", "Valor", "Situação / estorno", "Observação"],
      discounts.map((discount) => [date(discount.created_at), money(discount.amount),
        discount.reversed_at ? `Estornado em ${date(discount.reversed_at)}` : "Vigente", discount.note || "-"]), [32, 32, 51, 67]);
  }

  const pages = doc.getNumberOfPages();
  const generated = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFillColor(29, 63, 160);
    doc.rect(0, 0, 210, 25, "F");
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(255);
    doc.text("Ficha do cliente", 14, 15.5);
    doc.setFontSize(11);
    doc.text(`Cobrei  |  Ficha #${customer.ficha_number}`, 196, 15, { align: "right" });
    doc.setDrawColor(218, 225, 235);
    doc.line(14, 282, 196, 282);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(76, 89, 112);
    doc.text(`Emitido em ${generated} (Brasília)`, 14, 288);
    doc.text(`Página ${page} de ${pages}`, 196, 288, { align: "right" });
  }
  return doc.output("arraybuffer");
}
