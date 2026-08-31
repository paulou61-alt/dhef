import { AlertTriangle } from "lucide-react";
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
      <div className="card">
        <p className="text-sm text-slate-500">Nenhuma conta vencida. 🎉</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={18} className="text-danger" />
        <h2 className="text-[15px] font-bold text-slate-900">Contas vencidas</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => {
          const days = daysOverdue(item.dueDate);
          const message = `Olá ${item.customerName}, tudo bem? Passando para lembrar do pagamento de ${formatCurrency(
            item.amount
          )} referente à sua compra, vencido em ${formatDate(item.dueDate)}. Pode me confirmar quando consegue acertar?`;

          return (
            <li key={item.installmentId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-slate-800">
                  {item.customerName}
                </p>
                <p className="text-[12px] text-slate-500">
                  Venceu em {formatDate(item.dueDate)} · {days} {days === 1 ? "dia" : "dias"} em
                  atraso
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span className="text-[14px] font-bold text-danger">
                  {formatCurrency(item.amount)}
                </span>
                {item.customerPhone && (
                  <a
                    href={whatsappLink(item.customerPhone, message)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-success/10 px-2.5 py-1.5 text-[12px] font-semibold text-success"
                  >
                    Cobrar
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
