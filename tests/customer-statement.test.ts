import assert from "node:assert/strict";
import test from "node:test";
import { statementDay, summarizeCustomerStatement, type CustomerStatement } from "../src/lib/reports/customer-statement";

function example(): CustomerStatement {
  const sale = { id: "sale", sale_number: 1, status: "completed", payment_method: "parcelado",
    total: 120, down_payment: 20, is_paid: true, is_opening_balance: false, created_at: "2026-11-04T01:00:00Z", notes: null } as const;
  return {
    customer: { id: "client", user_id: "owner", ficha_number: 14, assigned_collaborator_id: null, name: "Cliente",
      phone: null, whatsapp: null, cpf: null, address: null, house_number: null, neighborhood: null, city: null,
      state: null, zip_code: null, credit_limit: null, notes: null, created_at: sale.created_at, updated_at: sale.created_at },
    responsible: null,
    sales: [sale, { ...sale, id: "cash", sale_number: 2, total: 35, payment_method: "pix", down_payment: 0 },
      { ...sale, id: "cancel", status: "cancelled" }, { ...sale, id: "opening", total: 10, down_payment: 0, is_opening_balance: true }],
    items: [],
    installments: [{ id: "i", sale_id: "sale", installment_number: 1, total_installments: 1,
      amount: 85, paid_amount: 85, due_date: "2026-11-10", status: "pago" },
      { id: "old", sale_id: "opening", installment_number: 1, total_installments: 1, amount: 10, paid_amount: 0,
        due_date: "2026-11-10", status: "pendente" }],
    payments: [{ installment_id: "i", amount: 85, payment_method: "pix", payment_date: "2026-11-11", notes: null }],
    discounts: [{ id: "d", amount: 15, note: null, created_at: "2026-11-12T01:00:00Z", reversed_at: null },
      { id: "r", amount: 5, note: null, created_at: "2026-11-13T12:00:00Z", reversed_at: "2026-11-14T12:00:00Z" }],
  };
}

test("soma compras, entradas e descontos vigentes sem duplicar parcelas, saldo inicial ou vendas canceladas", () => {
  const statement = example();
  statement.customer.ficha_released = true;
  statement.customer.write_off_status = "mudou";
  const summary = summarizeCustomerStatement(statement);
  assert.deepEqual([summary.bought, summary.opening, summary.paid, summary.discounted, summary.cleared, summary.open],
    [155, 10, 140, 15, 155, 10]);
  assert.equal(summary.settled, false);
  assert.equal(summary.settledOn, null);
});

test("a quitação considera o último abatimento válido e preserva datas de pagamento e o dia local", () => {
  const statement = example();
  statement.installments[1].amount = 0;
  statement.installments[1].status = "pago";
  statement.discounts.push({ id: "last", amount: 10, note: null, created_at: "2026-11-15T01:30:00Z", reversed_at: null });
  assert.equal(summarizeCustomerStatement(statement).settledOn, "2026-11-14");
  assert.equal(statementDay("2026-11-11"), "2026-11-11");
  assert.equal(statementDay("2026-11-04T01:00:00Z"), "2026-11-03");

  statement.payments = [];
  const historical = summarizeCustomerStatement(statement);
  assert.equal(historical.paid, 140);
  assert.equal(historical.settled, true);
  assert.equal(historical.settledOn, null);
});
