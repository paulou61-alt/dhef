import { validateDiscountAmount } from "./customer-discounts";

export function receiptBalance(open: number, received: number, discount: number) {
  const remainder = Math.round(open * 100) - Math.round(received * 100) - Math.round(discount * 100);
  return { remaining: Math.max(0, remainder) / 100, excess: Math.max(0, -remainder) / 100 };
}

export function validateReceiptAmounts(open: number, received: number, discount: number): string | null {
  if (validateDiscountAmount(received)) return "Informe um valor recebido maior que zero, com até duas casas decimais.";
  if (discount === 0) return null;
  return validateDiscountAmount(discount, open);
}

/** Ajusta o valor sugerido sem sobrescrever um recebimento digitado manualmente. */
export function suggestedReceiptAmount(open: number, received: number, previousDiscount: number, discount: number): number {
  const previousSuggestion = Math.max(0, Math.round(open * 100) - Math.round(previousDiscount * 100));
  return Math.round(received * 100) === previousSuggestion
    ? Math.max(0, Math.round(open * 100) - Math.round(discount * 100)) / 100
    : received;
}
