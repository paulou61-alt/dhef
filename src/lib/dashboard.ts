// Cálculos do Dashboard. Funções puras, para poderem ser testadas sem o banco.
// Datas no formato AAAA-MM-DD, sempre no horário de Brasília.

const BRAZIL_TZ = "America/Sao_Paulo";
const BRAZIL_OFFSET = "-03:00";

/** Data (AAAA-MM-DD) de um instante no horário de Brasília. */
export function brazilDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BRAZIL_TZ }).format(typeof value === "string" ? new Date(value) : value);
}

/** Início do dia em Brasília como instante ISO, para filtrar colunas timestamptz. */
export function startOfBrazilDay(date: string): string {
  return new Date(`${date}T00:00:00${BRAZIL_OFFSET}`).toISOString();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(date: string): number {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface MonthPeriod {
  today: string;
  day: number;
  monthStart: string;
  monthDays: number;
  prevMonthStart: string;
  prevMonthDays: number;
  /** Último dia do mês anterior que corresponde a hoje (mesmo período para comparar). */
  prevSamePeriodEnd: string;
}

export function monthPeriod(today: string): MonthPeriod {
  const [year, month, day] = today.split("-").map(Number);
  const monthStart = `${today.slice(0, 7)}-01`;
  const prev = new Date(Date.UTC(year, month - 2, 1));
  const prevMonthStart = prev.toISOString().slice(0, 10);
  const prevMonthDays = daysInMonth(prevMonthStart);
  return {
    today,
    day,
    monthStart,
    monthDays: daysInMonth(today),
    prevMonthStart,
    prevMonthDays,
    prevSamePeriodEnd: addDays(prevMonthStart, Math.min(day, prevMonthDays) - 1),
  };
}

/** Soma os valores por dia do mês (índice 0 = dia 1). Datas fora do mês são ignoradas. */
export function dailyTotals(rows: Array<{ date: string; amount: number }>, monthStart: string, days: number): number[] {
  const totals = new Array<number>(days).fill(0);
  const prefix = monthStart.slice(0, 7);
  for (const row of rows) {
    if (row.date.slice(0, 7) !== prefix) continue;
    const index = Number(row.date.slice(8, 10)) - 1;
    if (index >= 0 && index < days) totals[index] += Number(row.amount) || 0;
  }
  return totals.map((value) => Math.round(value * 100) / 100);
}

export function cumulative(values: number[]): number[] {
  let sum = 0;
  return values.map((value) => (sum = Math.round((sum + value) * 100) / 100));
}

/** Valores dos últimos `count` dias terminando em `today` (o mais antigo primeiro). */
export function lastDays(rows: Array<{ date: string; amount: number }>, today: string, count: number): number[] {
  const index = new Map<string, number>();
  for (let i = 0; i < count; i++) index.set(addDays(today, i - count + 1), i);
  const totals = new Array<number>(count).fill(0);
  for (const row of rows) {
    const i = index.get(row.date);
    if (i !== undefined) totals[i] += Number(row.amount) || 0;
  }
  return totals;
}

/** Variação percentual; null quando não há base para comparar. */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface PortfolioSplit {
  total: number;
  upcoming: { amount: number; count: number };
  nextWeek: { amount: number; count: number };
  overdue: { amount: number; count: number };
}

/** Divide a carteira a receber em vencido, vence em até 7 dias e a vencer depois disso. */
export function splitPortfolio(installments: Array<{ amount: number; paid_amount: number; due_date: string }>, today: string): PortfolioSplit {
  const weekEnd = addDays(today, 7);
  const split: PortfolioSplit = { total: 0, upcoming: { amount: 0, count: 0 }, nextWeek: { amount: 0, count: 0 }, overdue: { amount: 0, count: 0 } };
  for (const item of installments) {
    const open = Math.max(0, Number(item.amount) - Number(item.paid_amount));
    if (open <= 0) continue;
    const bucket = item.due_date < today ? split.overdue : item.due_date <= weekEnd ? split.nextWeek : split.upcoming;
    bucket.amount += open;
    bucket.count += 1;
    split.total += open;
  }
  return split;
}

/** Quanto das parcelas que vencem no mês já foi recebido (0 a 100). */
export function collectionRate(installments: Array<{ amount: number; paid_amount: number }>): { rate: number; due: number; received: number } {
  let due = 0;
  let received = 0;
  for (const item of installments) {
    const amount = Number(item.amount) || 0;
    due += amount;
    received += Math.min(amount, Math.max(0, Number(item.paid_amount) || 0));
  }
  return { rate: due > 0 ? (received / due) * 100 : 0, due, received };
}
