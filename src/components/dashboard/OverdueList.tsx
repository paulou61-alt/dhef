import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { formatCurrency, formatDate, daysOverdue } from "@/utils/format";
import { whatsappLink } from "@/utils/masks";

export interface OverdueItem {
  installmentId: string;
  customerName: string;
  customerPhone: string | null;
  amount: number;
  dueDate: string;
}

export function OverdueList({ items }: { items: OverdueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"><CheckCircle2 size={21} /></span>
          <div><p className="font-bold text-slate-900">Tudo em dia</p><p className="mt-0.5 text-sm text-slate-500">Nenhuma conta vencida no momento.</p></div>
        </div>
      </div>
    );
  }

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-rose-50/80 via-white to-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600"><AlertTriangle size={19} /></span>
          <div><h2 className="text-[15px] font-bold text-slate-900">Contas vencidas</h2><p className="text-xs text-slate-500">{items.length} pendência(s) · {formatCurrency(total)}</p></div>
        </div>
        <Link href="/cobrancas" className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700">Ver cobranças <ArrowRight size={14} /></Link>
      </div>
      <ul className="divide-y divide-slate-100 px-5">
        {items.map((item) => {
          const days = daysOverdue(item.dueDate);
          const message = `Olá ${item.customerName}, tudo bem? Passando para lembrar do pagamento de ${formatCurrency(item.amount)} referente à sua compra, vencido em ${formatDate(item.dueDate)}. Pode me confirmar quando consegue acertar?`;

          return (
            <li key={item.installmentId} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-slate-800">{item.customerName}</p>
                <p className="mt-0.5 text-[12px] text-slate-500">Venceu {formatDate(item.dueDate)} · <span className="font-semibold text-rose-500">{days} {days === 1 ? "dia" : "dias"} em atraso</span></p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span className="mr-1 text-[14px] font-black text-rose-600">{formatCurrency(item.amount)}</span>
                {item.customerPhone && (
                  <a href={whatsappLink(item.customerPhone, message)} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-[12px] font-bold text-emerald-600 ring-1 ring-emerald-100 transition hover:bg-emerald-100">
                    <MessageCircle size={14} /> Cobrar
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
