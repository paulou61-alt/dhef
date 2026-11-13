import assert from "node:assert/strict";
import test from "node:test";
import { receiptBalance, suggestedReceiptAmount, validateReceiptAmounts } from "../src/lib/receipt-discounts";

test("recebimento com desconto quita ou mantém apenas a diferença devida", () => {
  assert.deepEqual(receiptBalance(240,200,40), {remaining:0,excess:0});
  assert.deepEqual(receiptBalance(240,150,40), {remaining:50,excess:0});
  assert.deepEqual(receiptBalance(240,250,40), {remaining:0,excess:50});
  assert.deepEqual(receiptBalance(0.3,0.1,0.2), {remaining:0,excess:0});
});

test("sugere pagamento líquido ao alterar o desconto e preserva dinheiro informado manualmente", () => {
  assert.equal(suggestedReceiptAmount(240,240,0,40),200);
  assert.equal(suggestedReceiptAmount(240,200,40,50),190);
  assert.equal(suggestedReceiptAmount(240,200,40,0),240);
  assert.equal(suggestedReceiptAmount(240,100,0,40),100);
});

test("valida descontos e pagamentos sem aceitar saldo excedido ou valores inválidos", () => {
  assert.equal(validateReceiptAmounts(240,200,40),null);
  assert.equal(validateReceiptAmounts(240,240,0),null);
  for (const [received,discount] of [[200,241],[200,-1],[200,NaN],[200,1.001],[0,240],[NaN,0],[10.001,0]]) {
    assert.ok(validateReceiptAmounts(240,received,discount));
  }
});
