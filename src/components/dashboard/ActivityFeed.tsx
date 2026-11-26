import { formatCurrency } from "@/utils/format";

export interface ActivityItem {
  id: string;
  kind: "payment" | "sale" | "discount" | "customer";
  title: string;
  amount?: number;
  detail?: string;
  at: string;
}

const DOT: Record<ActivityItem["kind"], string> = {
  payment: "bg-emerald-400 ring-emerald-400/20",
  sale: "bg-brand-400 ring-brand-400/20",
  discount: "bg-violet-400 ring-violet-400/20",
  customer: "bg-slate-400 ring-slate-400/20",
};

function timeAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

/** Linha do tempo com o que aconteceu por último: pagamentos, vendas, descontos e clientes novos. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const now = Date.now();
  return (
    <section className="glass animate-rise" style={{ animationDelay: "780ms" }}>
      <div className="flex items-center justify-between px-5 py-4 md:px-6">
        <h2 className="text-[15px] font-semibold text-slate-900">Agora há pouco</h2>
        <span className="flex items-center gap-1.5 text-[11.5px] text-emerald-700"><span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />ao vivo</span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 pb-6 text-[13px] text-slate-500 md:px-6">Nenhuma movimentação ainda.</p>
      ) : (
        <ol className="relative mx-5 mb-5 border-l border-slate-200 text-[13.5px] md:mx-6">
          {items.map((item, index) => (
            <li key={`${item.kind}-${item.id}`} className={`relative pl-5 ${index < items.length - 1 ? "pb-4" : ""}`}>
              <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ${DOT[item.kind]}`} />
              <p className="text-slate-800">
                {item.title}
                {item.amount !== undefined && <> · <b className={`font-semibold ${item.kind === "payment" ? "text-emerald-700" : "text-slate-900"}`}>{formatCurrency(item.amount)}</b></>}
              </p>
              <p className="text-[12px] text-slate-500">{timeAgo(item.at, now)}{item.detail ? ` · ${item.detail}` : ""}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
