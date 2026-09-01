import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  hint?: string;
  compact?: boolean;
}

const TONE_STYLES: Record<NonNullable<StatCardProps["tone"]>, { icon: string; glow: string; value: string }> = {
  default: {
    icon: "bg-brand-50 text-brand-600 ring-brand-100",
    glow: "bg-brand-400/10",
    value: "text-slate-950",
  },
  success: {
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    glow: "bg-emerald-400/10",
    value: "text-emerald-700",
  },
  warning: {
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
    glow: "bg-amber-400/10",
    value: "text-amber-700",
  },
  danger: {
    icon: "bg-rose-50 text-rose-600 ring-rose-100",
    glow: "bg-rose-400/10",
    value: "text-rose-700",
  },
};

export function StatCard({ label, value, icon: Icon, tone = "default", hint, compact = false }: StatCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-white/80 bg-white/90 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.055)] ring-1 ring-slate-200/60 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(15,23,42,0.09)] md:p-5">
      <span className={clsx("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl", styles.glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-400">{label}</p>
          <p className={clsx("mt-2 font-black tracking-[-0.035em]", compact ? "text-xl" : "text-[23px] md:text-[26px]", styles.value)}>{value}</p>
          {hint && <p className="mt-1 text-[12px] leading-5 text-slate-400">{hint}</p>}
        </div>
        <span className={clsx("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ring-1 transition group-hover:scale-105", styles.icon)}>
          <Icon size={18} strokeWidth={2.3} />
        </span>
      </div>
    </div>
  );
}
