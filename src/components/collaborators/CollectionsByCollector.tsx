import Link from "next/link";
import { HandCoins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { SelectField } from "@/components/ui/SelectField";
import { formatCurrency, formatDate } from "@/utils/format";

const OWNER_KEY = "proprietario";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  fiado: "Fiado",
  parcelado: "Parcelado",
};

type Collaborator = { id: string; name: string; role: string; is_active: boolean };

export type CollectionsFilter = { de?: string; ate?: string; cobrador?: string };

function todayInBrazil() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

// Mostra quanto cada cobrador recebeu no período escolhido.
// Recebimento lançado pelo próprio dono aparece como "Proprietário (você)".
export async function CollectionsByCollector({
  ownerId,
  collaborators,
  filter,
}: {
  ownerId: string;
  collaborators: Collaborator[];
  filter: CollectionsFilter;
}) {
  const today = todayInBrazil();
  const monthStart = `${today.slice(0, 7)}-01`;
  let from = filter.de && DATE_PATTERN.test(filter.de) ? filter.de : monthStart;
  let to = filter.ate && DATE_PATTERN.test(filter.ate) ? filter.ate : today;
  if (from > to) [from, to] = [to, from];
  const selected = filter.cobrador ?? "";

  const supabase = createClient();
  const { data } = await fetchAll((start, end) =>
    supabase
      .from("payments")
      .select(
        "id, amount, payment_method, payment_date, collected_by_collaborator_id, installments(installment_number, total_installments, sales(customers(name, ficha_number)))"
      )
      .eq("user_id", ownerId)
      .gte("payment_date", from)
      .lte("payment_date", to)
      .order("payment_date", { ascending: false })
      .order("id")
      .range(start, end)
  );
  const payments = data ?? [];

  const names = new Map(collaborators.map((collaborator) => [collaborator.id, collaborator.name]));
  const nameOf = (key: string) => (key === OWNER_KEY ? "Proprietário (você)" : names.get(key) ?? "Colaborador removido");

  const totals = new Map<string, { total: number; count: number }>();
  for (const payment of payments) {
    const key = payment.collected_by_collaborator_id ?? OWNER_KEY;
    const current = totals.get(key) ?? { total: 0, count: 0 };
    current.total += Number(payment.amount ?? 0);
    current.count += 1;
    totals.set(key, current);
  }

  // Todos os cobradores ativos aparecem, mesmo sem recebimento no período.
  for (const collaborator of collaborators) {
    if (collaborator.is_active && collaborator.role === "cobrador" && !totals.has(collaborator.id)) {
      totals.set(collaborator.id, { total: 0, count: 0 });
    }
  }

  const ranking = Array.from(totals.entries())
    .map(([key, value]) => ({ key, name: nameOf(key), ...value }))
    .filter((row) => !selected || row.key === selected)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));

  const grandTotal = ranking.reduce((sum, row) => sum + row.total, 0);
  const grandCount = ranking.reduce((sum, row) => sum + row.count, 0);
  const details = selected ? payments.filter((payment) => (payment.collected_by_collaborator_id ?? OWNER_KEY) === selected) : [];

  const options = [
    { value: "", label: "Todos os cobradores" },
    ...collaborators
      .filter((collaborator) => collaborator.is_active || totals.has(collaborator.id))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((collaborator) => ({
        value: collaborator.id,
        label: collaborator.name,
        description: collaborator.role === "cobrador" ? "Cobrador" : "Vendedor",
      })),
    { value: OWNER_KEY, label: "Proprietário (você)" },
  ];

  const presetLink = (de: string, ate: string) => {
    const params = new URLSearchParams({ de, ate });
    if (selected) params.set("cobrador", selected);
    return `/colaboradores?${params.toString()}#cobrancas`;
  };
  const lastMonthEnd = new Date(`${monthStart}T12:00:00Z`);
  lastMonthEnd.setUTCDate(0);
  const lastMonthEndKey = lastMonthEnd.toISOString().slice(0, 10);
  const presets = [
    { label: "Hoje", de: today, ate: today },
    { label: "Este mês", de: monthStart, ate: today },
    { label: "Mês passado", de: `${lastMonthEndKey.slice(0, 7)}-01`, ate: lastMonthEndKey },
  ];

  return (
    <div id="cobrancas" className="card !p-0">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">Cobranças por cobrador</h2>
        <p className="mt-0.5 text-xs text-slate-500">Veja quanto cada cobrador recebeu dos clientes no período.</p>
      </div>

      <form key={`${from}-${to}-${selected}`} method="get" action="/colaboradores#cobrancas" className="grid gap-3 border-b border-slate-100 px-4 py-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
        <div>
          <label htmlFor="cobrancas-de" className="mb-1 block text-xs font-semibold text-slate-500">De</label>
          <input id="cobrancas-de" name="de" type="date" defaultValue={from} className="input-field" />
        </div>
        <div>
          <label htmlFor="cobrancas-ate" className="mb-1 block text-xs font-semibold text-slate-500">Até</label>
          <input id="cobrancas-ate" name="ate" type="date" defaultValue={to} className="input-field" />
        </div>
        <div>
          <label htmlFor="cobrancas-cobrador" className="mb-1 block text-xs font-semibold text-slate-500">Cobrador</label>
          <SelectField id="cobrancas-cobrador" name="cobrador" defaultValue={selected} options={options} searchable searchPlaceholder="Buscar pelo nome" />
        </div>
        <button type="submit" className="btn-primary h-[48px] px-5">Filtrar</button>
      </form>

      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-2.5">
        {presets.map((preset) => {
          const active = preset.de === from && preset.ate === to;
          return (
            <Link
              key={preset.label}
              href={presetLink(preset.de, preset.ate)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {preset.label}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-xs text-slate-500">Total recebido</p>
          <p className="mt-0.5 text-lg font-bold text-success">{formatCurrency(grandTotal)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Recebimentos</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{grandCount}</p>
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="py-10 text-center">
          <HandCoins className="mx-auto mb-2 text-slate-300" size={30} />
          <p className="text-sm text-slate-500">Nenhum recebimento neste período.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {ranking.map((row) => {
            const share = grandTotal > 0 ? Math.round((row.total / grandTotal) * 100) : 0;
            return (
              <li key={row.key} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.count === 1 ? "1 recebimento" : `${row.count} recebimentos`}
                      {!selected && grandTotal > 0 ? ` · ${share}% do total` : ""}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-bold text-slate-900">{formatCurrency(row.total)}</span>
                </div>
                {!selected && grandTotal > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${share}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {selected && details.length > 0 && (
        <div className="border-t border-slate-100">
          <p className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Recebimentos de {nameOf(selected)}</p>
          <ul className="divide-y divide-slate-100">
            {details.map((payment) => {
              const installment = one(payment.installments as any);
              const customer = one(one(installment?.sales as any)?.customers as any) as { name: string; ficha_number: number | null } | null;
              return (
                <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {customer?.name ?? "Cliente"}
                      {customer?.ficha_number ? <span className="font-normal text-slate-400"> · Ficha {customer.ficha_number}</span> : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(payment.payment_date)}
                      {installment ? ` · Parcela ${installment.installment_number}/${installment.total_installments}` : ""}
                      {` · ${METHOD_LABELS[payment.payment_method] ?? payment.payment_method}`}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-bold text-success">{formatCurrency(Number(payment.amount ?? 0))}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
