import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={22} />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-primary mt-2 px-6">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
