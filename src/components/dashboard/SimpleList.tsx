import Link from "next/link";
import { formatCurrency, formatDate } from "@/utils/format";

export interface SimpleListItem {
  id: string;
  title: string;
  subtitle: string;
  value: number;
  href?: string;
}

export function SimpleList({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: SimpleListItem[];
  emptyMessage: string;
}) {
  return (
    <div className="card">
      <h2 className="mb-3 text-[15px] font-bold text-slate-900">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const content = (
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-slate-800">
                    {item.title}
                  </p>
                  <p className="text-[12px] text-slate-500">{item.subtitle}</p>
                </div>
                <span className="flex-shrink-0 text-[14px] font-bold text-slate-900">
                  {formatCurrency(item.value)}
                </span>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? <Link href={item.href}>{content}</Link> : content}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { formatDate };
