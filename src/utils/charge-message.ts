import { formatCurrency, formatDate } from "@/utils/format";

export interface ChargeInstallment {
  installmentNumber: number;
  totalInstallments: number;
  saleNumber: number | string;
  dueDate: string;
  openAmount: number;
  status?: string;
  isOpeningBalance?: boolean;
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
    const situation = overdue ? `vencido em ${formatDate(item.dueDate)}` : `vence em ${formatDate(item.dueDate)}`;
    const reference = item.isOpeningBalance
      ? "Saldo devedor inicial"
      : `Parcela ${item.installmentNumber}/${item.totalInstallments} da venda #${item.saleNumber}`;
    return `• ${reference} — ${formatCurrency(item.openAmount)} — ${situation}`;
  });

  if (open.length === 1) {
    return `Olá ${customerName}, tudo bem? Estou entrando em contato sobre um valor pendente da sua ficha:\n\n${lines[0]}\n\nQuando puder, me confirme sobre o pagamento. Obrigado!`;
  }

  return `Olá ${customerName}, tudo bem? Estou entrando em contato sobre os valores pendentes da sua ficha:\n\n${lines.join("\n")}\n\nTotal pendente: ${formatCurrency(total)}.\n\nQuando puder, me confirme sobre o pagamento. Obrigado!`;
}
