import { formatCurrency, formatDate } from "@/utils/format";

export interface ChargeInstallment {
  installmentNumber: number;
  totalInstallments: number;
  saleNumber: number | string;
  dueDate: string;
  openAmount: number;
  status?: string;
}

export function buildChargeMessage(customerName: string, installments: ChargeInstallment[]): string {
  const open = installments.filter((item) => item.openAmount > 0);
  const total = open.reduce((sum, item) => sum + item.openAmount, 0);

  if (open.length === 0) {
    return `Olá ${customerName}, tudo bem? Consta que seus pagamentos estão em dia. Obrigado!`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const lines = open.map((item) => {
    const overdue = item.status === "vencido" || item.dueDate < today;
    const situation = overdue ? `vencida em ${formatDate(item.dueDate)}` : `vence em ${formatDate(item.dueDate)}`;
    return `• Parcela ${item.installmentNumber}/${item.totalInstallments} da venda #${item.saleNumber} — ${formatCurrency(item.openAmount)} — ${situation}`;
  });

  if (open.length === 1) {
    return `Olá ${customerName}, tudo bem? Estou entrando em contato sobre a parcela pendente da sua compra:\n\n${lines[0]}\n\nQuando puder, me confirme sobre o pagamento. Obrigado!`;
  }

  return `Olá ${customerName}, tudo bem? Estou entrando em contato sobre as parcelas pendentes das suas compras:\n\n${lines.join("\n")}\n\nTotal pendente: ${formatCurrency(total)}.\n\nQuando puder, me confirme sobre o pagamento. Obrigado!`;
}
