import { clsx } from "clsx";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Iniciais do cliente num círculo com degradê suave. */
export function InitialsAvatar({ name, tone = "brand", size = "md" }: { name: string; tone?: "brand" | "success" | "muted"; size?: "md" | "lg" }) {
  return (
    <span
      className={clsx(
        "flex flex-none items-center justify-center rounded-full font-semibold ring-1",
        size === "lg" ? "h-11 w-11 text-[13px]" : "h-9 w-9 text-[12px]",
        tone === "success" && "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
        tone === "muted" && "bg-slate-100 text-slate-400 ring-slate-900/5",
        tone === "brand" && "bg-gradient-to-br from-brand-100 to-slate-100 text-slate-700 ring-slate-900/5 dark:from-brand-500/30 dark:to-violet-500/20 dark:text-white dark:ring-white/10"
      )}
    >
      {initials(name)}
    </span>
  );
}

const PILL_TONES = {
  danger: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:ring-rose-400/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:ring-amber-400/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:ring-emerald-400/20",
  brand: "bg-brand-50 text-brand-700 ring-brand-600/15 dark:ring-brand-400/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
} as const;

const DOT_TONES = { danger: "bg-rose-500", warning: "bg-amber-500", success: "bg-emerald-500", brand: "bg-brand-500", neutral: "bg-slate-400" } as const;

/** Etiqueta de status: sempre ponto + texto, nunca só a cor. */
export function StatusPill({ tone, children, dot = true, className }: { tone: keyof typeof PILL_TONES; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={clsx("inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset", PILL_TONES[tone], className)}>
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", DOT_TONES[tone])} />}
      {children}
    </span>
  );
}

/** Número da ficha em destaque. */
export function FichaBadge({ number, muted = false }: { number: number | string | null | undefined; muted?: boolean }) {
  if (number == null) return null;
  return (
    <span className={clsx("inline-flex flex-none items-center rounded-lg px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset", muted ? "bg-slate-100 text-slate-500 ring-slate-500/10" : "bg-brand-50 text-brand-700 ring-brand-600/15 dark:ring-brand-400/20")}>
      #{number}
    </span>
  );
}
