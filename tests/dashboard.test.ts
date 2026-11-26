import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays, brazilDate, collectionRate, cumulative, dailyTotals, lastDays, monthPeriod, percentChange, splitPortfolio, startOfBrazilDay,
} from "../src/lib/dashboard";

test("datas no horário de Brasília", () => {
  // 01:30 UTC ainda é o dia anterior em Brasília.
  assert.equal(brazilDate("2026-11-26T01:30:00Z"), "2026-11-25");
  assert.equal(startOfBrazilDay("2026-11-01"), "2026-11-01T03:00:00.000Z");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
});

test("período do mês e mesmo período do mês anterior", () => {
  const p = monthPeriod("2026-11-26");
  assert.equal(p.monthStart, "2026-11-01");
  assert.equal(p.monthDays, 30);
  assert.equal(p.prevMonthStart, "2026-10-01");
  assert.equal(p.prevMonthDays, 31);
  assert.equal(p.prevSamePeriodEnd, "2026-10-26");
  // 31 de março compara com o fim de fevereiro, não com março.
  assert.equal(monthPeriod("2026-03-31").prevSamePeriodEnd, "2026-02-28");
  assert.equal(monthPeriod("2026-01-15").prevMonthStart, "2025-12-01");
});

test("soma por dia e acumulado", () => {
  const rows = [
    { date: "2026-11-01", amount: 10 }, { date: "2026-11-01", amount: 5.5 },
    { date: "2026-11-03", amount: 2 }, { date: "2026-10-31", amount: 99 },
  ];
  assert.deepEqual(dailyTotals(rows, "2026-11-01", 4), [15.5, 0, 2, 0]);
  assert.deepEqual(cumulative([0.1, 0.2, 0.3]), [0.1, 0.3, 0.6]);
  assert.deepEqual(lastDays(rows, "2026-11-03", 4), [99, 15.5, 0, 2]);
});

test("variação percentual sem base vira null", () => {
  assert.equal(percentChange(120, 100), 20);
  assert.equal(percentChange(50, 0), null);
});

test("carteira dividida por vencimento", () => {
  const split = splitPortfolio([
    { amount: 100, paid_amount: 40, due_date: "2026-11-20" },
    { amount: 200, paid_amount: 0, due_date: "2026-11-26" },
    { amount: 300, paid_amount: 0, due_date: "2026-12-03" },
    { amount: 400, paid_amount: 0, due_date: "2026-12-04" },
    { amount: 50, paid_amount: 50, due_date: "2026-11-01" },
  ], "2026-11-26");
  assert.deepEqual(split.overdue, { amount: 60, count: 1 });
  assert.deepEqual(split.nextWeek, { amount: 500, count: 2 });
  assert.deepEqual(split.upcoming, { amount: 400, count: 1 });
  assert.equal(split.total, 960);
});

test("taxa de cobrança do mês não passa do valor da parcela", () => {
  const result = collectionRate([{ amount: 100, paid_amount: 100 }, { amount: 100, paid_amount: 150 }, { amount: 200, paid_amount: 0 }]);
  assert.equal(result.rate, 50);
  assert.equal(collectionRate([]).rate, 0);
});
