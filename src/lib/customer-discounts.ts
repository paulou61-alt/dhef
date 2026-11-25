export function parseDiscountAmount(value: string): number {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)
    && !/^\d+(?:\.\d{1,2})?$/.test(text)) return NaN;
  return Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
}

export function validateDiscountAmount(amount: number, openAmount?: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99
    || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001) {
    return "Informe um desconto maior que zero, com até duas casas decimais.";
  }
  if (openAmount !== undefined && Math.round(amount * 100) > Math.round(openAmount * 100)) {
    return "O desconto não pode ser maior que o saldo em aberto.";
  }
  return null;
}

export interface CustomerDiscount {
  id: string;
  amount: number | string;
  note: string | null;
  created_at: string;
  reversed_at: string | null;
}

/** is_paid means settled, which can include discounts. Count only actual money. */
export function saleDirectPayment(sale: { id: string; total: unknown; down_payment: unknown; is_paid: boolean }, installmentSaleIds: Set<string>): number {
  return installmentSaleIds.has(sale.id) ? Number(sale.down_payment ?? 0)
    : sale.is_paid ? Number(sale.total) : Number(sale.down_payment ?? 0);
}

/**
 * Saldo que o cliente fica devendo logo após o cadastro: o saldo devedor inicial
 * mais a parte não paga da primeira compra (fiado ou parcelado, descontada a entrada).
 */
export function initialOpenAmount(input: {
  openingBalance: number; purchaseTotal: number; paymentMethod: string; downPayment: number;
}): number {
  const cents = (value: number) => Math.round((Number.isFinite(value) ? Math.max(0, value) : 0) * 100);
  const onCredit = input.paymentMethod === "fiado" || input.paymentMethod === "parcelado";
  const purchaseOpen = onCredit ? Math.max(0, cents(input.purchaseTotal) - cents(input.downPayment)) : 0;
  return (cents(input.openingBalance) + purchaseOpen) / 100;
}
