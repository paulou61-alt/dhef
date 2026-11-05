import assert from "node:assert/strict";
import test from "node:test";
import { getValeBalancesByMovement } from "../src/lib/vale-balance";

type Movement = Parameters<typeof getValeBalancesByMovement>[0][number];

function movement(id: string, movement_type: Movement["movement_type"], amount: number, date: string, time = "12:00:00"): Movement {
  return { id, movement_type, amount, movement_date: date, created_at: `${date}T${time}Z` };
}

test("acerto mantém a dívida do fechamento mesmo com novos vales e créditos no mês seguinte", () => {
  const rows = [
    movement("new-credit", "abatimento", 2000, "2026-11-04"),
    movement("new-vale", "vale", 500, "2026-11-03"),
    movement("settlement", "abatimento", 0, "2026-10-31", "23:00:00"),
    movement("credit", "abatimento", 3598.50, "2026-10-31"),
    movement("vale", "vale", 10465, "2026-10-30"),
  ];
  const originalOrder = rows.map((row) => row.id);
  const balances = getValeBalancesByMovement(rows);

  assert.equal(balances.get("settlement"), -6866.50);
  assert.equal(balances.get("new-credit"), -5366.50);
  assert.deepEqual(rows.map((row) => row.id), originalOrder);
});

test("separa dois acertos no mesmo dia e considera devoluções parciais entre eles", () => {
  const balances = getValeBalancesByMovement([
    movement("second", "abatimento", 0, "2026-10-31", "18:00:00"),
    movement("repayment", "abatimento", 100, "2026-10-31", "15:00:00"),
    movement("later-vale", "vale", 50, "2026-10-31", "20:00:00"),
    movement("first", "abatimento", 0, "2026-10-31", "14:00:00"),
    movement("vale", "vale", 300, "2026-10-31", "10:00:00"),
  ]);

  assert.equal(balances.get("first"), -300);
  assert.equal(balances.get("second"), -200);
});

test("lançamentos retroativos seguem a data financeira, não a data em que foram cadastrados", () => {
  const retroactive = movement("retroactive", "vale", 450, "2026-10-30");
  retroactive.created_at = "2026-11-02T12:00:00Z";
  const balances = getValeBalancesByMovement([
    movement("settlement", "abatimento", 0, "2026-10-31"),
    retroactive,
    movement("old-credit", "abatimento", 100, "2026-09-15"),
  ]);

  assert.equal(balances.get("settlement"), -350);
});

test("acertos sem dívida preservam saldo positivo ou zero", () => {
  const balances = getValeBalancesByMovement([
    movement("credit", "abatimento", 150, "2026-10-29"),
    movement("positive", "abatimento", 0, "2026-10-30"),
    movement("paid", "vale", 150, "2026-10-31", "09:00:00"),
    movement("zero", "abatimento", 0, "2026-10-31"),
  ]);

  assert.equal(balances.get("positive"), 150);
  assert.equal(balances.get("zero"), 0);
  assert.equal(getValeBalancesByMovement([]).size, 0);
});

test("calcula em centavos sem deixar resíduos de ponto flutuante", () => {
  const balances = getValeBalancesByMovement([
    movement("vale-1", "vale", 0.10, "2026-10-27"),
    movement("vale-2", "vale", 0.20, "2026-10-28"),
    movement("credit", "abatimento", 0.30, "2026-10-29"),
    movement("settlement", "abatimento", 0, "2026-10-31"),
  ]);

  assert.equal(balances.get("settlement"), 0);
});
