import assert from "node:assert/strict";
import test from "node:test";
import { parseDiscountAmount, saleDirectPayment, validateDiscountAmount } from "../src/lib/customer-discounts";

test("interpreta reais com vírgula, ponto decimal e milhares sem aceitar texto inválido", () => {
  for (const [text, expected] of [["50,25", 50.25], ["1.234,56", 1234.56], ["50.25", 50.25], [" 50 ", 50]] as const) {
    assert.equal(parseDiscountAmount(text), expected);
  }
  for (const text of ["", "abc", "1,2,3", "1e2", "0x20", "-5", "1.234.56", "1,234"]) {
    assert.ok(Number.isNaN(parseDiscountAmount(text)), text);
  }
});

test("valida limites, centavos e desconto total da dívida", () => {
  for (const value of [0, -1, NaN, Infinity, 10.001, 10000000000]) assert.ok(validateDiscountAmount(value));
  assert.ok(validateDiscountAmount(100.01, 100));
  assert.equal(validateDiscountAmount(100, 100), null);
  assert.equal(validateDiscountAmount(0.30, 0.1 + 0.2), null);
});

test("quitação com desconto não transforma abatimento em dinheiro recebido", () => {
  const sale = { id: "sale", total: 500, down_payment: 50, is_paid: true };
  const installmentSales = new Set([sale.id]);
  // R$ 50 de entrada + R$ 400 em pagamentos + R$ 50 de desconto = quitação.
  assert.equal(saleDirectPayment(sale, installmentSales) + 400, 450);
  assert.equal(saleDirectPayment(sale, new Set()), 500);
  assert.equal(saleDirectPayment({ ...sale, is_paid: false }, installmentSales), 50);
});
