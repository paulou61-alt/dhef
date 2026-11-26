import type { LucideIcon } from "lucide-react";

/** Cabeçalho das telas no visual novo (o mesmo do Dashboard). */
export function PageHeader({ icon: Icon, eyebrow, title, subtitle, actions }: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="animate-rise flex flex-col gap-4 pt-1 md:flex-row md:items-end md:justify-between" style={{ animationDelay: "40ms" }}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex items-center gap-2 text-[13px] text-slate-500">
            {Icon && <Icon size={14} className="text-brand-500" />}
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.035em] text-slate-900 md:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Botão de ação do cabeçalho (azul com brilho, igual ao "Nova venda" do Dashboard). */
export const headerPrimaryButton =
  "flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-brand-400 to-brand-500 px-4 text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_10px_24px_-8px_rgba(47,91,246,.7)] transition hover:-translate-y-0.5";
