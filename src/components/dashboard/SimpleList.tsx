import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/utils/format";

export interface SimpleListItem {
  id: string;
  title: string;
  subtitle: string;
  value: number;
  href?: string;
}

export function SimpleList({ title, items, emptyMessage }: { title: string; items: SimpleListItem[]; emptyMessage: string }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.055)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-slate-100 px-5">
          {items.map((item) => {
            const content = (
              <div className="group flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-slate-800">{item.title}</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">{item.subtitle}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="text-[14px] font-black text-slate-900">{formatCurrency(item.value)}</span>
                  {item.href && <ArrowUpRight size={15} className="text-slate-300 transition group-hover:text-brand-500" />}
                </div>
              </div>
            );
            return <li key={item.id}>{item.href ? <Link href={item.href}>{content}</Link> : content}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

export { formatDate };
