import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { formatCurrency, formatDate, daysOverdue } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";

export interface OverdueItem {
  installmentId: string;
  customerName: string;
  customerPhone: string | null;
  amount: number;
  dueDate: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function OverdueList({ items, total, count }: { items: OverdueItem[]; total: number; count: number }) {
  return (
    <section className="glass animate-rise" style={{ animationDelay: "700ms" }}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="whitespace-nowrap text-[15px] font-semibold text-slate-900">Contas vencidas</h2>
          {count > 0 && (
            <span className="whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 text-[11.5px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15 dark:ring-rose-400/20">
              {count} · {formatCurrency(total)}
            </span>
          )}
        </div>
        <Link href="/cobrancas" className="flex flex-none items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
          Ver todas <ArrowRight size={14} />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-6 md:px-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={20} /></span>
          <div><p className="text-[14px] font-medium text-slate-900">Tudo em dia</p><p className="text-[12.5px] text-slate-500">Nenhuma conta vencida no momento.</p></div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 text-[14px]">
          {items.map((item) => {
            const days = daysOverdue(item.dueDate);
            const message = `Olá ${item.customerName}, tudo bem? Passando para lembrar do pagamento de ${formatCurrency(item.amount)} referente à sua compra, vencido em ${formatDate(item.dueDate)}. Pode me confirmar quando consegue acertar?`;
            return (
              <li key={item.installmentId} className="group flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50/80 md:px-6">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-slate-100 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-900/5 dark:from-brand-500/30 dark:to-violet-500/20 dark:text-white dark:ring-white/10">
                  {initials(item.customerName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{item.customerName}</p>
                  <p className="text-[12px] text-slate-500">
                    Venceu {formatDate(item.dueDate)} · <span className={days > 7 ? "text-rose-600 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}>{days} {days === 1 ? "dia" : "dias"}</span>
                  </p>
                </div>
                <span className="whitespace-nowrap font-medium tabular-nums text-slate-900">{formatCurrency(item.amount)}</span>
                {item.customerPhone && (
                  <a
                    href={whatsappLink(item.customerPhone, message)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Cobrar ${item.customerName} no WhatsApp`}
                    className="flex h-8 flex-none items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 text-[12.5px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15 transition md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 dark:ring-emerald-400/25"
                  >
                    <MessageCircle size={14} /> <span className="hidden sm:inline">Cobrar</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
